import { getState, setLastUsedPrompt } from '../shared/storage';
import type { Prompt } from '../shared/types';
import { applyTheme, renderPromptList } from '../shared/ui-utils';

async function getActiveTabId(): Promise<number | undefined> {
  const [tab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
  return tab?.id;
}

async function sendInsert(prompt: Prompt, sourceBtn?: HTMLButtonElement) {
  try {
    const state = await getState();
    const tabId = await getActiveTabId();
    if (!tabId) return;
    await chrome.tabs.sendMessage(tabId, { type: 'INSERT_PROMPT', prompt, mode: state.settings.insertMode });
    await setLastUsedPrompt(prompt.id);

    if (sourceBtn) {
      const original = sourceBtn.textContent;
      sourceBtn.disabled = true;
      sourceBtn.textContent = 'Inserted ✔';
      // brief visual confirmation before closing
      await new Promise((res) => setTimeout(res, 300));
    }

    window.close();
  } catch (e) {
    console.error('[AI Studio Popup] Failed to send insert message', e);
    if (sourceBtn) {
      sourceBtn.disabled = false;
      sourceBtn.textContent = 'Insert';
    }
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
      btn.addEventListener('click', (e) => { e.stopPropagation(); sendInsert(p, btn); });
      actions.appendChild(btn);

      const copyBtn = document.createElement('button');
      copyBtn.className = 'copy-btn';
      // Inline SVG icon provided by user (Material Symbols - small square)
      copyBtn.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24"><path fill="currentColor" d="M9 18q-.825 0-1.412-.587T7 16V4q0-.825.588-1.412T9 2h9q.825 0 1.413.588T20 4v12q0 .825-.587 1.413T18 18zm0-2h9V4H9zm-4 6q-.825 0-1.412-.587T3 20V7q0-.425.288-.712T4 6t.713.288T5 7v13h10q.425 0 .713.288T16 21t-.288.713T15 22zm4-6V4z"/></svg>';
      copyBtn.setAttribute('aria-label', 'Copy prompt content');
      copyBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        // Use Clipboard API with graceful fallback handling
        const svgIcon = copyBtn.innerHTML;
        navigator.clipboard?.writeText(p.content).then(() => {
          copyBtn.textContent = 'Copied';
          setTimeout(() => { copyBtn.innerHTML = svgIcon; }, 1000);
        }).catch(() => {
          copyBtn.textContent = 'Err';
          setTimeout(() => { copyBtn.innerHTML = svgIcon; }, 1000);
        });
      });
      actions.appendChild(copyBtn);

      return actions;
    }, (p) => {
      // Clicking the item itself inserts; try to provide the same visual feedback by finding the primary button
      const btn = ul.querySelector(`li[data-id="${p.id}"] .actions button.btn-primary`) as HTMLButtonElement | null;
      sendInsert(p, btn ?? undefined);
    }, input.value);
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
