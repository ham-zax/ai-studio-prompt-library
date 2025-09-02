import type { Prompt } from '../shared/types';
import { getState, setLastUsedPrompt } from '../shared/storage';
import { pRemoveAllContextMenus, pCreateContextMenu } from '../shared/chrome-utils';

// Ensure context menu rebuilds don't overlap (which can cause duplicate-id errors)
let rebuildInFlight: Promise<void> | null = null;

// Context Menus
async function rebuildContextMenus() {
  if (rebuildInFlight) return rebuildInFlight;
  rebuildInFlight = (async () => {
    try {
      const state = await getState();
      await pRemoveAllContextMenus();
      if (!state.settings.showContextMenu) return;

      await pCreateContextMenu({
        id: 'open_prompts',
        title: 'Open System Prompts…',
        contexts: ['all'],
        documentUrlPatterns: ['https://aistudio.google.com/*']
      });

      await pCreateContextMenu({
        id: 'insert_last_prompt',
        title: 'Insert last prompt',
        contexts: ['all'],
        documentUrlPatterns: ['https://aistudio.google.com/*']
      });
    } catch (e) {
      console.warn('contextMenus setup error', e);
    } finally {
      rebuildInFlight = null;
    }
  })();
  return rebuildInFlight;
}

chrome.runtime.onInstalled.addListener(async () => { await rebuildContextMenus(); });
chrome.runtime.onStartup.addListener(async () => { await rebuildContextMenus(); });

chrome.storage.onChanged.addListener((changes: { [key: string]: chrome.storage.StorageChange }, areaName: string) => {
  if (areaName !== 'sync') return;
  if (changes.settings) {
    rebuildContextMenus();
  }
});

chrome.contextMenus.onClicked.addListener(async (info: chrome.contextMenus.OnClickData, tab?: chrome.tabs.Tab) => {
  if (!tab?.id) return;
  if (info.menuItemId === 'open_prompts') {
    try {
      await chrome.action.openPopup();
    } catch {
      // fallback: open options
      chrome.runtime.openOptionsPage();
    }
  } else if (info.menuItemId === 'insert_last_prompt') {
    await insertLastPromptIntoTab(tab.id);
  }
});

chrome.commands.onCommand.addListener(async (command: string) => {
  const [tab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
  if (!tab?.id) return;
  if (command === 'open_palette') {
    try {
      await chrome.action.openPopup();
    } catch (e) {
      console.warn('openPopup failed', e);
    }
  } else if (command === 'insert_last_prompt') {
    await insertLastPromptIntoTab(tab.id);
  }
});

async function insertLastPromptIntoTab(tabId: number) {
  const state = await getState();
  const prompt = state.prompts.find(p => p.id === state.lastUsedPromptId) || state.prompts[0];
  if (!prompt) return;
  await sendInsertMessage(tabId, prompt, state.settings.insertMode);
}

async function sendInsertMessage(tabId: number, prompt: Prompt, mode?: 'replace'|'append'|'prepend') {
  try {
    await chrome.tabs.sendMessage(tabId, { type: 'INSERT_PROMPT', prompt: prompt, mode });
    await setLastUsedPrompt(prompt.id);
  } catch (e) {
    // If this fails, the content script may not be available on the page.
    console.error('Failed to insert prompt (content script unavailable?)', e);
  }
}
