# ARK Handoff: Personal Contextual Spellchecker MVP

Date: 2026-10-16

## Current State

The app is a local-first browser MVP for personal spellchecking. It is not Grammarly, not a grammar coach, and not a rewriting tool. Its current job is to detect likely misspellings, infer intended words, learn accepted corrections, preserve personal vocabulary, and use topic/project context to decide which terms are relevant.

Current application version: `0.5.0` on `main`. Latest release tag before this browser-integration milestone: `v0.4.2`.

Current `main` is ahead of that release tag with normal checkpoint commits for audit documentation and MVP cleanup. Do not create a new release tag until roughly 10 meaningful changes accumulate, unless a user-visible bugfix or demo milestone needs a release.

## Locations

- Working source: `C:\Users\Junior\Documents\ChatGPT\Personal Spellchecker MVP`
- Durable active source: `R:\Projects\PersonalSpellchecker\01_Active_Source\Personal Contextual Spellchecker`
- Latest release snapshot: `R:\Projects\PersonalSpellchecker\02_Releases\v0.4.2`
- GitHub: `https://github.com/marloweg1-opal/personal-context-spellchecker`

## What Exists

- Static browser app launched by `launch.ps1`.
- `SpellEngine` for detection, candidate scoring, context scoring, and preferred casing.
- `SpellStore` as the only mutable state owner.
- Persistent local state via browser `localStorage`.
- Personal word bank with favorite and never-correct behavior.
- Global proper nouns for preferred capitalization.
- Topic/project context banks with relevant and irrelevant terms.
- Acronym bank grouped by topic with expansion action.
- Thought-level suggestion grouping with one `Accept All` per sentence/coherent thought.
- Diagnostic logs with privacy-aware event payloads.
- Smoke tests in `tests.html` using isolated in-memory storage.
- Functional Brave/Chrome Manifest V3 extension with thought-grouped suggestions in active supported fields.
- Extension-local persistence, localhost state migration, state import/export, context selection, and reversible site opt-out.

## Recent Corrections

- Removed personality modes from the MVP because they were underdeveloped placeholders.
- Fixed test/live storage contamination. Tests previously used real `localStorage`, which caused fixture words like `Runevale` and `teh` to appear in the live word bank.
- Added narrow startup cleanup for those known leaked fixtures when their metadata matches the old test signatures.
- Added misspelling coverage for `occurrence`, `relevant`, `irrelevant`, and `mini_ark`.

## Important Design Rule

Personal, proper-noun, acronym, and topic/project state are separate on purpose.

- Personal word bank: words the user wants accepted broadly.
- Proper nouns: global preferred capitalization, such as `Libra`.
- Topic/project banks: context modifiers, not ownership of facts. They make terms relevant or irrelevant while that context is active.
- Acronyms: topic-categorized short forms and their expansion text.

Example: `Libra` is a global proper noun. It does not become a HEXSEED or Project ARK term unless the user deliberately adds it there. `mini_ark` and `Project ARK` are better examples of scoped context.

## Current Audit Result

The previous browser smoke suite passed 35 checks after personality removal. Version 0.5.0 adds extension adapter and privacy regression coverage; rerun `tests.html` and the disposable extension fixture before release.

No console errors were observed in the last browser test run.

Known deferred work:

- Real-time autocorrect should be guarded by high confidence, visual marking, and undo.
- Complex rich-text editors may need dedicated adapters; the vertical slice targets plain contenteditable fields.
- Host access is currently declared for HTTP/HTTPS pages; optional per-site permissions are a future hardening step.
- Large dictionary support should move behind an indexed adapter or worker.
- Acronym expansion is useful but still basic.

## Next Reasonable Steps

1. Verify and document one real-world contenteditable adapter beyond the disposable fixture.
2. Add deletion/edit controls for proper nouns, context terms, and acronyms.
3. Add a visible change history panel before building real-time autocorrect.
4. Move broad host matching to an optional per-site permission workflow.
5. Define a narrow Journey interface for approved configuration and learning state only.
