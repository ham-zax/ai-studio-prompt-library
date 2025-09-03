import type { Prompt, Settings } from './types';

export function applyTheme(theme: Settings['theme']) {
  const root = document.documentElement;
  if (theme === 'auto') {
    root.removeAttribute('data-theme');
  } else {
    root.setAttribute('data-theme', theme);
  }
}

function createSnippet(promptContent: string, query?: string): string {
  const SNIPPET_MAX_LEN = 200;
  const defaultSnippet = promptContent.length > SNIPPET_MAX_LEN ? promptContent.substring(0, SNIPPET_MAX_LEN) + '…' : promptContent;

  const q = (query || '').trim();
  if (!q) return defaultSnippet;

  const matchIndex = promptContent.toLowerCase().indexOf(q.toLowerCase());
  // If no match in content, the match must be in the name, so use the default snippet.
  if (matchIndex === -1) return defaultSnippet;

  // Create a contextual window around the match
  const CONTEXT_BEFORE = 40; // show this many chars before the match
  const startIndex = Math.max(0, matchIndex - CONTEXT_BEFORE);
  const endIndex = Math.min(promptContent.length, startIndex + SNIPPET_MAX_LEN);

  let snippet = promptContent.substring(startIndex, endIndex);

  // Add ellipses to indicate that the snippet is a partial view
  if (startIndex > 0) snippet = '…' + snippet;
  if (endIndex < promptContent.length) snippet = snippet + '…';

  return snippet;
}
export function renderPromptList(
  container: HTMLElement,
  prompts: Prompt[],
  renderActions: (prompt: Prompt) => HTMLElement,
  onItemClick: (prompt: Prompt) => void,
  highlightQuery?: string
) {
  container.innerHTML = '';

  const q = (highlightQuery || '').trim();
  const escaped = (s: string) =>
    s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
     .replace(/"/g, '&quot;').replace(/'/g, '&#39;');

  const highlight = (text: string) => {
    if (!q) return escaped(text);
    const safeQ = q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const re = new RegExp(safeQ, 'ig');
    let lastIndex = 0;
    let result = '';
    let m: RegExpExecArray | null;
    while ((m = re.exec(text)) !== null) {
      result += escaped(text.slice(lastIndex, m.index));
      result += `<mark>${escaped(m[0])}</mark>`;
      lastIndex = re.lastIndex;
      if (re.lastIndex === m.index) re.lastIndex++; // avoid zero-length infinite loop
    }
    result += escaped(text.slice(lastIndex));
    return result;
  };

  for (const p of prompts) {
    const li = document.createElement('li');
    li.setAttribute('data-id', p.id);

    const info = document.createElement('div');
    info.className = 'info';
    const name = document.createElement('div');
    name.className = 'name';
    name.innerHTML = highlight(p.name);
    const content = document.createElement('div');
    content.className = 'content';
    const snippetText = createSnippet(p.content, highlightQuery);
    content.innerHTML = highlight(snippetText);
    info.append(name, content);

    const actions = renderActions(p);

    li.append(info, actions);
    li.addEventListener('click', () => onItemClick(p));

    container.appendChild(li);
  }
}
