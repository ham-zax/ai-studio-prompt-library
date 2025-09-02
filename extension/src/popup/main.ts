import { getState, setLastUsedPrompt } from '../shared/storage';
import type { Prompt } from '../shared/types';
import { applyTheme, renderPromptList } from '../shared/ui-utils';

async function getActiveTabId(): Promise<number | undefined> {
  const [tab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
  return tab?.id;
}

async function sendInsert(prompt: Prompt) {
  const state = await getState();
  const tabId = await getActiveTabId();
  if (!tabId) return;
  await chrome.tabs.sendMessage(tabId, { type: 'INSERT_PROMPT', prompt, mode: state.settings.insertMode });
  await setLastUsedPrompt(prompt.id);
  window.close();
}

async function main() {
  const state = await getState();
  applyTheme(state.settings.theme ?? 'auto');
  const input = document.getElementById('search') as HTMLInputElement;
  const openOptions = document.getElementById('openOptions') as HTMLAnchorElement;

  // Local mutable copy of prompts so we can refresh the list without re-querying DOM callers.
  const localState = { ...state, prompts: state.prompts.slice() };
  
  const refreshList = (prompts: Prompt[]) => {
    const ul = document.getElementById('prompt-list')!;
    const lowerQuery = input.value.toLowerCase();
    const filtered = prompts.filter(p => p.name.toLowerCase().includes(lowerQuery) || p.content.toLowerCase().includes(lowerQuery));
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

  input.addEventListener('input', () => refreshList(localState.prompts));
  openOptions.addEventListener('click', (e) => { e.preventDefault(); chrome.runtime.openOptionsPage(); });
  refreshList(localState.prompts);

  // Listen for broadcasts and refresh the list when prompts change elsewhere.
  chrome.runtime.onMessage.addListener((msg: any, _sender: chrome.runtime.MessageSender, _sendResponse?: (response?: any) => void) => {
    if (msg?.type === 'PROMPTS_UPDATED') {
      getState().then(newState => {
        localState.prompts = newState.prompts;
        refreshList(localState.prompts);
      }).catch(() => {});
    }
    return undefined;
  });
}

main();
