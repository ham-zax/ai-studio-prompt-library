import { getState, setSettings, upsertPrompt, deletePrompt, exportJson, importJson } from '../shared/storage';
import type { Prompt, Settings } from '../shared/types';
import { applyTheme, renderPromptList } from '../shared/ui-utils';

function el<T extends HTMLElement>(id: string) { return document.getElementById(id) as T; }

function clearForm() {
  el<HTMLInputElement>('name').value = '';
  el<HTMLTextAreaElement>('content').value = '';
  el<HTMLInputElement>('editingId').value = '';
  el<HTMLButtonElement>('add').textContent = 'Add Prompt';
  const cf = el<HTMLButtonElement>('clearForm');
  if (cf) cf.style.display = 'none';
}

async function refresh() {
  const state = await getState();
  // settings
  el<HTMLSelectElement>('insertMode').value = state.settings.insertMode;
  el<HTMLInputElement>('showContextMenu').checked = !!state.settings.showContextMenu;
  el<HTMLInputElement>('confirmOverwriteSystem').checked = state.settings.confirmOverwriteSystem ?? true;
  el<HTMLSelectElement>('theme').value = state.settings.theme ?? 'auto';
  el<HTMLInputElement>('customSelector').value = state.settings.customSelector ?? '';
  applyTheme(state.settings.theme ?? 'auto');

  const ul = el<HTMLUListElement>('prompt-list');
  renderPromptList(ul, state.prompts, (p) => {
    const actions = document.createElement('div');
    actions.className = 'actions';

    const edit = document.createElement('button');
    edit.textContent = 'Edit';
    edit.addEventListener('click', (e) => {
      e.stopPropagation();
      el<HTMLInputElement>('editingId').value = p.id;
      el<HTMLInputElement>('name').value = p.name;
      el<HTMLTextAreaElement>('content').value = p.content;
      el<HTMLButtonElement>('add').textContent = 'Save Changes';
      const cf = el<HTMLButtonElement>('clearForm');
      if (cf) cf.style.display = 'inline-block';
      el<HTMLInputElement>('name').focus();
      const dlg = el<HTMLDialogElement>('editDialog');
      if (dlg) dlg.showModal();
    });

    const del = document.createElement('button');
    del.textContent = 'Delete';
    del.addEventListener('click', async (e) => {
      e.stopPropagation();
      if (confirm('Delete this prompt?')) {
        await deletePrompt(p.id);
        await refresh();
      }
    });

    actions.append(edit, del);
    return actions;
  }, (p) => {
    el<HTMLInputElement>('editingId').value = p.id;
    el<HTMLInputElement>('name').value = p.name;
    el<HTMLTextAreaElement>('content').value = p.content;
    el<HTMLButtonElement>('add').textContent = 'Save Changes';
    const cf = el<HTMLButtonElement>('clearForm');
    if (cf) cf.style.display = 'inline-block';
    const dlg = el<HTMLDialogElement>('editDialog');
    if (dlg) dlg.showModal();
  });
}

async function main() {
  await refresh();
  const cfBtn = el<HTMLButtonElement>('clearForm');
  if (cfBtn) {
    cfBtn.style.display = 'none';
    cfBtn.addEventListener('click', () => clearForm());
  }

  el<HTMLButtonElement>('add').addEventListener('click', (e) => {
    e.preventDefault();
    // Open dialog for creating a new prompt
    el<HTMLInputElement>('editingId').value = '';
    el<HTMLInputElement>('name').value = '';
    el<HTMLTextAreaElement>('content').value = '';
    el<HTMLButtonElement>('add').textContent = 'Add Prompt';
    const cf = el<HTMLButtonElement>('clearForm');
    if (cf) cf.style.display = 'none';
    const dlg = el<HTMLDialogElement>('editDialog');
    if (dlg) dlg.showModal();
  });

  el<HTMLSelectElement>('insertMode').addEventListener('change', async (e) => {
    const value = (e.target as HTMLSelectElement).value as Settings['insertMode'];
    await setSettings({ insertMode: value });
  });

  el<HTMLInputElement>('showContextMenu').addEventListener('change', async (e) => {
    const value = (e.target as HTMLInputElement).checked;
    await setSettings({ showContextMenu: value });
  });

  el<HTMLInputElement>('confirmOverwriteSystem').addEventListener('change', async (e) => {
    const value = (e.target as HTMLInputElement).checked;
    await setSettings({ confirmOverwriteSystem: value });
  });

  el<HTMLSelectElement>('theme').addEventListener('change', async (e) => {
    const value = (e.target as HTMLSelectElement).value as Settings['theme'];
    applyTheme(value);
    await setSettings({ theme: value });
  });

  // Advanced: custom selector override
  el<HTMLInputElement>('customSelector').addEventListener('change', async (e) => {
    const value = (e.target as HTMLInputElement).value.trim();
    await setSettings({ customSelector: value || undefined });
  });

  el<HTMLButtonElement>('export').addEventListener('click', async () => {
    const data = await exportJson();
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'ai-studio-prompt-library.json';
    a.click();
    URL.revokeObjectURL(url);
  });

  el<HTMLButtonElement>('import').addEventListener('click', async () => {
    const input = el<HTMLInputElement>('importFile');
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) return;
      const text = await file.text();
      try {
        await importJson(text);
        alert('Imported successfully');
        // Ensure UI reflects the imported prompts immediately in this page.
        await refresh();
      } catch (e) {
        alert('Import failed: ' + (e as Error).message);
      } finally {
        // Reset file input so the same file can be selected again if needed.
        input.value = '';
      }
    };
    input.click();
  });

  // Dialog save / cancel handlers
  {
    const dlg = el<HTMLDialogElement>('editDialog');
    const dlgSave = document.getElementById('dialogSave') as HTMLButtonElement | null;
    const dlgCancel = document.getElementById('dialogCancel') as HTMLButtonElement | null;
    if (dlgSave) {
      dlgSave.addEventListener('click', async () => {
        const name = el<HTMLInputElement>('name').value.trim();
        const content = el<HTMLTextAreaElement>('content').value.trim();
        if (!name || !content) return alert('Name and content are required.');
        const id = el<HTMLInputElement>('editingId').value || undefined;
        await upsertPrompt({ id, name, content });
        dlg.close();
        clearForm();
        await refresh();
      });
    }
    if (dlgCancel) {
      dlgCancel.addEventListener('click', () => {
        dlg.close();
        clearForm();
      });
    }
  }

  // Listen for prompt update broadcasts from storage.ts and refresh UI
  chrome.runtime.onMessage.addListener((msg: any, _sender: chrome.runtime.MessageSender, _sendResponse?: (response?: any) => void) => {
    if (msg?.type === 'PROMPTS_UPDATED') {
      refresh();
    }
    return undefined;
  });
}
 
main();
