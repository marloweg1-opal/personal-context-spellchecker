(() => {
  "use strict";

  const BLOCKED_TYPES = new Set([
    "password",
    "email",
    "tel",
    "url",
    "number",
    "date",
    "datetime-local",
    "month",
    "week",
    "time",
    "color",
    "file"
  ]);

  function isSupportedEditable(element) {
    if (!element) return false;
    const tag = element.tagName;
    if (tag === "TEXTAREA") return true;
    if (tag === "INPUT") {
      const type = (element.getAttribute("type") || "text").toLowerCase();
      return !BLOCKED_TYPES.has(type);
    }
    return element.isContentEditable === true;
  }

  document.addEventListener("focusin", (event) => {
    const target = event.target;
    if (!isSupportedEditable(target)) return;
    target.dataset.personalSpellcheckerEligible = "true";
  });
})();
