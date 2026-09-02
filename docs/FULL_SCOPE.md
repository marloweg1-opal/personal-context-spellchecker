# Full Scope Guardrails

This project is a spellchecker. Its north star is: what word was this person trying to spell?

## v0.1 Finish Line

- Launchable local playground.
- Correction core that can rank `I've had enoweg of this.` as `enough`.
- Accept/reject correction feedback.
- Persistent personal words.
- Favorite words.
- Never-correct rules.
- Project Context vocabulary that does not pollute the permanent personal word bank.
- Privacy-safe diagnostics.
- State export/import.
- Personality presentation modes that cannot alter correction decisions.

## Extension Track

The first browser extension target is Brave/Chrome Manifest V3. It should support:

- `textarea`
- ordinary text inputs
- basic `contenteditable`

It must not process:

- password fields
- one-time-code fields
- credit-card-like fields
- incognito contexts by default

## Non-Goals

- Grammar correction
- Tone analysis
- Readability scoring
- Rewriting
- Autocomplete
- Writing coaching
- Document summarization

## Launch Model

This is a launchable local web app first, with an extension scaffold for later packaging. It is not an elevated script and should not need administrator privileges.

Use `launch.ps1` only as a convenience launcher for the local playground server.
