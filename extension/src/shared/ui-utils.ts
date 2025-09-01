import type { Settings } from './types';

export function applyTheme(theme: Settings['theme']) {
  const root = document.documentElement;
  if (theme === 'auto') {
    root.removeAttribute('data-theme');
  } else {
    root.setAttribute('data-theme', theme);
  }
}
