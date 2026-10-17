# Brave Extension Verification

The automated suite validates the engine and writing-surface adapter. Final release verification still requires a human-run unpacked-extension check in Brave because browser automation could not safely identify the disposable Brave window URL.

## Load the unpacked extension

1. Run `npm run sync:extension` from the repository root.
2. Run `./launch.ps1` and keep that PowerShell window open.
3. Open `brave://extensions` in Brave.
4. Turn on **Developer mode**.
5. Choose **Load unpacked**.
6. Select `C:\Users\Junior\Documents\ChatGPT\Personal Spellchecker MVP\apps\extension`.
7. Confirm **Personal Contextual Spellchecker** appears without an error badge.
8. Open the `extension-demo.html` URL printed by `launch.ps1`. The normal URL is `http://127.0.0.1:8765/extension-demo.html`; use the printed port if 8765 was busy.

## Verify the vertical slice

1. Click the textarea containing `enoweg`, `defintely`, and `recieve`.
2. Confirm one suggestion panel appears and groups the corrections by sentence/thought.
3. Choose **Accept all** for the first thought and confirm all corrections in that thought are applied without replacing unrelated text.
4. Click the ordinary text input and accept one correction individually.
5. Click the contenteditable fixture and accept `recieved` to `received`; confirm the surrounding text remains intact.
6. Click the password fixture and confirm no suggestion panel appears.
7. Reject a suggestion, type the same misspelling again, and confirm the extension remains usable.
8. Choose **Never correct** for a disposable test word, type it again, and confirm it is no longer offered.
9. Reload the page and confirm accepted/never-correct learning still applies.
10. Open the extension toolbar popup, disable the current site, and confirm suggestions stop. Reopen the popup, enable the site, and confirm suggestions return.

## Verify personal state

1. In the toolbar popup, confirm the active-context selector lists the stored contexts.
2. Choose a context and confirm the selection persists after closing and reopening the popup.
3. Export personal state and confirm a JSON file downloads.
4. Do not commit or upload that exported state file; it may contain private vocabulary and learning history.

## Known limitations

- Plain contenteditable regions are supported. Complex editors such as Google Docs, canvas-based editors, virtualized editors, and editors with custom document models may require dedicated adapters.
- Cross-origin frames are not part of this milestone.
- The extension declares HTTP/HTTPS page access so it can work while typing. It reads only the active supported editing surface and does not scan unrelated page text.
- Corrections remain explicit. The extension does not silently autocorrect.

## Rollback

Open `brave://extensions` and remove **Personal Contextual Spellchecker**. Export personal state first if it needs to be retained. Removing the unpacked extension can remove its extension-local storage.
