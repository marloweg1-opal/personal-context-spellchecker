# Architecture

Version: 0.4.0

## Component Boundaries

- `SpellEngine`: pure-ish correction logic. It owns token analysis, dictionary checks, candidate generation, edit-distance scoring, context bonuses, and learned-correction weighting.
- `SpellStore`: the only owner of mutable user state. It persists the personal word bank, proper nouns, acronyms, favorite flags, never-correct flags, learned correction counts, rejection counts, and typo-pattern counters.
- `ProperNounBank`: global preferred capitalization for names, signs, systems, and concepts that should not depend on the active project.
- `ContextProfile`: a named scoped vocabulary layer for a writing topic or project. It stores terms as relevant or irrelevant so the active context can boost or suppress suggestions without becoming permanent personal vocabulary.
- `AcronymBank`: topic-categorized acronym entries with expansion text. The correction engine may use acronyms for preferred casing, while the UI owns the explicit expansion action.
- `DiagnosticLog`: append-style event log with capped local retention and JSONL export.
- `Presenter`: personality layer. It formats suggestion copy only; it never changes detection, ranking, confidence, or accepted correction data.
- `AppController`: DOM glue. It translates clicks into store/engine operations and renders current state.
- `ThoughtGrouping`: pure helper functions that group correction decisions by sentence or coherent thought and apply grouped replacements without mutating state.

## Required Architecture Concerns

1. Maintainability: components are class-based and have explicit responsibilities. The seed dictionary, confusion pairs, and context hints are plain data that can later be replaced by richer providers.
2. Testability: `tests.html` can instantiate the engine/store/log directly. The correction engine is isolated from DOM rendering.
3. State ownership: only `SpellStore` writes user learning state, proper nouns, acronyms, and context profiles. The app never lets presentation modes mutate correction logic.
4. Dependency boundaries: no runtime dependencies in v0.1.0. Future dictionaries, NLP models, or sync services should be adapters behind `SpellEngine` or `SpellStore`.
5. Logs / observability: every check, accepted correction, word-bank change, definition action, export, reset, and recovery path writes a structured event with app version and timestamp.
6. Recovery: state parsing and import are guarded. Corrupt or incompatible state falls back to a fresh schema or restores the prior snapshot and logs the recovery event.
7. Source control: this app lives in `personal-contextual-spellchecker/` so its history can stay focused and it can be extracted into its own repository when it graduates past prototype.
8. Versioning: `APP_VERSION` and `schemaVersion` are persisted with state and logs. Any future migration should branch on `schemaVersion`.
9. Performance: candidate scoring is bounded by a compact seed dictionary and local word bank. Logs are capped at 200 events. Large dictionaries should use indexed lookup or a worker.
10. Deployment: static files can be served from any basic file host or opened directly from disk. `launch.ps1` starts a non-elevated local server. `apps/extension/` is the Manifest V3 target.
11. Security: all state stays local unless the user exports it. Rendered dynamic text is escaped. Definition lookup is opened with `noopener`. No remote scripts are loaded.

## Suggestion Layer

Suggestions are rendered as one card per sentence or coherent thought. Each card has one `Accept All` action that applies every correction in that thought, while preserving individual accept/reject/dictionary/never-correct controls for precise review.

## Extension Points

- Replace `SEED_WORDS` with a compressed dictionary adapter.
- Add a context provider that scores candidates from sentence embeddings or n-gram frequencies.
- Add a sync adapter to `SpellStore` while keeping local-first recovery.
- Add named context profiles beyond the MVP `Personal` and `Project Context` modes.
- Add richer topic detection that automatically chooses a context profile from surrounding text.
- Add acronym import/export helpers for larger personal glossaries.
- Add definition providers behind a `DefinitionService` instead of direct lookup URLs.
- Add more personalities by extending `Presenter` only.
- Move expensive candidate scoring into a Web Worker when dictionary size grows.
- Extract the browser playground engine into package modules before wiring the extension correction UI, preserving one correction engine.

## Diagnostic Event Examples

```json
{"type":"check.completed","payload":{"tokenCount":12,"issueCount":2,"textLength":74}}
{"type":"correction.accepted","payload":{"from":"defintely","to":"definitely","pattern":"missing-character"}}
{"type":"word.never_correct","payload":{"word":"teh"}}
```
