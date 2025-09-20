# AI Studio Prompt Library (Chrome MV3)

Save and quickly insert reusable System Prompts on Google AI Studio. Private by design. No network calls.

## Features

- **Smart Prompt Management**: Save, edit, delete prompts; import/export JSON with alphabetical sorting.
- **Most Recently Used (MRU) Sorting**: Prompts automatically sort by usage - your most recent prompts appear first.
- **Fast Access**: Popup with search + Insert and Copy functionality.
- **Comprehensive Settings**: Insert mode, theme, confirmations, auto-close panel, custom selector.
- **Improved Auto-Close**: Enhanced dialog detection for reliable auto-close after insertion.
- **Hotkeys and Context Menu**: Quick access for power users.
- **Resilient Insertion**: Layered selectors with fallback strategies for reliable prompt insertion.

## Install

From Releases (no build)

1. Download the latest release.
2. Extract.
3. Chrome → chrome://extensions → Enable Developer mode → Load unpacked → select the extracted folder (dist).

Build locally

- Install deps

```bash
pnpm i
```

- Dev (HMR via @crxjs)

```bash
pnpm dev
```

- Production build

```bash
pnpm build
```

- Load the dist folder as unpacked extension.

## Use

1. Open a chat in Google AI Studio.
2. Press Alt+Shift+1 to open the popup, search, and click Insert.
3. Or right‑click → "Open System Prompts…" or "Insert last prompt".
4. **Smart Sorting**: Your most recently used prompts will appear at the top for quick access.
5. Manage prompts and settings at chrome-extension://…/options or via toolbar → Options.

## Shortcuts

- Open popup: Alt+Shift+1
- Insert last prompt: Alt+Shift+2

## Permissions

- storage, activeTab, contextMenus
- Content script runs only on https://aistudio.google.com/*

## Development

- Tech: TypeScript, Vite, @crxjs/vite-plugin, chrome-types.
- Manifest: [extension/manifest.json](extension/manifest.json)
- Key modules: [extension/src/background/index.ts](extension/src/background/index.ts), [extension/src/content/index.ts](extension/src/content/index.ts), [extension/src/popup/main.ts](extension/src/popup/main.ts), [extension/src/options/main.ts](extension/src/options/main.ts), [extension/src/shared/storage.ts](extension/src/shared/storage.ts).

## Privacy & License

- No data leaves your browser. See [PRIVACY.md](PRIVACY.md)
- MIT License.

## Disclaimer

Not affiliated with or endorsed by Google. Do not use Google/AI Studio logos in the extension, store listing, or any promotional material. "Google" and "Google AI Studio" are trademarks of Google LLC; names are used only to indicate compatibility.


## Credits


Built by Ahmed Hamza — X/Twitter: https://x.com/ham_zax · LinkedIn: https://www.linkedin.com/in/hamzax/ · GitHub: https://github.com/ham-zax/ai-studio-prompt-library