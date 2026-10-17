(function () {
  "use strict";

  const BLOCKED_TYPES = new Set([
    "password", "email", "tel", "url", "number", "date", "datetime-local",
    "month", "week", "time", "color", "file", "hidden"
  ]);
  const SENSITIVE_HINT = /(?:pass|secret|token|card|credit|debit|cvv|cvc|iban|routing|account|payment|billing|ssn|social.security)/i;

  function hasSensitiveHint(element) {
    const text = [
      element.name,
      element.id,
      element.getAttribute("autocomplete"),
      element.getAttribute("aria-label"),
      element.getAttribute("placeholder")
    ].filter(Boolean).join(" ");
    return SENSITIVE_HINT.test(text);
  }

  function isSupportedEditable(element) {
    if (!element || element.nodeType !== 1 || hasSensitiveHint(element)) return false;
    const tag = element.tagName;
    if (tag === "TEXTAREA") return !element.readOnly && !element.disabled;
    if (tag === "INPUT") {
      const type = (element.getAttribute("type") || "text").toLowerCase();
      return !BLOCKED_TYPES.has(type) && !element.readOnly && !element.disabled;
    }
    return element.isContentEditable === true && element.getAttribute("contenteditable") !== "false";
  }

  function closestSupportedEditable(node) {
    if (!node || node.nodeType !== 1) return null;
    const candidate = node.closest("input, textarea, [contenteditable]:not([contenteditable='false'])");
    return isSupportedEditable(candidate) ? candidate : null;
  }

  function readText(element) {
    return element.tagName === "INPUT" || element.tagName === "TEXTAREA"
      ? element.value
      : element.innerText;
  }

  function adjustedSelection(position, issues, replacementForIssue) {
    return issues.reduce((next, issue) => {
      if (issue.end <= next) return next + replacementForIssue(issue).length - (issue.end - issue.start);
      if (issue.start < next) return issue.start + replacementForIssue(issue).length;
      return next;
    }, position);
  }

  function dispatchInput(element, text) {
    element.dispatchEvent(new InputEvent("input", {
      bubbles: true,
      inputType: "insertReplacementText",
      data: text
    }));
  }

  function replaceFormControl(element, issues, replacementForIssue) {
    const start = element.selectionStart == null ? element.value.length : element.selectionStart;
    const end = element.selectionEnd == null ? start : element.selectionEnd;
    const ordered = issues.slice().sort((a, b) => b.start - a.start);
    ordered.forEach((issue) => {
      element.setRangeText(replacementForIssue(issue), issue.start, issue.end, "preserve");
    });
    element.setSelectionRange(
      adjustedSelection(start, issues, replacementForIssue),
      adjustedSelection(end, issues, replacementForIssue)
    );
    dispatchInput(element, element.value);
  }

  function textPoint(root, offset) {
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    let remaining = offset;
    let node = walker.nextNode();
    while (node) {
      if (remaining <= node.data.length) return { node, offset: remaining };
      remaining -= node.data.length;
      node = walker.nextNode();
    }
    return { node: root, offset: root.childNodes.length };
  }

  function contentSelectionOffsets(root) {
    const selection = window.getSelection();
    if (!selection || !selection.rangeCount) return null;
    const range = selection.getRangeAt(0);
    if (!root.contains(range.startContainer) || !root.contains(range.endContainer)) return null;
    const beforeStart = document.createRange();
    beforeStart.selectNodeContents(root);
    beforeStart.setEnd(range.startContainer, range.startOffset);
    const beforeEnd = document.createRange();
    beforeEnd.selectNodeContents(root);
    beforeEnd.setEnd(range.endContainer, range.endOffset);
    return { start: beforeStart.toString().length, end: beforeEnd.toString().length };
  }

  function restoreContentSelection(root, selectionOffsets, issues, replacementForIssue) {
    if (!selectionOffsets) return;
    const start = textPoint(root, adjustedSelection(selectionOffsets.start, issues, replacementForIssue));
    const end = textPoint(root, adjustedSelection(selectionOffsets.end, issues, replacementForIssue));
    const range = document.createRange();
    range.setStart(start.node, start.offset);
    range.setEnd(end.node, end.offset);
    const selection = window.getSelection();
    selection.removeAllRanges();
    selection.addRange(range);
  }

  function replaceContentEditable(element, issues, replacementForIssue) {
    const selection = contentSelectionOffsets(element);
    issues.slice().sort((a, b) => b.start - a.start).forEach((issue) => {
      const start = textPoint(element, issue.start);
      const end = textPoint(element, issue.end);
      const range = document.createRange();
      range.setStart(start.node, start.offset);
      range.setEnd(end.node, end.offset);
      range.deleteContents();
      range.insertNode(document.createTextNode(replacementForIssue(issue)));
    });
    restoreContentSelection(element, selection, issues, replacementForIssue);
    dispatchInput(element, readText(element));
  }

  function replaceIssues(element, issues, replacementForIssue) {
    if (!issues.length) return false;
    const allowed = element.dispatchEvent(new InputEvent("beforeinput", {
      bubbles: true,
      cancelable: true,
      inputType: "insertReplacementText",
      data: null
    }));
    if (!allowed) return false;
    if (element.tagName === "INPUT" || element.tagName === "TEXTAREA") {
      replaceFormControl(element, issues, replacementForIssue);
    } else {
      replaceContentEditable(element, issues, replacementForIssue);
    }
    return true;
  }

  window.PersonalSpellcheckerSurface = {
    hasSensitiveHint,
    isSupportedEditable,
    closestSupportedEditable,
    readText,
    adjustedSelection,
    replaceIssues
  };
})();
