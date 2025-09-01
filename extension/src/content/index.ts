import type { RuntimeMessage } from '../shared/messages';
import type { InsertMode, Settings } from '../shared/types';
import { getState, setSettings } from '../shared/storage';

function isTextarea(el: Element | null): el is HTMLTextAreaElement {
  return !!el && el.tagName.toLowerCase() === 'textarea';
}

function isEditable(el: Element | null): el is HTMLElement {
  if (!el) return false;
  const t = el.tagName?.toLowerCase();
  if (t === 'textarea') return true;
  if (t === 'input' && (el as HTMLInputElement).type === 'text') return true;
  if ((el as HTMLElement).isContentEditable) return true;
  if (el.getAttribute('role') === 'textbox') return true;
  return false;
}

function isVisible(el: Element | null): boolean {
  if (!el) return false;
  const node = el as HTMLElement;
  if (node.hidden) return false;
  const style = window.getComputedStyle(node);
  if (style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0') return false;
  if (node.getClientRects().length === 0) return false;
  return true;
}

/**
 * Non-disruptive on-page toast for error feedback in the host page.
 */
function showErrorToast(message: string) {
  try {
    const toast = document.createElement('div');
    toast.textContent = message;
    Object.assign(toast.style, {
      position: 'fixed',
      bottom: '20px',
      left: '50%',
      transform: 'translateX(-50%)',
      background: '#c53030',
      color: 'white',
      padding: '12px 20px',
      borderRadius: '8px',
      boxShadow: '0 4px 12px rgba(0,0,0,0.2)',
      zIndex: '2147483647',
      fontSize: '14px',
      fontFamily: 'system-ui, sans-serif',
      opacity: '0',
      transition: 'opacity 0.3s ease, bottom 0.3s ease',
    });
    document.body.appendChild(toast);
    // Fade in and slide up
    setTimeout(() => {
      toast.style.opacity = '1';
      toast.style.bottom = '30px';
    }, 10);
    // Fade out and remove
    setTimeout(() => {
      toast.style.opacity = '0';
      toast.addEventListener('transitionend', () => toast.remove());
    }, 4000);
  } catch {
    // If any error occurs, silently ignore to avoid breaking the host page.
  }
}

function looksLikeMainPrompt(el: Element): boolean {
  return !!(el.closest('.prompt-input-wrapper-container'));
}

function findSystemTextarea(settings: Settings | undefined, root: ParentNode = document): HTMLTextAreaElement | null {
  // 1. User-provided override (escape hatch)
  if (settings?.customSelector) {
    try {
      const customEl = root.querySelector(settings.customSelector);
      if (customEl && !looksLikeMainPrompt(customEl) && isVisible(customEl)) return customEl as HTMLTextAreaElement;
    } catch {
      // Invalid selector provided by user; ignore and continue to fallbacks
    }
  }

  // 2. Most stable: aria-label in EN
  let el = root.querySelector('textarea[aria-label="System instructions"]');
  if (el && !looksLikeMainPrompt(el) && isVisible(el)) return el as HTMLTextAreaElement;

  // 3. Fallback: placeholder text observed
  el = root.querySelector('textarea[placeholder="Optional tone and style instructions for the model"]');
  if (el && !looksLikeMainPrompt(el) && isVisible(el)) return el as HTMLTextAreaElement;

  // 4. Fallback: class hints from probe
  el = root.querySelector('textarea.cdk-textarea-autosize.textarea.toolbar-expand-textarea');
  if (el && !looksLikeMainPrompt(el) && isVisible(el)) return el as HTMLTextAreaElement;

  // 5. Final, broad fallback: any visible textarea that is NOT the main prompt
  const allTextareas = Array.from(root.querySelectorAll('textarea'));
  const candidate = allTextareas.find(e => isVisible(e) && !looksLikeMainPrompt(e));
  return (candidate as HTMLTextAreaElement) || null;
}

function applyInsert(target: HTMLTextAreaElement | HTMLElement, text: string, mode: InsertMode = 'replace') {
  if (isTextarea(target)) {
    const ta = target as HTMLTextAreaElement;
    const prev = ta.value;
    let next = text;
    if (mode === 'append') next = prev ? prev + (prev.endsWith('\n') ? '' : '\n') + text : text;
    if (mode === 'prepend') next = text + (text.endsWith('\n') ? '' : '\n') + prev;
    ta.focus();
    ta.value = next;
    ta.setSelectionRange(ta.value.length, ta.value.length);
    ta.dispatchEvent(new Event('input', { bubbles: true }));
    ta.dispatchEvent(new Event('change', { bubbles: true }));
  } else {
    // contenteditable/role=textbox fallback
    const el = target as HTMLElement;
    const prev = el.innerText || '';
    let next = text;
    if (mode === 'append') next = prev ? prev + (prev.endsWith('\n') ? '' : '\n') + text : text;
    if (mode === 'prepend') next = text + (text.endsWith('\n') ? '' : '\n') + prev;
    el.focus();
    el.innerText = next;
    el.dispatchEvent(new Event('input', { bubbles: true }));
  }
}

async function handleInsertAsync(text: string, mode: InsertMode = 'replace') {
  // Load current settings early
  const state = await getState();

  // Ensure system instructions panel is open if needed
  await openSystemPanelIfNeeded(state.settings);

  let target: HTMLElement | null = findSystemTextarea(state.settings);
  if (!target || !isEditable(target)) {
    // Fallback: currently focused element if editable
    const active = document.activeElement as HTMLElement | null;
    if (isEditable(active) && !looksLikeMainPrompt(active)) {
      target = active;
    }
  }
  if (!target) {
    showErrorToast('[AI Studio Profiles] Could not find the system instructions field.');
    return;
  }
  // Confirm overwrite if replacing and content already exists
  if (mode === 'replace') {
    const current = isTextarea(target) ? (target as HTMLTextAreaElement).value : (target as HTMLElement).innerText || '';
    if (current.trim().length > 0) {
      if (state.settings.confirmOverwriteSystem) {
        const theme = state.settings.theme ?? 'auto';
        const darkPreferred = theme === 'dark' || (theme === 'auto' && window.matchMedia('(prefers-color-scheme: dark)').matches);
        const res = await confirmOverwriteModal(darkPreferred);
        if (!res.confirmed) return;
        if (res.dontAskAgain) {
          await setSettings({ confirmOverwriteSystem: false });
        }
      }
    }
  }
  applyInsert(target, text, mode);
}

chrome.runtime.onMessage.addListener((msg: RuntimeMessage, _sender: chrome.runtime.MessageSender, sendResponse: (response?: any) => void) => {
  (async () => {
    if (msg.type === 'INSERT_PROFILE') {
      await handleInsertAsync(msg.profile.content, msg.mode);
      sendResponse({ ok: true });
    }
  })();
  // Keep the message channel open for async response
  return true;
});

function findSystemButton(root: ParentNode = document): HTMLButtonElement | null {
  // Prefer explicit aria-label, fallback to data attribute seen in probes
  const btn = root.querySelector(
    'button[aria-label="System instructions"], button[data-test-si]'
  );
  return (btn as HTMLButtonElement) || null;
}

async function waitForSystemTextarea(timeoutMs = 5000, settings?: Settings): Promise<HTMLTextAreaElement | null> {
  const existing = findSystemTextarea(settings);
  if (existing) return existing;

  return new Promise((resolve) => {
    let observer: MutationObserver;
    const timeout = setTimeout(() => {
      observer?.disconnect();
      resolve(findSystemTextarea(settings));
    }, timeoutMs);

    observer = new MutationObserver(() => {
      const ta = findSystemTextarea(settings);
      if (ta) {
        clearTimeout(timeout);
        observer.disconnect();
        resolve(ta);
      }
    });
    observer.observe(document.documentElement, { childList: true, subtree: true });
  });
}

 // Lightweight confirm modal using native <dialog> and Shadow DOM
 function confirmOverwriteModal(darkPreferred = false): Promise<{ confirmed: boolean; dontAskAgain: boolean }> {
   const host = document.createElement('div');
   host.style.all = 'initial';
   const shadow = host.attachShadow({ mode: 'open' });

   const styles = document.createElement('style');
   const bg = darkPreferred ? '#2b2b2b' : 'white';
   const color = darkPreferred ? '#e9eaee' : '#111';
   const border = darkPreferred ? '#3c4043' : '#dadce0';
   styles.textContent = `
     dialog {
       max-width: 420px; width: min(92vw, 420px);
       background: ${bg};
       color: ${color};
       border: 1px solid ${border};
       border-radius: 12px;
       box-shadow: 0 10px 30px rgba(0,0,0,0.3);
       padding: 16px;
       font-family: system-ui, -apple-system, Segoe UI, Roboto, sans-serif;
     }
     dialog::backdrop { background: rgba(0,0,0,0.4); }
     .title { font-size: 16px; font-weight: 600; margin-bottom: 8px; }
     .body { font-size: 13px; line-height: 1.5; margin-bottom: 12px; }
     .askWrap { display: flex; align-items: center; gap: 8px; margin: 8px 0 16px; }
     .askWrap span { font-size: 12px; }
     .btns { display: flex; justify-content: flex-end; gap: 8px; }
     button { padding: 6px 12px; border-radius: 8px; cursor: pointer; border: 1px solid ${border}; background: transparent; color: inherit; }
     button.confirm { border-color: #1a73e8; background: #1a73e8; color: #fff; }
   `;

   const dialog = document.createElement('dialog');
   dialog.innerHTML = `
     <div class="title">Overwrite system instructions?</div>
     <div class="body">There is already text in the System instructions. Replacing it will discard the current text.</div>
     <label class="askWrap">
       <input type="checkbox" id="dont-ask-again-cb" />
       <span>Don't ask again</span>
     </label>
     <div class="btns">
       <button id="cancel-btn">Cancel</button>
       <button id="confirm-btn" class="confirm">Replace</button>
     </div>
   `;

   shadow.append(styles, dialog);
   document.documentElement.appendChild(host);

   return new Promise((resolve) => {
     const checkbox = shadow.querySelector('#dont-ask-again-cb') as HTMLInputElement;
     const cleanup = () => {
       try { dialog.close(); } catch { /* ignore */ }
       host.remove();
     };
     dialog.addEventListener('close', () => {
       // Resolves when dialog is closed by Escape key or other means
       resolve({ confirmed: false, dontAskAgain: false });
       cleanup();
     });
     shadow.querySelector('#cancel-btn')?.addEventListener('click', () => {
       resolve({ confirmed: false, dontAskAgain: false });
       cleanup();
     });
     shadow.querySelector('#confirm-btn')?.addEventListener('click', () => {
       resolve({ confirmed: true, dontAskAgain: checkbox?.checked ?? false });
       cleanup();
     });
     // Show modal (may throw in some restricted contexts, guard it)
     try {
       (dialog as HTMLDialogElement).showModal();
     } catch {
       // Fallback: resolve negative to avoid blocking
       resolve({ confirmed: false, dontAskAgain: false });
       cleanup();
     }
   });
 }

async function openSystemPanelIfNeeded(settings?: Settings): Promise<boolean> {
  // If already visible, nothing to do
  const present = findSystemTextarea(settings);
  if (present) return true;

  const btn = findSystemButton();
  if (!btn) return false;
  btn.click();
  const ta = await waitForSystemTextarea(5000, settings);
  return !!ta;
}

// Observe SPA mutations; if needed, we could auto-attach helpers. Here we just keep the file alive.
const observer = new MutationObserver(() => {
  // no-op for now; placeholder for future improvements
});
observer.observe(document.documentElement, { childList: true, subtree: true });
