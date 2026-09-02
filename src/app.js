(function () {
  "use strict";

  const APP_VERSION = "0.1.0";
  const STORAGE_KEY = "personal-contextual-spellchecker/state/v1";
  const LOG_KEY = "personal-contextual-spellchecker/logs/v1";

  const SEED_WORDS = [
    "a", "able", "about", "accept", "accommodate", "across", "actually", "address", "again",
    "agent", "almost", "already", "also", "although", "always", "analysis", "and", "another",
    "app", "architecture", "area", "around", "because", "before", "beginning", "bank", "belong",
    "belongs", "build",
    "calendar", "candidate", "change", "check", "clean", "clickable", "code", "component",
    "context", "contextual", "correction", "correct", "custom", "decision", "definition",
    "definitely", "dependency", "deployment", "detect", "diagnostic", "dictionary", "does",
    "during", "each", "engine", "enough", "eventually", "every", "extension", "favorite", "favorited",
    "deliberate", "fix", "folder", "from", "general", "generative", "grammar", "guess", "had", "help",
    "hope", "hoping", "hopping", "i've", "infer", "intended", "into", "is", "it", "issue", "jargon", "learn", "likely", "local",
    "logic", "logs", "maintain", "maintainability", "malformed", "mode", "my", "name", "names", "never",
    "not", "note", "observability", "of", "one", "optionally", "over", "persistent", "personal",
    "personality", "popular", "preferred", "present", "private", "production", "profile", "project", "receive",
    "recovery", "recurring", "rename", "report", "reset", "rewriting", "scoped", "security", "sentence", "separate",
    "ship", "signature", "small", "source", "spellchecker", "spelling", "state", "stopped", "suggestion", "surface",
    "teasing", "testability", "the", "their", "there", "this", "thought", "through", "token",
    "to", "tone", "topic", "useful", "user", "versioning", "vertical", "want", "we", "what", "word", "working", "works", "would", "write",
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
    seperate: "separate",
    occured: "occurred",
    untill: "until",
    wierd: "weird",
    adress: "address",
    accomodate: "accommodate",
    contextul: "contextual",
    persistant: "persistent",
    grammer: "grammar"
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
    ["correction", "logic"],
    ["popular", "girl"]
  ];

  function nowIso() {
    return new Date().toISOString();
  }

  function normalizeWord(word) {
    return String(word || "").toLowerCase().replace(/^[^a-z']+|[^a-z']+$/g, "");
  }

  function tokenize(text) {
    const tokens = [];
    const regex = /[A-Za-z]+(?:'[A-Za-z]+)?/g;
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
            terms: {}
          },
          project: {
            id: "project",
            name: "Project Context",
            terms: {}
          }
        },
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
        return Object.assign(fallback, parsed, {
          contextProfiles: Object.assign(fallback.contextProfiles, parsed.contextProfiles || {})
        });
      } catch (error) {
        this.log.write("recovery.state.corrupt", { error: String(error) });
        return fallback;
      }
    }

    save() {
      this.state.updatedAt = nowIso();
      this.storage.setItem(STORAGE_KEY, JSON.stringify(this.state));
    }

    hasPersonalWord(word) {
      return Boolean(this.state.wordBank[normalizeWord(word)]);
    }

    hasContextTerm(word) {
      const context = this.activeContext();
      return Boolean(context.terms[normalizeWord(word)]);
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

    addContextTerm(word, contextId) {
      const key = normalizeWord(word);
      if (!key) return;
      const context = this.state.contextProfiles[contextId || this.state.activeContextId] || this.activeContext();
      context.terms[key] = context.terms[key] || {
        word: key,
        createdAt: nowIso(),
        count: 0
      };
      context.terms[key].count += 1;
      this.save();
      this.log.write("context.term.added", { contextId: context.id, word: key });
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
        createdAt: nowIso(),
        count: 0,
        favorite: false,
        neverCorrect: false
      };
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
          contextProfiles: Object.assign(defaults.contextProfiles, parsed.contextProfiles || {}),
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
      return this.dictionary.has(key) || this.store.hasPersonalWord(key) || this.store.hasContextTerm(key);
    }

    check(text) {
      const tokens = tokenize(text);
      const issues = [];
      tokens.forEach((token, index) => {
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

    suggest(token, tokens, index) {
      const learned = this.store.state.learnedCorrections[token.lower] || {};
      const candidates = new Set([
        CONFUSION_PAIRS[token.lower],
        ...Object.keys(learned),
        ...this.dictionary,
        ...Object.keys(this.store.state.wordBank),
        ...Object.keys(this.store.activeContext().terms)
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
      const distance = damerauLevenshtein(malformed, candidate);
      const length = Math.max(malformed.length, candidate.length);
      let score = Math.max(0, 1 - distance / Math.max(1, length));
      const reasons = [`edit distance ${distance}`];

      if (CONFUSION_PAIRS[malformed] === candidate) {
        score += 0.32;
        reasons.push("known confusion");
      }

      if (learned[candidate]) {
        score += Math.min(0.28, learned[candidate] * 0.08);
        reasons.push("learned from you");
      }

      const rejected = (this.store.state.rejectedCorrections[malformed] || {})[candidate] || 0;
      if (rejected) {
        score -= Math.min(0.28, rejected * 0.08);
        reasons.push("previously rejected");
      }

      const contextBonus = this.contextScore(candidate, tokens, index);
      if (contextBonus > 0) {
        score += contextBonus;
        reasons.push("context fit");
      }

      if (Math.abs(candidate.length - malformed.length) > 3) score -= 0.15;

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

  class Presenter {
    constructor(select) {
      this.select = select;
    }

    message(issue) {
      const mode = this.select.value;
      if (mode === "popularGirl") {
        return `Pretty sure "${issue.raw}" meant "${issue.suggestion}". Tiny typo moment, we recover.`;
      }
      if (mode === "quiet") {
        return `"${issue.raw}" -> "${issue.suggestion}"`;
      }
      return `Likely correction: "${issue.raw}" -> "${issue.suggestion}".`;
    }
  }

  class AppController {
    constructor(documentRef, storage) {
      this.document = documentRef;
      this.log = new DiagnosticLog(storage);
      this.store = new SpellStore(storage, this.log);
      this.engine = new SpellEngine(this.store, this.log);
      this.presenter = new Presenter(this.byId("personality"));
      this.currentIssues = [];
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
      this.byId("personality").addEventListener("change", () => this.renderSuggestions());
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
      this.byId("add-context-term-form").addEventListener("submit", (event) => {
        event.preventDefault();
        const input = this.byId("new-context-term");
        this.store.addContextTerm(input.value, "project");
        this.store.setActiveContext("project");
        input.value = "";
        this.check();
        this.renderAll();
      });
    }

    check() {
      const text = this.byId("input-text").value;
      this.currentIssues = this.engine.check(text);
      this.byId("status-line").textContent = `${this.currentIssues.length} likely misspelling${this.currentIssues.length === 1 ? "" : "s"} found`;
      this.renderSuggestions();
      this.renderDiagnostics();
    }

    renderAll() {
      this.byId("context-mode").value = this.store.state.activeContextId;
      this.renderWordBank();
      this.renderContextBank();
      this.renderDiagnostics();
      this.renderSuggestions();
    }

    renderSuggestions() {
      const container = this.byId("suggestions");
      this.byId("issue-count").textContent = `${this.currentIssues.length} issue${this.currentIssues.length === 1 ? "" : "s"}`;
      if (!this.currentIssues.length) {
        container.innerHTML = '<div class="empty-state">No likely misspellings found.</div>';
        return;
      }

      container.innerHTML = "";
      this.currentIssues.forEach((issue, index) => {
        const node = this.document.createElement("article");
        node.className = "suggestion";
        const alternatives = issue.alternatives.length ? ` Alternatives: ${issue.alternatives.join(", ")}.` : "";
        node.innerHTML = `
          <strong>${this.escape(this.presenter.message(issue))}</strong>
          <p class="suggestion-meta"><span class="confidence">${Math.round(issue.confidence * 100)}%</span> confidence. ${this.escape(issue.reason)}.${this.escape(alternatives)}</p>
          <div class="suggestion-actions">
            <button class="primary" data-action="accept" data-index="${index}" type="button">Accept</button>
            <button data-action="reject" data-index="${index}" type="button">Reject</button>
            <button data-action="add" data-index="${index}" type="button">Add Word</button>
            <button data-action="never" data-index="${index}" type="button">Never Correct</button>
            <button data-action="define" data-word="${this.escape(issue.suggestion)}" type="button">Define</button>
          </div>
        `;
        node.addEventListener("click", (event) => this.onSuggestionClick(event));
        container.appendChild(node);
      });
    }

    onSuggestionClick(event) {
      const button = event.target.closest("button");
      if (!button) return;
      const action = button.dataset.action;
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
      input.value = input.value.slice(0, issue.start) + this.matchCase(issue.raw, issue.suggestion) + input.value.slice(issue.end);
      this.store.learnCorrection(issue.raw, issue.suggestion);
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

    matchCase(original, correction) {
      if (original.toUpperCase() === original) return correction.toUpperCase();
      if (original[0] && original[0].toUpperCase() === original[0]) {
        return correction[0].toUpperCase() + correction.slice(1);
      }
      return correction;
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
          <div class="word-title"><span>${this.escape(entry.word)}</span><span>${badges}</span></div>
          <p>Seen ${entry.count} time${entry.count === 1 ? "" : "s"}. Source: ${this.escape(entry.source || "manual")}.</p>
          <div class="word-actions">
            <button data-action="favorite" data-word="${this.escape(entry.word)}" type="button">${entry.favorite ? "Unfavorite" : "Favorite"}</button>
            <button data-action="never" data-word="${this.escape(entry.word)}" type="button">Never Correct</button>
            <button data-action="define" data-word="${this.escape(entry.word)}" type="button">Define</button>
          </div>
        `;
        node.addEventListener("click", (event) => this.onWordClick(event));
        container.appendChild(node);
      });
    }

    renderContextBank() {
      const container = this.byId("context-bank");
      const context = this.store.state.contextProfiles.project;
      const entries = Object.values(context.terms).sort((a, b) => a.word.localeCompare(b.word));
      if (!entries.length) {
        container.innerHTML = '<div class="empty-state">No project terms yet.</div>';
        return;
      }
      container.innerHTML = "";
      entries.forEach((entry) => {
        const node = this.document.createElement("article");
        node.className = "word-item";
        node.innerHTML = `
          <div class="word-title"><span>${this.escape(entry.word)}</span><span class="badge">Context</span></div>
          <p>Active in ${this.escape(context.name)}. Seen ${entry.count} time${entry.count === 1 ? "" : "s"}.</p>
          <div class="word-actions">
            <button data-action="define" data-word="${this.escape(entry.word)}" type="button">Define</button>
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
      if (button.dataset.action === "define") {
        this.log.write("definition.opened", { word });
        window.open(`https://www.merriam-webster.com/dictionary/${encodeURIComponent(word)}`, "_blank", "noopener");
      }
      this.renderAll();
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
    damerauLevenshtein,
    DiagnosticLog,
    SpellStore,
    SpellEngine,
    Presenter,
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
