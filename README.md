# Personal Contextual Spellchecker

Small local-first MVP for spelling correction. It detects likely misspellings, ranks intended-word suggestions with token similarity plus surrounding context, learns accepted corrections, persists a personal word bank, supports favorites and "never correct this", exposes definition links, and keeps personality separate from correction logic.

The "personal" part means the app learns the user's recurring misspellings, preferred corrections, private vocabulary, names, projects, nicknames, and deliberate spellings over time. It is not tied to any one workspace or subject area.

Project Context mode adds a scoped term list for the current topic or project. Those terms help the spellchecker understand names and jargon while keeping the permanent personal word bank clean.

## Run

Option 1: double-click `index.html`.

Option 2: run `.\launch.ps1`, then open the local URL it prints. It starts at `http://127.0.0.1:8765/index.html` and falls forward if that port is busy.

The launch script starts a local Python web server. It does not request elevation and does not need administrator privileges.

## Test

Open `tests.html` in a browser. The tests exercise tokenization, edit distance, known confusion correction, contextual correction, personal words, never-correct decisions, learned corrections, and diagnostic logging.

## MVP Scope

Included:

- Local browser UI for spellchecking text.
- `SpellEngine` detection and intended-word ranking.
- `SpellStore` state owner backed by `localStorage`.
- Persistent word bank with favorite and never-correct flags.
- Project Context mode with scoped project terms.
- Learned correction counts per malformed token.
- Rejection feedback that reduces confidence for repeated bad suggestions.
- Thought-level suggestion cards with one `Accept All` action per sentence or coherent thought.
- Diagnostic events stored as JSONL-compatible records.
- Export/import for state and export/clear for logs.
- Personality presentation modes, including `Popular Girl`, isolated from correction logic.
- Clickable definition action through Merriam-Webster lookup.

Not included:

- Grammar correction.
- Tone analysis.
- Grade-level analysis.
- Writing coaching.
- Generative rewriting.
- Cloud sync.

## Extension Status

`apps/extension/` contains the first Brave/Chrome Manifest V3 scaffold. It marks supported editable fields and blocks password-like inputs. The full correction UI is still in the playground until the core is extracted behind the extension adapter.

## Recovery

If saved state becomes unreadable, the app falls back to a fresh schema-v1 state and writes a `recovery.state.corrupt` diagnostic event. Logs use a separate key so state recovery does not erase observability.
