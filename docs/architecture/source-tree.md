# AI Studio Prompt Library — Source Tree and Module Map

This document maps the Chrome MV3 extension codebase and module responsibilities.

## Top-level structure

- [package.json](package.json)
- [vite.config.ts](vite.config.ts)
- [tsconfig.json](tsconfig.json)
- [extension/manifest.json](extension/manifest.json)
- extension/icons/ (icons)
- extension/src/ (source)

## Source tree

```plaintext
extension/
├── manifest.json
├── icons/
└── src/
    ├── background/
    │   └── index.ts
    ├── content/
    │   └── index.ts
    ├── popup/
    │   ├── index.html
    │   └── main.ts
    ├── options/
    │   ├── index.html
    │   └── main.ts
    └── shared/
        ├── chrome-utils.ts
        ├── messages.ts
        ├── storage.ts
        ├── types.ts
        ├── ui-utils.ts
        └── ui.css
```

## Module responsibilities

- [extension/src/background/index.ts](extension/src/background/index.ts): Chrome service worker; initializes storage, builds context menus; listens to commands and context menu clicks; orchestrates prompt insertion via tab messaging.
- [extension/src/content/index.ts](extension/src/content/index.ts): Content script injected on aistudio.google.com; locates System Instructions field; handles INSERT_PROMPT; optional confirmation modal; applies insert and panel open/close.
- [extension/src/popup/index.html](extension/src/popup/index.html) and [extension/src/popup/main.ts](extension/src/popup/main.ts): Popup UI; search/filter prompts; Insert and Copy actions; theme apply; listens for PROMPTS_UPDATED for efficient refresh; closes on modal request.
- [extension/src/options/index.html](extension/src/options/index.html) and [extension/src/options/main.ts](extension/src/options/main.ts): Options UI; CRUD prompts with dialog; settings controls; import/export JSON; broadcasts updates.
- [extension/src/shared/storage.ts](extension/src/shared/storage.ts): Storage layer; defaults; initializeStorage; getState; upsertPrompt; deletePrompt; setLastUsedPrompt; setSettings; exportJson; importJson; broadcasts PROMPTS_UPDATED granular actions.
- [extension/src/shared/types.ts](extension/src/shared/types.ts): Core types for Prompt, Settings, StorageSchema; InsertMode, Theme.
- [extension/src/shared/messages.ts](extension/src/shared/messages.ts): Runtime message contracts: INSERT_PROMPT, PROMPTS_UPDATED, SHOW_CONFIRMATION_MODAL; union RuntimeMessage.
- [extension/src/shared/ui-utils.ts](extension/src/shared/ui-utils.ts): UI helpers: applyTheme; renderPromptList with search highlighting and snippet.
- [extension/src/shared/chrome-utils.ts](extension/src/shared/chrome-utils.ts): Promise-wrapped Chrome contextMenus helpers with duplicate-id tolerance.
- [extension/src/shared/ui.css](extension/src/shared/ui.css): Shared styling, themes, popup/option specific styles, button variants.
- [extension/manifest.json](extension/manifest.json): MV3 manifest; permissions: storage, activeTab, contextMenus; background service worker; content script match; commands.

## Message flow

- Background to Content: send [INSERT_PROMPT](extension/src/shared/messages.ts) on context menu or command; content applies and sets last used.
- Popup to Content: send [INSERT_PROMPT](extension/src/shared/messages.ts) and then close popup.
- Content to Popup: request [SHOW_CONFIRMATION_MODAL](extension/src/shared/messages.ts) to have popup close before showing overwrite modal.
- Storage to Views: [PROMPTS_UPDATED](extension/src/shared/messages.ts) broadcast with detail to let popup/options refresh efficiently.

## Data model

- Prompt: id, name, content, optional tags, favorite, createdAt, updatedAt. See [types.ts](extension/src/shared/types.ts).
- Settings: insertMode, showContextMenu, theme, confirmOverwriteSystem, confirmDeletePrompt?, autoClosePanel?, customSelector?. See [types.ts](extension/src/shared/types.ts).
- Storage split: prompts in chrome.storage.local under prompt_*; settings and lastUsedPromptId in chrome.storage.sync. See [storage.ts](extension/src/shared/storage.ts).

## Build and tooling

- Vite + @crxjs plugin build. See [package.json](package.json) and [vite.config.ts](vite.config.ts).
- TypeScript project config. See [tsconfig.json](tsconfig.json).

## Known constraints

- Content script runs only on https://aistudio.google.com/* per [manifest.json](extension/manifest.json).
- No tabs permission; relies on activeTab and user gesture.
- Avoids chrome.storage.sync per-item quota by storing prompts in local storage.

## Opportunities

- Unit tests for storage and utils.
- E2E tests with Playwright to validate insertion logic against DOM changes.
- Optional backup/restore and tagging UX enhancements.