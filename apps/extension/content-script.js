(() => {
  "use strict";

  const api = window.PersonalSpellchecker;
  const surfaces = window.PersonalSpellcheckerSurface;
  if (!api || !surfaces || !globalThis.chrome || !chrome.storage) return;

  const STATE_KEY = "personal-contextual-spellchecker/state/v1";
  const LOG_KEY = "personal-contextual-spellchecker/logs/v1";
  const SETTINGS_KEY = "personal-contextual-spellchecker/extension-settings/v1";
  const memory = new Map();
  const disabledFields = new WeakSet();
  let activeField = null;
  let store = null;
  let engine = null;
  let groups = [];
  let timer = null;
  let settings = { disabledOrigins: [] };

  const storage = {
    getItem(key) {
      return memory.has(key) ? memory.get(key) : null;
    },
    setItem(key, value) {
      const text = String(value);
      memory.set(key, text);
      chrome.storage.local.set({ [key]: text });
    },
    removeItem(key) {
      memory.delete(key);
      chrome.storage.local.remove(key);
    }
  };

  function escapeHtml(value) {
    return String(value).replace(/[&<>"']/g, (char) => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;"
    })[char]);
  }

  function currentOriginDisabled() {
    return settings.disabledOrigins.includes(location.origin);
  }

  function saveSettings() {
    const text = JSON.stringify(settings);
    memory.set(SETTINGS_KEY, text);
    chrome.storage.local.set({ [SETTINGS_KEY]: text });
  }

  const host = document.createElement("div");
  host.id = "personal-contextual-spellchecker-host";
  host.style.all = "initial";
  host.style.position = "fixed";
  host.style.right = "18px";
  host.style.bottom = "18px";
  host.style.zIndex = "2147483647";
  host.hidden = true;
  const shadow = host.attachShadow({ mode: "closed" });
  shadow.innerHTML = `
    <style>
      :host { all: initial; }
      .panel { width: min(380px, calc(100vw - 36px)); max-height: min(520px, calc(100vh - 36px)); overflow: auto; border: 1px solid #cbd5df; border-radius: 8px; background: #fff; color: #17202a; box-shadow: 0 18px 48px rgba(20,32,45,.2); font: 14px/1.4 system-ui, sans-serif; }
      header { position: sticky; top: 0; display: flex; align-items: center; justify-content: space-between; gap: 8px; padding: 11px 12px; border-bottom: 1px solid #dce3e8; background: #f7fbfa; }
      h2 { margin: 0; font-size: 14px; letter-spacing: 0; }
      .body { display: grid; gap: 10px; padding: 10px; }
      .group { border: 1px solid #dce3e8; border-radius: 7px; padding: 10px; }
      .preview { margin: 0 0 8px; color: #344454; }
      .issue { padding: 8px 0; border-top: 1px solid #edf0f2; }
      .issue:first-of-type { border-top: 0; }
      .change { margin: 0 0 7px; font-weight: 650; }
      .arrow { color: #647481; padding: 0 5px; }
      .actions { display: flex; flex-wrap: wrap; gap: 6px; }
      button { min-height: 30px; border: 1px solid #cbd5df; border-radius: 6px; padding: 0 9px; background: #fff; color: #17202a; cursor: pointer; font: inherit; }
      button:hover, button:focus { border-color: #0f766e; outline: none; }
      .primary { border-color: #0f766e; background: #0f766e; color: #fff; }
      .quiet { color: #596875; }
      .empty { margin: 0; padding: 14px; color: #596875; }
    </style>
    <section class="panel" aria-label="Personal Spellchecker suggestions">
      <header><h2>Personal Spellchecker</h2><button data-action="close" title="Close suggestions" aria-label="Close suggestions">×</button></header>
      <div class="body"></div>
    </section>`;
  document.documentElement.appendChild(host);
  const body = shadow.querySelector(".body");

  function render() {
    if (!activeField || currentOriginDisabled() || disabledFields.has(activeField)) {
      host.hidden = true;
      return;
    }
    if (!groups.length) {
      host.hidden = true;
      return;
    }
    body.innerHTML = groups.map((group, groupIndex) => `
      <article class="group">
        <p class="preview">${escapeHtml(group.preview)}</p>
        <div class="actions"><button class="primary" data-action="accept-group" data-group="${groupIndex}">Accept all</button></div>
        ${group.issues.map((issue, issueIndex) => `
          <div class="issue">
            <p class="change">${escapeHtml(issue.raw)}<span class="arrow">→</span>${escapeHtml(api.replacementForIssue(issue))}</p>
            <div class="actions">
              <button data-action="accept" data-group="${groupIndex}" data-issue="${issueIndex}">Accept</button>
              <button data-action="reject" data-group="${groupIndex}" data-issue="${issueIndex}">Reject</button>
              <button class="quiet" data-action="never" data-group="${groupIndex}" data-issue="${issueIndex}">Never correct</button>
            </div>
          </div>`).join("")}
      </article>`).join("") + `
      <div class="actions">
        <button class="quiet" data-action="disable-field">Disable this field</button>
        <button class="quiet" data-action="disable-site">Disable on this site</button>
      </div>`;
    host.hidden = false;
  }

  function checkActiveField() {
    if (!engine || !activeField || !document.contains(activeField) || currentOriginDisabled() || disabledFields.has(activeField)) {
      groups = [];
      render();
      return;
    }
    const text = surfaces.readText(activeField);
    groups = api.groupIssuesByThought(text, engine.check(text));
    render();
  }

  function scheduleCheck() {
    clearTimeout(timer);
    timer = setTimeout(checkActiveField, 350);
  }

  function acceptIssues(issues) {
    if (!activeField || !issues.length) return;
    if (!surfaces.replaceIssues(activeField, issues, api.replacementForIssue)) return;
    issues.forEach((issue) => store.learnCorrection(issue.raw, issue.suggestion));
    checkActiveField();
  }

  shadow.addEventListener("mousedown", (event) => event.preventDefault());
  shadow.addEventListener("click", (event) => {
    const button = event.target.closest("button");
    if (!button) return;
    const action = button.dataset.action;
    if (action === "close") {
      host.hidden = true;
      return;
    }
    if (action === "disable-field") {
      disabledFields.add(activeField);
      groups = [];
      render();
      return;
    }
    if (action === "disable-site") {
      settings.disabledOrigins = Array.from(new Set([...settings.disabledOrigins, location.origin]));
      saveSettings();
      groups = [];
      render();
      return;
    }
    const group = groups[Number(button.dataset.group)];
    if (!group) return;
    if (action === "accept-group") {
      acceptIssues(group.issues);
      return;
    }
    const issue = group.issues[Number(button.dataset.issue)];
    if (!issue) return;
    if (action === "accept") acceptIssues([issue]);
    if (action === "reject") {
      store.rejectCorrection(issue.raw, issue.suggestion);
      checkActiveField();
    }
    if (action === "never") {
      store.markNeverCorrect(issue.raw);
      checkActiveField();
    }
  });

  document.addEventListener("focusin", (event) => {
    const candidate = surfaces.closestSupportedEditable(event.target);
    if (!candidate || currentOriginDisabled() || disabledFields.has(candidate)) return;
    activeField = candidate;
    scheduleCheck();
  }, true);

  document.addEventListener("input", (event) => {
    const candidate = surfaces.closestSupportedEditable(event.target);
    if (!candidate || candidate !== activeField) return;
    scheduleCheck();
  }, true);

  chrome.storage.local.get([STATE_KEY, LOG_KEY, SETTINGS_KEY], (saved) => {
    if (!saved[STATE_KEY] && /^https?:\/\/(?:127\.0\.0\.1|localhost):8765$/.test(location.origin)) {
      try {
        const legacyState = localStorage.getItem(STATE_KEY);
        const legacyLogs = localStorage.getItem(LOG_KEY);
        if (legacyState) saved[STATE_KEY] = legacyState;
        if (legacyLogs) saved[LOG_KEY] = legacyLogs;
      } catch (_error) {
        // Storage may be blocked by page policy; extension state still works independently.
      }
    }
    [STATE_KEY, LOG_KEY, SETTINGS_KEY].forEach((key) => {
      if (typeof saved[key] === "string") memory.set(key, saved[key]);
    });
    try {
      settings = JSON.parse(memory.get(SETTINGS_KEY)) || settings;
    } catch (_error) {
      settings = { disabledOrigins: [] };
    }
    const log = new api.DiagnosticLog(storage);
    store = new api.SpellStore(storage, log);
    engine = new api.SpellEngine(store, log);
    store.save();
    if (document.activeElement) {
      const candidate = surfaces.closestSupportedEditable(document.activeElement);
      if (candidate) {
        activeField = candidate;
        scheduleCheck();
      }
    }
  });

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== "local") return;
    if (changes[SETTINGS_KEY]) {
      try {
        settings = JSON.parse(changes[SETTINGS_KEY].newValue) || settings;
      } catch (_error) {
        settings = { disabledOrigins: [] };
      }
    }
    if (changes[STATE_KEY] && changes[STATE_KEY].newValue !== memory.get(STATE_KEY)) {
      memory.set(STATE_KEY, changes[STATE_KEY].newValue);
      const log = new api.DiagnosticLog(storage);
      store = new api.SpellStore(storage, log);
      engine = new api.SpellEngine(store, log);
    }
    checkActiveField();
  });
})();
