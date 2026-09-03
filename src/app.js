(function () {
  "use strict";

  const APP_VERSION = "0.4.2";
  const STORAGE_KEY = "personal-contextual-spellchecker/state/v1";
  const LOG_KEY = "personal-contextual-spellchecker/logs/v1";

  const SEED_WORDS = [
    "a", "able", "about", "accept", "accommodate", "across", "actually", "address", "again",
    "agent", "almost", "already", "also", "although", "always", "analysis", "and", "another",
    "app", "architecture", "are", "area", "around", "because", "before", "beginning", "bank", "belong",
    "belongs", "build",
    "calendar", "candidate", "change", "check", "clean", "clickable", "code", "component",
    "context", "contextual", "correction", "correct", "custom", "decision", "definition",
    "definitely", "dependency", "deployment", "detect", "diagnostic", "dictionary", "does",
    "don't",
    "during", "each", "engine", "enough", "eventually", "every", "extension", "favorite", "favorited",
    "deliberate", "fix", "folder", "from", "general", "generative", "grammar", "guess", "had", "help",
    "hope", "hoping", "hopping", "how", "i've", "infer", "intended", "into", "is", "it", "issue", "jargon", "know", "learn", "likely", "local",
    "logic", "logs", "maintain", "maintainability", "malformed", "mini_ark", "mode", "my", "name", "names", "never",
    "not", "note", "observability", "occurrence", "of", "one", "optionally", "over", "persistent", "personal",
    "noun", "nouns", "preferred", "present", "private", "production", "profile", "project", "proper", "receive",
    "ready", "recovery", "recurring", "rename", "report", "reset", "rewriting", "scoped", "security", "sentence", "separate",
    "ship", "signature", "small", "source", "spellchecker", "spelling", "state", "stopped", "suggestion", "surface",
    "teasing", "testability", "the", "their", "there", "this", "thought", "through", "token",
    "to", "tone", "topic", "use", "useful", "user", "versioning", "vertical", "want", "we", "what", "word", "working", "works", "would", "write",
    "intentionally", "matter", "matters", "mine", "time"
  ];

  const CONFUSION_PAIRS = {
    teh: "the",
    recieve: "receive",
    recieved: "received",
    enoweg: "enough",
    begining: "beginning",
    stoped: "stopped",
    wht: "what",
    signiture: "signature",
    signeture: "signature",
    defintely: "definitely",
    definately: "definitely",
    realavent: "relevant",
    reallevant: "relevant",
    relavant: "relevant",
    relevent: "relevant",
    irrelavent: "irrelevant",
    irrelevent: "irrelevant",
    irrelavant: "irrelevant",
    seperate: "separate",
    occured: "occurred",
    ocurance: "occurrence",
    occurance: "occurrence",
    ocurrance: "occurrence",
    occurence: "occurrence",
    untill: "until",
    wierd: "weird",
    adress: "address",
    accomodate: "accommodate",
    contextul: "contextual",
    persistant: "persistent",
    grammer: "grammar",
    min_ark: "mini_ark",
    miniark: "mini_ark"
  };

  const CONTEXT_HINTS = [
    ["personal", "word", "bank"],
    ["had", "enough", "of"],
    ["persistent", "personal", "word"],
    ["contextual", "spellchecker"],
    ["intended", "word"],
    ["diagnostic", "logs"],
    ["source", "control"],
    ["dependency", "boundaries"],
    ["surrounding", "sentence"],
    ["correction", "logic"]
  ];

  function nowIso() {
    return new Date().toISOString();
  }

  function normalizeWord(word) {
    return String(word || "").toLowerCase().replace(/^[^a-z_']+|[^a-z_']+$/g, "");
  }

  function makeContextId(name) {
    const slug = String(name || "")
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");
    return slug || `project-${Date.now()}`;
  }

  function tokenize(text) {
    const tokens = [];
    const regex = /[A-Za-z]+(?:[_'][A-Za-z]+)*/g;
    let match;
    while ((match = regex.exec(text))) {
      tokens.push({
        raw: match[0],
        lower: match[0].toLowerCase(),
        start: match.index,
        end: match.index + match[0].length
      });
    }
    return tokens;
  }

  function thoughtSpans(text) {
    const spans = [];
    const regex = /[^.!?\n]+[.!?\n]*/g;
    let match;
    while ((match = regex.exec(text))) {
      const raw = match[0];
      if (!raw.trim()) continue;
      spans.push({
        start: match.index,
        end: match.index + raw.length,
        text: raw.trim()
      });
    }
    if (!spans.length && text.trim()) {
      spans.push({ start: 0, end: text.length, text: text.trim() });
    }
    return spans;
  }

  function replacementForIssue(issue) {
    return issue.preserveSuggestionCase ? issue.suggestion : matchCase(issue.raw, issue.suggestion);
  }

  function applyCorrectionsToText(text, issues) {
    return issues
      .slice()
      .sort((a, b) => b.start - a.start)
      .reduce((nextText, issue) => {
        const replacement = replacementForIssue(issue);
        return nextText.slice(0, issue.start) + replacement + nextText.slice(issue.end);
      }, text);
  }

  function groupIssuesByThought(text, issues) {
    const spans = thoughtSpans(text);
    return spans
      .map((span, groupIndex) => {
        const groupIssues = issues.filter((issue) => issue.start >= span.start && issue.end <= span.end);
        if (!groupIssues.length) return null;
        return {
          id: `thought-${groupIndex}`,
          start: span.start,
          end: span.end,
          text: span.text,
          issues: groupIssues,
          preview: applyCorrectionsToText(text.slice(span.start, span.end), groupIssues.map((issue) => {
            return Object.assign({}, issue, {
              start: issue.start - span.start,
              end: issue.end - span.start
            });
          })).trim()
        };
      })
      .filter(Boolean);
  }

  function matchCase(original, correction) {
    if (original.toUpperCase() === original) return correction.toUpperCase();
    if (original[0] && original[0].toUpperCase() === original[0]) {
      return correction[0].toUpperCase() + correction.slice(1);
    }
    return correction;
  }

  function damerauLevenshtein(a, b) {
    const rows = a.length + 1;
    const cols = b.length + 1;
    const matrix = Array.from({ length: rows }, () => Array(cols).fill(0));

    for (let i = 0; i < rows; i += 1) matrix[i][0] = i;
    for (let j = 0; j < cols; j += 1) matrix[0][j] = j;

    for (let i = 1; i < rows; i += 1) {
      for (let j = 1; j < cols; j += 1) {
        const cost = a[i - 1] === b[j - 1] ? 0 : 1;
        matrix[i][j] = Math.min(
          matrix[i - 1][j] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j - 1] + cost
        );
        if (
          i > 1 &&
          j > 1 &&
          a[i - 1] === b[j - 2] &&
          a[i - 2] === b[j - 1]
        ) {
          matrix[i][j] = Math.min(matrix[i][j], matrix[i - 2][j - 2] + 1);
        }
      }
    }

    return matrix[a.length][b.length];
  }

  class DiagnosticLog {
    constructor(storage) {
      this.storage = storage;
      this.events = this.load();
    }

    load() {
      try {
        return JSON.parse(this.storage.getItem(LOG_KEY)) || [];
      } catch (error) {
        return [{
          ts: nowIso(),
          version: APP_VERSION,
          type: "recovery.logs.corrupt",
          detail: String(error)
        }];
      }
    }

    write(type, payload) {
      const event = {
        ts: nowIso(),
        version: APP_VERSION,
        type,
        payload
      };
      this.events.unshift(event);
      this.events = this.events.slice(0, 200);
      this.storage.setItem(LOG_KEY, JSON.stringify(this.events));
      return event;
    }

    exportText() {
      return this.events.map((event) => JSON.stringify(event)).join("\n");
    }

    clear() {
      this.events = [];
      this.storage.setItem(LOG_KEY, JSON.stringify(this.events));
      this.write("logs.cleared", { version: APP_VERSION });
    }
  }

  class SpellStore {
    constructor(storage, log) {
      this.storage = storage;
      this.log = log;
      this.state = this.load();
    }

    defaultState() {
      return {
        schemaVersion: 1,
        appVersion: APP_VERSION,
        createdAt: nowIso(),
        updatedAt: nowIso(),
        activeContextId: "personal",
        contextProfiles: {
          personal: {
            id: "personal",
            name: "Personal",
            kind: "personal",
            terms: {}
          },
          project: {
            id: "project",
            name: "Project / Topic Context",
            kind: "project",
            terms: {}
          }
        },
        properNouns: {},
        acronyms: {},
        wordBank: {},
        learnedCorrections: {},
        rejectedCorrections: {},
        typoPatterns: {}
      };
    }

    load() {
      const fallback = this.defaultState();
      try {
        const parsed = JSON.parse(this.storage.getItem(STORAGE_KEY));
        if (!parsed || parsed.schemaVersion !== 1) return fallback;
        const loaded = Object.assign(fallback, parsed, {
          contextProfiles: this.hydrateContextProfiles(Object.assign(fallback.contextProfiles, parsed.contextProfiles || {})),
          properNouns: this.hydrateProperNouns(parsed.properNouns || fallback.properNouns),
          acronyms: this.hydrateAcronyms(parsed.acronyms || fallback.acronyms),
          wordBank: this.hydrateWordBank(parsed.wordBank || fallback.wordBank)
        });
        this.removeKnownTestFixtures(loaded);
        return loaded;
      } catch (error) {
        this.log.write("recovery.state.corrupt", { error: String(error) });
        return fallback;
      }
    }

    save() {
      this.state.updatedAt = nowIso();
      this.storage.setItem(STORAGE_KEY, JSON.stringify(this.state));
    }

    hydrateWordBank(wordBank) {
      Object.keys(wordBank).forEach((key) => {
        wordBank[key].word = wordBank[key].word || key;
        wordBank[key].displayWord = wordBank[key].displayWord || wordBank[key].word;
      });
      return wordBank;
    }

    hydrateContextProfiles(contextProfiles) {
      Object.values(contextProfiles).forEach((context) => {
        context.kind = context.kind || (context.id === "personal" ? "personal" : "project");
        context.terms = context.terms || {};
        Object.keys(context.terms).forEach((key) => {
          context.terms[key].word = context.terms[key].word || key;
          context.terms[key].displayWord = context.terms[key].displayWord || context.terms[key].word;
          context.terms[key].relevance = context.terms[key].relevance || "relevant";
        });
      });
      return contextProfiles;
    }

    hydrateProperNouns(properNouns) {
      Object.keys(properNouns).forEach((key) => {
        properNouns[key].word = properNouns[key].word || key;
        properNouns[key].displayWord = properNouns[key].displayWord || properNouns[key].word;
      });
      return properNouns;
    }

    hydrateAcronyms(acronyms) {
      Object.keys(acronyms).forEach((key) => {
        acronyms[key].acronym = acronyms[key].acronym || key.toUpperCase();
        acronyms[key].topic = acronyms[key].topic || "General";
        acronyms[key].expansion = acronyms[key].expansion || "";
      });
      return acronyms;
    }

    removeKnownTestFixtures(state) {
      let changed = false;
      const runevale = state.wordBank.runevale;
      if (runevale && runevale.source === "test") {
        delete state.wordBank.runevale;
        changed = true;
      }
      const teh = state.wordBank.teh;
      if (teh && teh.source === "never-correct" && teh.neverCorrect && teh.count === 1 && !teh.favorite) {
        delete state.wordBank.teh;
        changed = true;
      }
      if (changed) {
        state.updatedAt = nowIso();
        this.storage.setItem(STORAGE_KEY, JSON.stringify(state));
        this.log.write("recovery.test_fixtures_removed", { words: ["runevale", "teh"] });
      }
    }

    hasPersonalWord(word) {
      return Boolean(this.state.wordBank[normalizeWord(word)]);
    }

    hasContextTerm(word) {
      const context = this.activeContext();
      const entry = context.terms[normalizeWord(word)];
      return Boolean(entry && entry.relevance !== "irrelevant");
    }

    preferredSpelling(word) {
      const key = normalizeWord(word);
      const contextEntry = this.activeContext().terms[key];
      if (contextEntry && contextEntry.relevance === "irrelevant") return null;
      const properEntry = this.state.properNouns[key];
      const acronymEntry = this.state.acronyms[key];
      const personalEntry = this.state.wordBank[key];
      const entry = (contextEntry && contextEntry.relevance !== "irrelevant" && contextEntry) || properEntry || personalEntry;
      return (acronymEntry && acronymEntry.acronym) || (entry && (entry.displayWord || entry.word));
    }

    isContextIrrelevant(word) {
      const entry = this.activeContext().terms[normalizeWord(word)];
      return Boolean(entry && entry.relevance === "irrelevant");
    }

    hasAcronymExpansionWord(word) {
      const key = normalizeWord(word);
      if (!key) return false;
      return Object.values(this.state.acronyms).some((entry) => tokenize(entry.expansion).some((token) => token.lower === key));
    }

    activeContext() {
      return this.state.contextProfiles[this.state.activeContextId] || this.state.contextProfiles.personal;
    }

    setActiveContext(contextId) {
      if (!this.state.contextProfiles[contextId]) return;
      this.state.activeContextId = contextId;
      this.save();
      this.log.write("context.changed", { contextId });
    }

    createContextProfile(name) {
      const cleanName = String(name || "").trim();
      if (!cleanName) return null;
      const baseId = makeContextId(cleanName);
      let id = baseId;
      let suffix = 2;
      while (this.state.contextProfiles[id]) {
        id = `${baseId}-${suffix}`;
        suffix += 1;
      }
      this.state.contextProfiles[id] = {
        id,
        name: cleanName,
        kind: "topic",
        terms: {}
      };
      this.state.activeContextId = id;
      this.save();
      this.log.write("context.created", { contextId: id, name: cleanName });
      return this.state.contextProfiles[id];
    }

    addContextTerm(word, contextId, relevance) {
      const key = normalizeWord(word);
      if (!key) return;
      const context = this.state.contextProfiles[contextId || this.state.activeContextId] || this.activeContext();
      context.terms[key] = context.terms[key] || {
        word: key,
        displayWord: String(word).trim(),
        createdAt: nowIso(),
        relevance: relevance || "relevant",
        count: 0
      };
      context.terms[key].displayWord = String(word).trim() || context.terms[key].displayWord || key;
      context.terms[key].relevance = relevance || context.terms[key].relevance || "relevant";
      context.terms[key].count += 1;
      this.save();
      this.log.write("context.term.added", { contextId: context.id, word: key, relevance: context.terms[key].relevance });
    }

    addProperNoun(word) {
      const key = normalizeWord(word);
      const displayWord = String(word || "").trim();
      if (!key || !displayWord) return;
      const existing = this.state.properNouns[key] || {
        word: key,
        displayWord,
        createdAt: nowIso(),
        count: 0
      };
      existing.displayWord = displayWord;
      existing.count += 1;
      this.state.properNouns[key] = existing;
      this.save();
      this.log.write("proper_noun.added", { word: key });
    }

    addAcronym(acronym, expansion, topic) {
      const cleanAcronym = String(acronym || "").trim();
      const cleanExpansion = String(expansion || "").trim();
      if (!cleanAcronym || !cleanExpansion) return;
      const key = cleanAcronym.toLowerCase();
      this.state.acronyms[key] = {
        acronym: cleanAcronym.toUpperCase(),
        expansion: cleanExpansion,
        topic: String(topic || "").trim() || this.activeContext().name || "General",
        updatedAt: nowIso()
      };
      this.save();
      this.log.write("acronym.added", { acronym: cleanAcronym.toUpperCase(), topic: this.state.acronyms[key].topic });
    }

    isNeverCorrect(word) {
      const entry = this.state.wordBank[normalizeWord(word)];
      return Boolean(entry && entry.neverCorrect);
    }

    addWord(word, source) {
      const key = normalizeWord(word);
      if (!key) return;
      const existing = this.state.wordBank[key] || {
        word: key,
        displayWord: String(word).trim(),
        createdAt: nowIso(),
        count: 0,
        favorite: false,
        neverCorrect: false
      };
      existing.displayWord = String(word).trim() || existing.displayWord || key;
      existing.count += 1;
      existing.source = source || existing.source || "manual";
      this.state.wordBank[key] = existing;
      this.save();
      this.log.write("word.added", { word: key, source: existing.source });
    }

    toggleFavorite(word) {
      const key = normalizeWord(word);
      if (!this.state.wordBank[key]) this.addWord(key, "favorite");
      this.state.wordBank[key].favorite = !this.state.wordBank[key].favorite;
      this.save();
      this.log.write("word.favorite.toggled", {
        word: key,
        favorite: this.state.wordBank[key].favorite
      });
    }

    markNeverCorrect(word) {
      const key = normalizeWord(word);
      if (!this.state.wordBank[key]) this.addWord(key, "never-correct");
      this.state.wordBank[key].neverCorrect = true;
      this.save();
      this.log.write("word.never_correct", { word: key });
    }

    learnCorrection(from, to) {
      const source = normalizeWord(from);
      const target = normalizeWord(to);
      if (!source || !target) return;
      this.state.learnedCorrections[source] = this.state.learnedCorrections[source] || {};
      this.state.learnedCorrections[source][target] = (this.state.learnedCorrections[source][target] || 0) + 1;
      const pattern = this.describePattern(source, target);
      this.state.typoPatterns[pattern] = (this.state.typoPatterns[pattern] || 0) + 1;
      this.save();
      this.log.write("correction.accepted", { from: source, to: target, pattern });
    }

    rejectCorrection(from, to) {
      const source = normalizeWord(from);
      const target = normalizeWord(to);
      if (!source || !target) return;
      this.state.rejectedCorrections[source] = this.state.rejectedCorrections[source] || {};
      this.state.rejectedCorrections[source][target] = (this.state.rejectedCorrections[source][target] || 0) + 1;
      this.save();
      this.log.write("correction.rejected", { from: source, to: target });
    }

    describePattern(from, to) {
      if (from.length === to.length) return "substitution-or-transposition";
      if (from.length < to.length) return "missing-character";
      return "extra-character";
    }

    exportState() {
      return JSON.stringify(this.state, null, 2);
    }

    importState(jsonText) {
      const parsed = JSON.parse(jsonText);
      if (!parsed || parsed.schemaVersion !== 1 || !parsed.wordBank || !parsed.learnedCorrections) {
        throw new Error("Unsupported or invalid state file.");
      }
      const recoverySnapshot = this.exportState();
      try {
        const defaults = this.defaultState();
        this.state = Object.assign(defaults, parsed, {
          contextProfiles: this.hydrateContextProfiles(Object.assign(defaults.contextProfiles, parsed.contextProfiles || {})),
          properNouns: this.hydrateProperNouns(parsed.properNouns || {}),
          acronyms: this.hydrateAcronyms(parsed.acronyms || {}),
          wordBank: this.hydrateWordBank(parsed.wordBank || {}),
          rejectedCorrections: parsed.rejectedCorrections || {}
        });
        this.save();
        this.log.write("state.imported", {
          wordCount: Object.keys(this.state.wordBank).length,
          learnedCorrectionCount: Object.keys(this.state.learnedCorrections).length
        });
      } catch (error) {
        this.state = JSON.parse(recoverySnapshot);
        this.save();
        this.log.write("recovery.import_failed", { error: String(error) });
        throw error;
      }
    }

    reset() {
      this.storage.removeItem(STORAGE_KEY);
      this.storage.removeItem(LOG_KEY);
      this.state = this.defaultState();
      this.log.events = [];
      this.log.write("app.reset", { version: APP_VERSION });
    }
  }

  class SpellEngine {
    constructor(store, log) {
      this.store = store;
      this.log = log;
      this.dictionary = new Set(SEED_WORDS);
      Object.values(CONFUSION_PAIRS).forEach((word) => this.dictionary.add(word));
    }

    isKnown(word) {
      const key = normalizeWord(word);
      return this.dictionary.has(key) || this.store.hasPersonalWord(key) || this.store.hasContextTerm(key) || this.store.hasAcronymExpansionWord(key);
    }

    check(text) {
      const tokens = tokenize(text);
      const issues = [];
      tokens.forEach((token, index) => {
        const casingSuggestion = this.suggestPreferredCasing(token);
        if (casingSuggestion) {
          issues.push(Object.assign({}, token, casingSuggestion));
          return;
        }
        if (token.lower.length < 2 || this.store.isNeverCorrect(token.lower) || this.isKnown(token.lower)) {
          return;
        }
        const suggestion = this.suggest(token, tokens, index);
        if (suggestion) issues.push(Object.assign({}, token, suggestion));
      });
      this.log.write("check.completed", {
        tokenCount: tokens.length,
        issueCount: issues.length,
        textLength: text.length
      });
      return issues;
    }

    suggestPreferredCasing(token) {
      const preferred = this.store.preferredSpelling(token.raw);
      if (!preferred || preferred === token.raw || preferred.toLowerCase() === preferred) return null;
      return {
        suggestion: preferred,
        confidence: 0.99,
        reason: "preferred capitalization",
        alternatives: [],
        preserveSuggestionCase: true
      };
    }

    suggest(token, tokens, index) {
      const learned = this.store.state.learnedCorrections[token.lower] || {};
      const candidates = new Set([
        CONFUSION_PAIRS[token.lower],
        ...Object.keys(learned),
        ...this.dictionary,
        ...Object.values(this.store.state.wordBank).map((entry) => entry.displayWord || entry.word),
        ...Object.values(this.store.state.properNouns).map((entry) => entry.displayWord || entry.word),
        ...Object.values(this.store.activeContext().terms).map((entry) => entry.displayWord || entry.word)
      ].filter(Boolean));

      const ranked = Array.from(candidates)
        .map((candidate) => this.scoreCandidate(token.lower, candidate, tokens, index, learned))
        .filter((item) => item.score >= 0.64)
        .sort((a, b) => b.score - a.score || a.word.localeCompare(b.word));

      const best = ranked[0];
      if (!best) return null;
      return {
        suggestion: best.word,
        confidence: Math.min(0.99, best.score),
        reason: best.reason,
        alternatives: ranked.slice(1, 4).map((item) => item.word)
      };
    }

    scoreCandidate(malformed, candidate, tokens, index, learned) {
      const candidateKey = normalizeWord(candidate);
      if (this.store.isContextIrrelevant(candidateKey)) {
        return {
          word: candidate,
          score: 0,
          reason: "irrelevant in active context"
        };
      }
      const distance = damerauLevenshtein(malformed, candidateKey);
      const length = Math.max(malformed.length, candidateKey.length);
      let score = Math.max(0, 1 - distance / Math.max(1, length));
      const reasons = [`edit distance ${distance}`];

      if (CONFUSION_PAIRS[malformed] === candidateKey) {
        score += 0.32;
        reasons.push("known confusion");
      }

      if (learned[candidateKey]) {
        score += Math.min(0.28, learned[candidateKey] * 0.08);
        reasons.push("learned from you");
      }

      const rejected = (this.store.state.rejectedCorrections[malformed] || {})[candidateKey] || 0;
      if (rejected) {
        score -= Math.min(0.28, rejected * 0.08);
        reasons.push("previously rejected");
      }

      const contextBonus = this.contextScore(candidateKey, tokens, index);
      if (contextBonus > 0) {
        score += contextBonus;
        reasons.push("context fit");
      }

      if (Math.abs(candidateKey.length - malformed.length) > 3) score -= 0.15;

      return {
        word: candidate,
        score,
        reason: reasons.join(", ")
      };
    }

    contextScore(candidate, tokens, index) {
      const before = tokens[index - 1] && tokens[index - 1].lower;
      const after = tokens[index + 1] && tokens[index + 1].lower;
      let score = 0;
      CONTEXT_HINTS.forEach((hint) => {
        for (let i = 0; i < hint.length; i += 1) {
          if (hint[i] !== candidate) continue;
          if (before && hint[i - 1] === before) score += 0.1;
          if (after && hint[i + 1] === after) score += 0.1;
        }
      });
      return score;
    }
  }

  class AppController {
    constructor(documentRef, storage) {
      this.document = documentRef;
      this.log = new DiagnosticLog(storage);
      this.store = new SpellStore(storage, this.log);
      this.engine = new SpellEngine(this.store, this.log);
      this.currentIssues = [];
      this.currentGroups = [];
      this.bind();
      this.renderAll();
      this.check();
      this.log.write("app.started", { version: APP_VERSION });
    }

    byId(id) {
      return this.document.getElementById(id);
    }

    bind() {
      this.byId("check-text").addEventListener("click", () => this.check());
      this.byId("context-mode").addEventListener("change", (event) => {
        this.store.setActiveContext(event.target.value);
        this.check();
        this.renderContextBank();
      });
      this.byId("export-state").addEventListener("click", () => this.download("spellchecker-state.json", this.store.exportState(), "application/json"));
      this.byId("import-state").addEventListener("click", () => this.byId("state-file").click());
      this.byId("state-file").addEventListener("change", (event) => this.importStateFile(event.target.files[0]));
      this.byId("export-logs").addEventListener("click", () => this.download("spellchecker-diagnostics.jsonl", this.log.exportText(), "application/x-ndjson"));
      this.byId("clear-logs").addEventListener("click", () => {
        this.log.clear();
        this.renderDiagnostics();
      });
      this.byId("reset-demo").addEventListener("click", () => {
        this.store.reset();
        this.currentIssues = [];
        this.renderAll();
        this.check();
      });
      this.byId("add-word-form").addEventListener("submit", (event) => {
        event.preventDefault();
        const input = this.byId("new-word");
        this.store.addWord(input.value, "manual");
        input.value = "";
        this.renderAll();
      });
      this.byId("add-proper-noun-form").addEventListener("submit", (event) => {
        event.preventDefault();
        const input = this.byId("new-proper-noun");
        this.store.addProperNoun(input.value);
        input.value = "";
        this.check();
        this.renderAll();
      });
      this.byId("add-context-form").addEventListener("submit", (event) => {
        event.preventDefault();
        const input = this.byId("new-context-name");
        this.store.createContextProfile(input.value);
        input.value = "";
        this.check();
        this.renderAll();
      });
      this.byId("add-context-term-form").addEventListener("submit", (event) => {
        event.preventDefault();
        const input = this.byId("new-context-term");
        const relevance = this.byId("new-context-relevance").value;
        const targetContext = this.store.state.activeContextId === "personal" ? "project" : this.store.state.activeContextId;
        this.store.addContextTerm(input.value, targetContext, relevance);
        if (this.store.state.activeContextId === "personal") this.store.setActiveContext(targetContext);
        input.value = "";
        this.check();
        this.renderAll();
      });
      this.byId("add-acronym-form").addEventListener("submit", (event) => {
        event.preventDefault();
        const acronym = this.byId("new-acronym");
        const expansion = this.byId("new-acronym-expansion");
        const topic = this.byId("new-acronym-topic");
        this.store.addAcronym(acronym.value, expansion.value, topic.value);
        acronym.value = "";
        expansion.value = "";
        topic.value = "";
        this.check();
        this.renderAll();
      });
    }

    check() {
      const text = this.byId("input-text").value;
      this.currentIssues = this.engine.check(text);
      this.currentGroups = groupIssuesByThought(text, this.currentIssues);
      this.byId("status-line").textContent = `${this.currentIssues.length} likely misspelling${this.currentIssues.length === 1 ? "" : "s"} found`;
      this.renderSuggestions();
      this.renderDiagnostics();
    }

    renderAll() {
      this.renderContextOptions();
      this.byId("context-mode").value = this.store.state.activeContextId;
      this.renderWordBank();
      this.renderProperNouns();
      this.renderContextBank();
      this.renderAcronyms();
      this.renderDiagnostics();
      this.renderSuggestions();
    }

    renderContextOptions() {
      const select = this.byId("context-mode");
      const selected = this.store.state.activeContextId;
      select.innerHTML = "";
      Object.values(this.store.state.contextProfiles).forEach((context) => {
        const option = this.document.createElement("option");
        option.value = context.id;
        option.textContent = context.name;
        select.appendChild(option);
      });
      select.value = selected;
    }

    renderSuggestions() {
      const container = this.byId("suggestions");
      this.byId("issue-count").textContent = `${this.currentIssues.length} issue${this.currentIssues.length === 1 ? "" : "s"} in ${this.currentGroups.length} thought${this.currentGroups.length === 1 ? "" : "s"}`;
      if (!this.currentIssues.length) {
        container.innerHTML = '<div class="empty-state">No likely misspellings found.</div>';
        return;
      }

      container.innerHTML = "";
      this.currentGroups.forEach((group, groupIndex) => {
        const node = this.document.createElement("article");
        node.className = "suggestion suggestion-group";
        const issueRows = group.issues.map((issue) => {
          const issueIndex = this.currentIssues.indexOf(issue);
          const alternatives = issue.alternatives.length ? ` Alternatives: ${issue.alternatives.join(", ")}.` : "";
          return `
            <div class="suggestion-row">
              <strong>Likely correction: "${this.escape(issue.raw)}" -> "${this.escape(issue.suggestion)}".</strong>
              <p class="suggestion-meta"><span class="confidence">${Math.round(issue.confidence * 100)}%</span> confidence. ${this.escape(issue.reason)}.${this.escape(alternatives)}</p>
              <div class="suggestion-actions">
                <button data-action="accept" data-index="${issueIndex}" type="button">Accept</button>
                <button data-action="reject" data-index="${issueIndex}" type="button">Reject</button>
                <button data-action="add" data-index="${issueIndex}" type="button">Add Word</button>
                <button data-action="never" data-index="${issueIndex}" type="button">Never Correct</button>
                <button data-action="define" data-word="${this.escape(issue.suggestion)}" type="button">Define</button>
              </div>
            </div>
          `;
        }).join("");
        node.innerHTML = `
          <div class="thought-head">
            <div>
              <span class="badge">${group.issues.length} fix${group.issues.length === 1 ? "" : "es"}</span>
              <p class="thought-preview">${this.escape(group.preview)}</p>
            </div>
            <button class="primary" data-action="accept-group" data-group="${groupIndex}" type="button">Accept All</button>
          </div>
          ${issueRows}
        `;
        node.addEventListener("click", (event) => this.onSuggestionClick(event));
        container.appendChild(node);
      });
    }

    onSuggestionClick(event) {
      const button = event.target.closest("button");
      if (!button) return;
      const action = button.dataset.action;
      if (action === "accept-group") {
        this.acceptGroup(this.currentGroups[Number(button.dataset.group)]);
        return;
      }
      const issue = this.currentIssues[Number(button.dataset.index)];
      if (action === "define") {
        const word = button.dataset.word;
        this.log.write("definition.opened", { word });
        window.open(`https://www.merriam-webster.com/dictionary/${encodeURIComponent(word)}`, "_blank", "noopener");
        this.renderDiagnostics();
        return;
      }
      if (!issue) return;

      if (action === "accept") {
        this.acceptIssue(issue);
      } else if (action === "reject") {
        this.store.rejectCorrection(issue.raw, issue.suggestion);
      } else if (action === "add") {
        this.store.addWord(issue.raw, "suggestion-dismissal");
      } else if (action === "never") {
        this.store.markNeverCorrect(issue.raw);
      }
      this.check();
      this.renderWordBank();
    }

    acceptIssue(issue) {
      const input = this.byId("input-text");
      input.value = input.value.slice(0, issue.start) + replacementForIssue(issue) + input.value.slice(issue.end);
      this.store.learnCorrection(issue.raw, issue.suggestion);
    }

    acceptGroup(group) {
      if (!group || !group.issues.length) return;
      const input = this.byId("input-text");
      input.value = applyCorrectionsToText(input.value, group.issues);
      group.issues.forEach((issue) => this.store.learnCorrection(issue.raw, issue.suggestion));
      this.log.write("correction_group.accepted", {
        issueCount: group.issues.length,
        start: group.start,
        end: group.end
      });
      this.check();
      this.renderWordBank();
    }

    importStateFile(file) {
      if (!file) return;
      const reader = new FileReader();
      reader.addEventListener("load", () => {
        try {
          this.store.importState(String(reader.result || ""));
          this.check();
          this.renderAll();
        } catch (error) {
          this.log.write("state.import_rejected", { error: String(error) });
          this.renderDiagnostics();
          this.byId("status-line").textContent = "Import failed: invalid state file";
        }
      });
      reader.readAsText(file);
    }

    renderWordBank() {
      const container = this.byId("word-bank");
      const entries = Object.values(this.store.state.wordBank).sort((a, b) => a.word.localeCompare(b.word));
      if (!entries.length) {
        container.innerHTML = '<div class="empty-state">No personal words yet.</div>';
        return;
      }
      container.innerHTML = "";
      entries.forEach((entry) => {
        const node = this.document.createElement("article");
        node.className = "word-item";
        const badges = [
          entry.favorite ? '<span class="badge favorite">Favorite</span>' : "",
          entry.neverCorrect ? '<span class="badge never">Never correct</span>' : '<span class="badge">Personal</span>'
        ].join("");
        node.innerHTML = `
          <div class="word-title"><span>${this.escape(entry.displayWord || entry.word)}</span><span>${badges}</span></div>
          <p>Seen ${entry.count} time${entry.count === 1 ? "" : "s"}. Source: ${this.escape(entry.source || "manual")}.</p>
          <div class="word-actions">
            <button data-action="favorite" data-word="${this.escape(entry.displayWord || entry.word)}" type="button">${entry.favorite ? "Unfavorite" : "Favorite"}</button>
            <button data-action="never" data-word="${this.escape(entry.displayWord || entry.word)}" type="button">Never Correct</button>
            <button data-action="define" data-word="${this.escape(entry.displayWord || entry.word)}" type="button">Define</button>
          </div>
        `;
        node.addEventListener("click", (event) => this.onWordClick(event));
        container.appendChild(node);
      });
    }

    renderContextBank() {
      const container = this.byId("context-bank");
      const context = this.store.state.activeContextId === "personal"
        ? this.store.state.contextProfiles.project
        : this.store.activeContext();
      const entries = Object.values(context.terms).sort((a, b) => a.word.localeCompare(b.word));
      if (!entries.length) {
        container.innerHTML = '<div class="empty-state">No topic or project terms yet.</div>';
        return;
      }
      container.innerHTML = "";
      entries.forEach((entry) => {
        const node = this.document.createElement("article");
        node.className = "word-item";
        node.innerHTML = `
          <div class="word-title"><span>${this.escape(entry.displayWord || entry.word)}</span><span class="badge">Context</span></div>
          <p>${this.escape(entry.relevance || "relevant")} in ${this.escape(context.name)}. Seen ${entry.count} time${entry.count === 1 ? "" : "s"}.</p>
          <div class="word-actions">
            <button data-action="define" data-word="${this.escape(entry.displayWord || entry.word)}" type="button">Define</button>
          </div>
        `;
        node.addEventListener("click", (event) => this.onWordClick(event));
        container.appendChild(node);
      });
    }

    renderProperNouns() {
      const container = this.byId("proper-nouns");
      const entries = Object.values(this.store.state.properNouns).sort((a, b) => a.word.localeCompare(b.word));
      if (!entries.length) {
        container.innerHTML = '<div class="empty-state">No proper nouns yet.</div>';
        return;
      }
      container.innerHTML = "";
      entries.forEach((entry) => {
        const node = this.document.createElement("article");
        node.className = "word-item";
        node.innerHTML = `
          <div class="word-title"><span>${this.escape(entry.displayWord || entry.word)}</span><span class="badge">Proper noun</span></div>
          <p>Preferred capitalization. Seen ${entry.count} time${entry.count === 1 ? "" : "s"}.</p>
          <div class="word-actions">
            <button data-action="define" data-word="${this.escape(entry.displayWord || entry.word)}" type="button">Define</button>
          </div>
        `;
        node.addEventListener("click", (event) => this.onWordClick(event));
        container.appendChild(node);
      });
    }

    renderAcronyms() {
      const container = this.byId("acronyms");
      const entries = Object.values(this.store.state.acronyms).sort((a, b) => {
        return a.topic.localeCompare(b.topic) || a.acronym.localeCompare(b.acronym);
      });
      if (!entries.length) {
        container.innerHTML = '<div class="empty-state">No acronyms yet.</div>';
        return;
      }
      container.innerHTML = "";
      entries.forEach((entry) => {
        const node = this.document.createElement("article");
        node.className = "word-item";
        node.innerHTML = `
          <div class="word-title"><span>${this.escape(entry.acronym)}</span><span class="badge">${this.escape(entry.topic)}</span></div>
          <p>${this.escape(entry.expansion)}</p>
          <div class="word-actions">
            <button data-action="expand-acronym" data-acronym="${this.escape(entry.acronym)}" data-expansion="${this.escape(entry.expansion)}" type="button">Expand</button>
          </div>
        `;
        node.addEventListener("click", (event) => this.onWordClick(event));
        container.appendChild(node);
      });
    }

    onWordClick(event) {
      const button = event.target.closest("button");
      if (!button) return;
      const word = button.dataset.word;
      if (button.dataset.action === "favorite") this.store.toggleFavorite(word);
      if (button.dataset.action === "never") this.store.markNeverCorrect(word);
      if (button.dataset.action === "expand-acronym") {
        this.expandAcronym(button.dataset.acronym, button.dataset.expansion);
      }
      if (button.dataset.action === "define") {
        this.log.write("definition.opened", { word });
        window.open(`https://www.merriam-webster.com/dictionary/${encodeURIComponent(word)}`, "_blank", "noopener");
      }
      this.renderAll();
    }

    expandAcronym(acronym, expansion) {
      const input = this.byId("input-text");
      const escaped = acronym.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const expanded = `${acronym} (${expansion})`;
      const regex = new RegExp(`\\b${escaped}\\b`, "i");
      input.value = regex.test(input.value) ? input.value.replace(regex, expanded) : `${input.value.trim()} ${expanded}`.trim();
      this.log.write("acronym.expanded", { acronym });
      this.check();
    }

    renderDiagnostics() {
      this.byId("diagnostics").textContent = this.log.events.slice(0, 8).map((event) => JSON.stringify(event, null, 2)).join("\n");
    }

    download(filename, text, type) {
      const blob = new Blob([text], { type });
      const url = URL.createObjectURL(blob);
      const link = this.document.createElement("a");
      link.href = url;
      link.download = filename;
      link.click();
      URL.revokeObjectURL(url);
      this.log.write("export.created", { filename });
      this.renderDiagnostics();
    }

    escape(value) {
      return String(value).replace(/[&<>"']/g, (char) => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#039;"
      })[char]);
    }
  }

  window.PersonalSpellchecker = {
    APP_VERSION,
    tokenize,
    thoughtSpans,
    groupIssuesByThought,
    applyCorrectionsToText,
    replacementForIssue,
    damerauLevenshtein,
    DiagnosticLog,
    SpellStore,
    SpellEngine,
    AppController
  };

  if (!window.PERSONAL_SPELLCHECKER_SKIP_AUTO_START) {
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", () => new AppController(document, window.localStorage));
    } else {
      new AppController(document, window.localStorage);
    }
  }
})();
