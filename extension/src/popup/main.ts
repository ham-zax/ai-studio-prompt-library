import { getState, setLastUsedProfile } from '../shared/storage';
import type { Profile } from '../shared/types';
import { applyTheme, renderProfileList } from '../shared/ui-utils';

async function getActiveTabId(): Promise<number | undefined> {
  const [tab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
  return tab?.id;
}

async function sendInsert(profile: Profile) {
  const state = await getState();
  const tabId = await getActiveTabId();
  if (!tabId) return;
  await chrome.tabs.sendMessage(tabId, { type: 'INSERT_PROFILE', profile, mode: state.settings.insertMode });
  await setLastUsedProfile(profile.id);
  window.close();
}

async function main() {
  const state = await getState();
  applyTheme(state.settings.theme ?? 'auto');
  const input = document.getElementById('search') as HTMLInputElement;
  const openOptions = document.getElementById('openOptions') as HTMLAnchorElement;

  // Local mutable copy of profiles so we can refresh the list without re-querying DOM callers.
  const localState = { ...state, profiles: state.profiles.slice() };

  const refreshList = (profiles: Profile[]) => {
    const ul = document.getElementById('profile-list')!;
    const lowerQuery = input.value.toLowerCase();
    const filtered = profiles.filter(p => p.name.toLowerCase().includes(lowerQuery) || p.content.toLowerCase().includes(lowerQuery));
    renderProfileList(ul, filtered, (p) => {
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

  input.addEventListener('input', () => refreshList(localState.profiles));
  openOptions.addEventListener('click', (e) => { e.preventDefault(); chrome.runtime.openOptionsPage(); });
  refreshList(localState.profiles);

  // Listen for broadcasts and refresh the list when profiles change elsewhere.
  chrome.runtime.onMessage.addListener((msg: any, _sender: chrome.runtime.MessageSender, _sendResponse?: (response?: any) => void) => {
    if (msg?.type === 'PROFILES_UPDATED') {
      getState().then(newState => {
        localState.profiles = newState.profiles;
        refreshList(localState.profiles);
      }).catch(() => {});
    }
    return undefined;
  });
}

main();
