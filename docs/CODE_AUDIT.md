# Code Audit

Date: 2026-09-02

## Scope

Reviewed the local-first spellchecker MVP for state isolation, test behavior, recovery, rendering safety, source-control cadence, and release hygiene.

## Finding: Test Fixtures Leaked Into Live Storage

Browser storage is scoped by origin. When the app and `tests.html` are both served from `http://127.0.0.1:8765`, they share the same `localStorage` namespace. Older smoke tests instantiated `SpellStore` with `window.localStorage`, so fixture entries such as `Runevale` and `teh` were written into the same state the live app reads.

Fix:

- `tests.html` now uses an in-memory storage adapter.
- `SpellStore.load()` removes only the known leaked fixtures when their metadata matches the old test signatures.
- A regression test verifies cleanup removes `Runevale` and the leaked `teh` never-correct entry while preserving normal manual words.

## Audit Notes

- Dynamic UI text is escaped before insertion into rendered HTML.
- Definition lookup opens a remote dictionary URL with `noopener`.
- Diagnostic logs avoid storing full checked sentences during ordinary spellchecks.
- State import has recovery behavior that restores the prior snapshot if import hydration fails.
- Test data now stays separate from app data.

## Release Cadence

Going forward, use GitHub commits for meaningful checkpoints and hold version tags/release snapshots until roughly 10 significant changes accumulate. Tag sooner only for user-visible bugfixes, data recovery fixes, or demo milestones.

## Deferred

- Larger dictionaries should move behind an indexed adapter or worker before adding many thousands of words.
- The extension scaffold still needs the full correction UI adapter.
- Acronym expansion is a first useful slice, not a full glossary manager.
