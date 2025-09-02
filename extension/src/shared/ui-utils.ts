import type { Prompt, Settings } from './types';

export function applyTheme(theme: Settings['theme']) {
  const root = document.documentElement;
  if (theme === 'auto') {
    root.removeAttribute('data-theme');
  } else {
    root.setAttribute('data-theme', theme);
  }
}

export function renderPromptList(container: HTMLElement, prompts: Prompt[], renderActions: (prompt: Prompt) => HTMLElement, onItemClick: (prompt: Prompt) => void) {
  container.innerHTML = '';
  for (const p of prompts) {
    const li = document.createElement('li');
    li.setAttribute('data-id', p.id);

    const info = document.createElement('div');
    info.className = 'info';
    const name = document.createElement('div');
    name.className = 'name';
    name.textContent = p.name;
    const content = document.createElement('div');
    content.className = 'content';
    content.textContent = p.content.length > 200 ? p.content.slice(0, 200) + '…' : p.content;
    info.append(name, content);

    const actions = renderActions(p);

    li.append(info, actions);
    li.addEventListener('click', () => onItemClick(p));

    container.appendChild(li);
  }
}
