import { getState, setLastUsedProfile } from '../shared/storage';
import type { Profile } from '../shared/types';
import { applyTheme } from '../shared/ui-utils';

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


function renderList(profiles: Profile[], query: string) {
  const ul = document.getElementById('list')!;
  ul.innerHTML = '';
  const lowerQuery = query.toLowerCase();
  const filtered = profiles.filter(p => p.name.toLowerCase().includes(lowerQuery) || p.content.toLowerCase().includes(lowerQuery));
  filtered.forEach(p => {
    const li = document.createElement('li');
    const name = document.createElement('div');
    name.className = 'name';
    name.textContent = p.name;
    const content = document.createElement('div');
    content.className = 'content';
    content.textContent = p.content.slice(0, 300);
    const actions = document.createElement('div');
    actions.className = 'actions';
    const btn = document.createElement('button');
    btn.className = 'btn-primary';
    btn.textContent = 'Insert';
    btn.addEventListener('click', (e) => { e.stopPropagation(); sendInsert(p); });
    actions.appendChild(btn);
    li.appendChild(name);
    li.appendChild(content);
    li.appendChild(actions);
    li.addEventListener('click', () => sendInsert(p));
    ul.appendChild(li);
  });
}

async function main() {
  const state = await getState();
  applyTheme(state.settings.theme ?? 'auto');
  const input = document.getElementById('search') as HTMLInputElement;
  const openOptions = document.getElementById('openOptions') as HTMLAnchorElement;

  // Local mutable copy of profiles so we can refresh the list without re-querying DOM callers.
  const localState = { ...state, profiles: state.profiles.slice() };

  const refreshList = (profiles: Profile[]) => {
    renderList(profiles, input.value);
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
