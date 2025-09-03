# AI Studio Prompt Library — Product Requirements Document (As‑Is v0.2)

Project: Chrome MV3 extension to save and insert reusable System Prompts on Google AI Studio.

Repository/Homepage: https://github.com/ham-zax/ai-studio-prompt-library

Version: 0.2

## Change Log

| Date       | Version | Description                               | Author            |
|------------|---------|-------------------------------------------|-------------------|
| 2025-09-03 | 0.2     | Initial PRD created from codebase mapping | BMad Orchestrator |

## Goals

- Save and manage reusable System Prompts with CRUD and import/export.
- Quickly insert a selected prompt into AI Studio’s System instructions field.
- Provide keyboard shortcuts and context menu for fast access.
- Remain private: store data locally/sync, no network calls.
- Be resilient to AI Studio DOM changes; provide custom selector escape hatch.
- Provide a simple, consistent UI (popup + options) with theme support.

## Background Context

Users working in Google AI Studio often reuse “System instructions”. Re‑typing or copy/paste slows workflow. A lightweight MV3 extension centralizes prompt management and enables one‑click insertion, respecting page constraints and privacy.

## Requirements

### Functional (FR)

- FR1: Create a prompt with id, name, and content persisted to chrome.storage.local (key prefix prompt_).
- FR2: Update an existing prompt; preserve createdAt; bump updatedAt.
- FR3: Delete a prompt; if deleted prompt is lastUsedPromptId, pick a new default.
- FR4: List prompts sorted by name in popup and options views.
- FR5: Search prompts by name/content with highlighted matches and content snippets.
- FR6: Insert selected prompt into AI Studio System instructions with mode replace|append|prepend.
- FR7: If replacing non‑empty field and confirmOverwriteSystem is true, show confirmation modal.
- FR8: Auto‑open the System instructions panel if needed; optionally auto‑close if enabled.
- FR9: Provide context menu items: Open System Prompts…, Insert last prompt (scoped to aistudio.google.com).
- FR10: Provide commands: open_palette, insert_last_prompt with default hotkeys.
- FR11: Track and update lastUsedPromptId when inserting.
- FR12: Import/Export prompts and settings as JSON; safe‑guard empty imports unless force.
- FR13: Broadcast PROMPTS_UPDATED with detail to refresh open views efficiently.
- FR14: Popup supports Insert action and Copy to clipboard action.
- FR15: Options supports create/edit via modal dialog with Cancel/Save.
- FR16: Settings include insertMode, showContextMenu, theme, confirmOverwriteSystem, confirmDeletePrompt, autoClosePanel, customSelector.
- FR17: Rebuild context menus when settings change or on install/startup.

### Non‑Functional (NFR)

- NFR1: MV3‑compliant service worker and permissions: storage, activeTab, contextMenus.
- NFR2: No remote network usage; all data local/sync; privacy by design.
- NFR3: Performance: UI renders under 100ms for 200 prompts; insertion under 100ms after user action.
- NFR4: Resilience to DOM drift with multiple selectors and fallbacks; manual override via custom selector.
- NFR5: Accessibility: keyboard navigable UI controls; sufficient contrast in both themes.
- NFR6: Security: no dynamic code injection; content_scripts limited to https://aistudio.google.com/*; no tabs permission beyond activeTab.
- NFR7: Build reproducibility via Vite + @crxjs; pinned TypeScript and vite versions; esbuild >= 0.25 override.

## User Interface Goals

- Popup: fast search, Insert primary action, Copy secondary, closes on success.
- Options: compact CRUD with dialog, import/export, settings grouped, live theme application.

## Technical Assumptions

- Repository Structure: single repo, Vite build outputs dist for “Load unpacked”.
- Architecture: single MV3 extension with background service worker, content script, popup, options.
- Testing: unit tests for storage/ui-utils and E2E for insertion are desirable; not yet implemented.

## Epics (Future Work)

- Epic 1: Test Coverage & CI — add unit tests, E2E flows, and a minimal CI to run builds and tests.
- Epic 2: UX Enhancements — tagging/favorites, better list management, multi‑device settings sync options.
- Epic 3: Robustness — proactive DOM probing/adapters, telemetry-free error logging surface for debugging.