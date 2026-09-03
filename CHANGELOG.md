# Changelog

## Unreleased

- Added startup cleanup for known leaked smoke-test fixtures from older test runs.
- Added a regression test proving smoke-test fixture cleanup does not remove real manual words.
- Documented the code-audit result and release cadence.
- Removed undeveloped personality presentation modes from the MVP surface.
- Documented the planned real-time autocorrect path with confidence, marking, and undo guardrails.

## 0.4.2 - 2026-09-02

- Isolated browser smoke tests from real app storage so fixture words no longer appear in the live word bank.

## 0.4.1 - 2026-09-02

- Added common `occurrence` misspelling coverage.
- Added ordinary-word coverage around the sample phrase `don't know how`.

## 0.4.0 - 2026-09-02

- Added global proper noun capitalization separate from topic/project context.
- Added relevant and irrelevant terms for topic/project word banks.
- Added acronym entries categorized by topic with an expansion action.
- Added identifier-style typo handling for `mini_ark`.
- Added sound-out typo handling for `relevant` and `irrelevant`.

## 0.3.0 - 2026-09-02

- Added titled project word banks.
- Added preferred capitalization suggestions for stored personal and project terms.

## 0.2.0 - 2026-09-02

- Added thought-level suggestion grouping with one `Accept All` action per sentence or coherent thought.
- Kept individual correction actions inside each grouped suggestion.

## 0.1.1 - 2026-09-02

- Fixed `launch.ps1` so PowerShell accepts its `param` block.

## 0.1.0 - 2026-09-02

- Built the first usable vertical slice.
- Added local spellcheck UI.
- Added contextual suggestion ranking.
- Added persistent personal word bank.
- Added Project Context mode for scoped topic/project vocabulary.
- Added non-elevated local launch script.
- Added extension scaffold with supported-field privacy boundary.
- Added import recovery and rejection feedback.
- Added favorites and never-correct decisions.
- Added learned corrections and typo-pattern counters.
- Added diagnostic logging and export.
- Added isolated personality presentation modes.
- Added architecture notes for maintainability, testability, recovery, deployment, security, and future extension.
