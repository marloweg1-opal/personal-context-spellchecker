(() => {
  "use strict";

  const STATE_KEY = "personal-contextual-spellchecker/state/v1";
  const SETTINGS_KEY = "personal-contextual-spellchecker/extension-settings/v1";
  const siteToggle = document.getElementById("site-toggle");
  const siteLabel = document.getElementById("site-label");
  const contextSelect = document.getElementById("context");
  const status = document.getElementById("status");
  const fileInput = document.getElementById("state-file");
  let origin = "";
  let state = null;
  let settings = { disabledOrigins: [] };

  function showStatus(message) {
    status.textContent = message;
  }

  function refresh() {
    const disabled = settings.disabledOrigins.includes(origin);
    siteToggle.textContent = disabled ? "Enable on this site" : "Disable on this site";
    siteToggle.classList.toggle("primary", !disabled);
    contextSelect.innerHTML = "";
    Object.values((state && state.contextProfiles) || {}).forEach((context) => {
      const option = document.createElement("option");
      option.value = context.id;
      option.textContent = context.name;
      option.selected = context.id === state.activeContextId;
      contextSelect.appendChild(option);
    });
  }

  chrome.tabs.query({ active: true, currentWindow: true }, ([tab]) => {
    try {
      const url = new URL(tab.url);
      if (!/^https?:$/.test(url.protocol)) throw new Error("Unsupported page");
      origin = url.origin;
      siteLabel.textContent = origin;
    } catch (_error) {
      siteToggle.disabled = true;
      siteLabel.textContent = "This browser page cannot be checked.";
    }
    chrome.storage.local.get([STATE_KEY, SETTINGS_KEY], (saved) => {
      try { state = JSON.parse(saved[STATE_KEY]); } catch (_error) { state = null; }
      try { settings = JSON.parse(saved[SETTINGS_KEY]) || settings; } catch (_error) { settings = { disabledOrigins: [] }; }
      refresh();
    });
  });

  siteToggle.addEventListener("click", () => {
    const disabled = settings.disabledOrigins.includes(origin);
    settings.disabledOrigins = disabled
      ? settings.disabledOrigins.filter((item) => item !== origin)
      : Array.from(new Set([...settings.disabledOrigins, origin]));
    chrome.storage.local.set({ [SETTINGS_KEY]: JSON.stringify(settings) }, () => {
      refresh();
      showStatus(disabled ? "Enabled. Return to the page and type." : "Disabled for this site.");
    });
  });

  contextSelect.addEventListener("change", () => {
    if (!state || !state.contextProfiles[contextSelect.value]) return;
    state.activeContextId = contextSelect.value;
    state.updatedAt = new Date().toISOString();
    chrome.storage.local.set({ [STATE_KEY]: JSON.stringify(state) }, () => showStatus("Context updated."));
  });

  document.getElementById("export").addEventListener("click", () => {
    if (!state) return showStatus("No personal state exists yet.");
    const blob = new Blob([JSON.stringify(state, null, 2)], { type: "application/json" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = "spellchecker-state.json";
    link.click();
    URL.revokeObjectURL(link.href);
    showStatus("State exported.");
  });

  document.getElementById("import").addEventListener("click", () => fileInput.click());
  fileInput.addEventListener("change", () => {
    const file = fileInput.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.addEventListener("load", () => {
      try {
        const imported = JSON.parse(String(reader.result));
        if (imported.schemaVersion !== 1 || !imported.wordBank || !imported.learnedCorrections) throw new Error("Invalid state");
        state = imported;
        chrome.storage.local.set({ [STATE_KEY]: JSON.stringify(state) }, () => {
          refresh();
          showStatus("State imported.");
        });
      } catch (_error) {
        showStatus("That file is not a valid spellchecker state export.");
      }
    });
    reader.readAsText(file);
  });
})();
