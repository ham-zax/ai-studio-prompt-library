import { getState, setLastUsedPrompt } from '../shared/storage';
import type { Prompt } from '../shared/types';
import { applyTheme, renderPromptList } from '../shared/ui-utils';

async function getActiveTabId(): Promise<number | undefined> {
  const [tab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
  return tab?.id;
}

async function sendInsert(prompt: Prompt) {
  try {
    const state = await getState();
    const tabId = await getActiveTabId();
    if (!tabId) return;
    await chrome.tabs.sendMessage(tabId, { type: 'INSERT_PROMPT', prompt, mode: state.settings.insertMode });
    await setLastUsedPrompt(prompt.id);
    window.close();
  } catch (e) {
    console.error('[AI Studio Popup] Failed to send insert message', e);
  }
}

async function main() {
  const state = await getState();
  applyTheme(state.settings.theme ?? 'auto');
  const input = document.getElementById('search') as HTMLInputElement;
  const openOptions = document.getElementById('openOptions') as HTMLAnchorElement;
  const ul = document.getElementById('prompt-list')!;

  // Local mutable copy of prompts for efficient filtering and patching
  let localPrompts = state.prompts.slice().sort((a, b) => (a.name > b.name ? 1 : -1));

  const refreshList = () => {
    const lowerQuery = input.value.toLowerCase();
    const filtered = localPrompts.filter(p => p.name.toLowerCase().includes(lowerQuery) || p.content.toLowerCase().includes(lowerQuery));
    renderPromptList(ul, filtered, (p) => {
      const actions = document.createElement('div');
      actions.className = 'actions';
      const btn = document.createElement('button');
      btn.className = 'btn-primary';
      btn.textContent = 'Insert';
      btn.addEventListener('click', (e) => { e.stopPropagation(); sendInsert(p); });
      actions.appendChild(btn);
      return actions;
    }, (p) => {
      sendInsert(p);
    });
  };

  input.addEventListener('input', refreshList);
  openOptions.addEventListener('click', (e) => { e.preventDefault(); chrome.runtime.openOptionsPage(); });

  // Initial render
  refreshList();

  // Intelligent listener: handle small, surgical updates when possible
  chrome.runtime.onMessage.addListener((msg: any, _sender: chrome.runtime.MessageSender) => {
    if (msg?.type !== 'PROMPTS_UPDATED') return;

    const detail = msg.detail as { action?: string; id?: string; count?: number } | undefined;
    if (!detail?.action) {
      // Fallback: generic update — re-fetch full state
      getState().then(newState => {
        localPrompts = newState.prompts.slice().sort((a, b) => (a.name > b.name ? 1 : -1));
        refreshList();
      }).catch((e) => console.warn('[AI Studio Popup] failed to refresh state', e));
      return;
    }

    switch (detail.action) {
      case 'added':
      case 'updated':
        // Re-sync full prompts list to guarantee consistency for edits/adds
        getState().then(s => {
          localPrompts = s.prompts.slice().sort((a,b) => a.name > b.name ? 1 : -1);
          refreshList();
        }).catch((e) => console.warn('[AI Studio Popup] failed to reload prompts', e));
        break;
      case 'deleted':
        if (detail.id) {
          localPrompts = localPrompts.filter(p => p.id !== detail.id);
          refreshList();
        } else {
          // Unknown id — fallback to full refresh
          getState().then(newState => {
            localPrompts = newState.prompts.slice().sort((a, b) => (a.name > b.name ? 1 : -1));
            refreshList();
          }).catch((e) => console.warn('[AI Studio Popup] failed to refresh after delete', e));
        }
        break;
      case 'imported':
      case 'initialized':
        // Bulk change — full refresh
        getState().then(newState => {
          localPrompts = newState.prompts.slice().sort((a, b) => (a.name > b.name ? 1 : -1));
          refreshList();
        }).catch((e) => console.warn('[AI Studio Popup] failed to refresh after import', e));
        break;
      default:
        // Unknown action — full refresh for safety
        getState().then(newState => {
          localPrompts = newState.prompts.slice().sort((a, b) => (a.name > b.name ? 1 : -1));
          refreshList();
        }).catch((e) => console.warn('[AI Studio Popup] failed to refresh (unknown action)', e));
    }
    return undefined;
  });
}

main();
