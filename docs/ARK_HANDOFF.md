# ARK Handoff: Personal Contextual Spellchecker MVP

Date: 2026-09-02

## Current State

The app is a local-first browser MVP for personal spellchecking. It is not Grammarly, not a grammar coach, and not a rewriting tool. Its current job is to detect likely misspellings, infer intended words, learn accepted corrections, preserve personal vocabulary, and use topic/project context to decide which terms are relevant.

Latest release tag: `v0.4.2`

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

## Grep vs rg

`grep` and `rg` are search tools. They find occurrences of text in files.

`rg` means ripgrep. It is usually faster and friendlier for codebases, so prefer `rg` for repository searches.

Examples:

```powershell
rg "Runevale"
rg "localStorage" src tests.html docs
rg -n "preferredSpelling|contextProfiles" src/app.js
```

Occurrence means “the string appears here.”

Context means “what that occurrence means in the surrounding code or document.”

For example, `rg "teh"` can show that `teh` appears in tests, seed corrections, and docs. That only proves occurrence. To understand context, read the surrounding function or section and ask why it is there: fixture data, a real correction rule, a changelog entry, or a diagnostic example.

Use `rg` to find places quickly. Use code reading to decide whether each place matters.

## Current Audit Result

Browser smoke tests pass: 35 checks after personality removal.

No console errors were observed in the last browser test run.

Known deferred work:

- Real-time autocorrect should be guarded by high confidence, visual marking, and undo.
- Extension scaffold exists, but the correction UI is not wired into Brave/Chrome yet.
- Large dictionary support should move behind an indexed adapter or worker.
- Acronym expansion is useful but still basic.

## Next Reasonable Steps

1. Add deletion/edit controls for proper nouns, context terms, and acronyms.
2. Add a visible change history panel before building real-time autocorrect.
3. Add real-time autocorrect for only known high-confidence mappings.
4. Mark auto-applied changes with a highlight or asterisk.
5. Add one-click undo for each automatic correction.
6. Extract core spellchecker modules before wiring the browser extension UI.
7. Expand the seed dictionary carefully through fixtures from the user's real misspellings.
8. Add import/export for acronym and proper-noun banks.
9. Add topic auto-detection only after manual topic mode feels reliable.
10. Cut the next release tag after the next meaningful batch.
