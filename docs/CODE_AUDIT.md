# Code Audit

Date: 2026-10-16

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
- Complex editors still need compatibility-specific adapters and verification.
- Acronym expansion is a first useful slice, not a full glossary manager.

## Browser Extension Audit

- The extension packages the canonical playground engine instead of maintaining independent correction logic.
- Browser-specific responsibilities are isolated in `surface-adapter.js` and `content-script.js`.
- Password, payment-looking, credential-looking, contact, date, number, file, and other unsuitable fields are excluded before text is read.
- Corrections require explicit acceptance; cancellable `beforeinput` is honored before mutation.
- Input/textarea selection offsets are adjusted after replacement. Plain contenteditable text nodes are replaced in place to avoid replacing the entire editor DOM.
- User state and diagnostics use extension-local storage. No typed content is sent over the network, and ordinary check logs store counts and lengths rather than full sentences.
- Known limitation: complex editors may reject native mutations or use non-DOM document models and need dedicated adapters.

## Brave Verification Status

A disposable Brave profile initially showed **Error Loading Extension** because the automated launch command passed the repository path without preserving spaces. Copying the same extension package to a disposable no-space path opened `Extension Demo Fixture - Brave`, distinguishing that launch-argument error from a manifest or package failure.

Browser automation then stopped because it could not identify the Brave window URL with enough confidence to continue under its security policy. No browser security check was bypassed. The extension package is loadable, but end-to-end Brave interaction remains a manual release gate documented in `BRAVE_VERIFICATION.md`.
