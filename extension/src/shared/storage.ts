import type { Prompt, StorageSchema, Settings } from './types';
import { sortPromptsByMRU } from './ui-utils';

// Use a prefix to store each prompt; prompts will be persisted in chrome.storage.local
// to avoid chrome.storage.sync per-item quota limits for large content.
const PROMPT_KEY_PREFIX = 'prompt_';

const DEFAULT_SETTINGS: Settings = {
  insertMode: 'replace',
  showContextMenu: true,
  theme: 'auto',
  confirmOverwriteSystem: true,
  confirmDeletePrompt: true,
  autoClosePanel: false,
};

const DEFAULT_PROMPT: Prompt = {
  id: crypto.randomUUID(),
  name: 'Concise Helpful Assistant',
  content: `You are a helpful, concise assistant.
- Prefer short, clear answers with bullet points.
- Ask one clarifying question if requirements are ambiguous.
- Avoid speculation; state uncertainties explicitly.
- When code is relevant, show minimal, runnable snippets.`,
  createdAt: Date.now(),
  updatedAt: Date.now(),
};
 
/**
 * Helper: broadcast prompt updates to any open extension views.
 * Accepts an optional detail payload so listeners can patch state instead of full re-fetch.
 * Suppress errors when there is no receiver.
 */
function broadcastUpdate(detail?: Record<string, unknown>) {
  try {
    // Some chrome typings return a Promise; if so we safely ignore rejections.
    // If not, this call is still safe inside try/catch.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (chrome.runtime.sendMessage as any)({ type: 'PROMPTS_UPDATED', detail }).catch?.(() => {});
  } catch {
    // ignore
  }
}
 
// Assemble state: settings/lastUsedPromptId are stored in chrome.storage.sync,
// prompts are stored in chrome.storage.local to avoid sync per-item quota.
/**
 * One-time initialization logic. Should only be called from the background script's
 * onInstalled listener. It checks if settings exist before running to be idempotent.
 */
export async function initializeStorage() {
  const syncItems = await chrome.storage.sync.get('settings');
  // If settings already exist, it means we've initialized before. Do nothing.
  if (syncItems.settings) {
    return;
  }

  // Create and persist the default state
  await chrome.storage.local.set({ [`${PROMPT_KEY_PREFIX}${DEFAULT_PROMPT.id}`]: DEFAULT_PROMPT });
  await chrome.storage.sync.set({
    settings: DEFAULT_SETTINGS,
    lastUsedPromptId: DEFAULT_PROMPT.id,
    version: 1,
  });
  console.log('[AI Studio Prompts] First-time initialization complete.');
  // Notify listeners that initialization happened and include the default prompt id.
  broadcastUpdate({ action: 'initialized', id: DEFAULT_PROMPT.id });
}

/**
 * Retrieves the current state from storage. This function has NO side effects.
 * It only reads the current state.
 */
export async function getState(): Promise<StorageSchema> {
  const syncItems = (await chrome.storage.sync.get()) as Record<string, any>;
  const localItems = (await chrome.storage.local.get()) as Record<string, any>;

  const settings = { ...DEFAULT_SETTINGS, ...(syncItems.settings || {}) } as Settings;
  const lastUsedPromptId = typeof syncItems.lastUsedPromptId === 'string' ? syncItems.lastUsedPromptId as string : undefined;

  const prompts: Prompt[] = [];
  for (const k of Object.keys(localItems)) {
    if (k.startsWith(PROMPT_KEY_PREFIX)) {
      prompts.push(localItems[k] as Prompt);
    }
  }

  return {
    prompts: sortPromptsByMRU(prompts),
    lastUsedPromptId: lastUsedPromptId,
    settings,
    version: (syncItems.version as number) ?? 1,
  };
}

// Accept the flexible input shape callers provide.
export async function upsertPrompt(
  p: Omit<Prompt, 'id' | 'createdAt' | 'updatedAt'> & Partial<Pick<Prompt, 'id'>>
): Promise<Prompt> {
  const now = Date.now();
  const id = p.id ?? crypto.randomUUID();
  const key = `${PROMPT_KEY_PREFIX}${id}`;

  // Fetch existing prompt from local to preserve createdAt and optional fields
  const existingItems = (await chrome.storage.local.get(key)) as Record<string, any>;
  const existing = existingItems[key] as Prompt | undefined;

  const promptToSave: Prompt = {
    // required fields
    id,
    name: p.name,
    content: p.content,
    // optional with sensible defaults / preservation
    tags: p.tags ?? existing?.tags ?? [],
    favorite: p.favorite ?? existing?.favorite ?? false,
    // metadata
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
  };

  // Persist prompt to local storage (larger quota)
  await chrome.storage.local.set({ [key]: promptToSave });
  // Inform listeners whether we added or updated a prompt
  broadcastUpdate({ action: existing ? 'updated' : 'added', id });
  return promptToSave;
}

export async function deletePrompt(id: string) {
  const key = `${PROMPT_KEY_PREFIX}${id}`;
  const syncData = await chrome.storage.sync.get('lastUsedPromptId');

  await chrome.storage.local.remove(key);

  // If the deleted prompt was the last used one, we need to pick a new one.
  if (syncData.lastUsedPromptId === id) {
    const remainingPrompts = (await getState()).prompts;
    // Set to the first remaining prompt, or undefined if the list is now empty.
    await setLastUsedPrompt(remainingPrompts[0]?.id);
  }
  // Inform listeners that a prompt was deleted
  broadcastUpdate({ action: 'deleted', id });
}

export async function setLastUsedPrompt(id: string | undefined) {
  if (id) {
    // Update the prompt's lastUsedAt timestamp when it's used
    const key = `${PROMPT_KEY_PREFIX}${id}`;
    const existingItems = (await chrome.storage.local.get(key)) as Record<string, any>;
    const existing = existingItems[key] as Prompt | undefined;
    
    if (existing) {
      const updatedPrompt: Prompt = {
        ...existing,
        lastUsedAt: Date.now()
      };
      await chrome.storage.local.set({ [key]: updatedPrompt });
    }
  }
  await chrome.storage.sync.set({ lastUsedPromptId: id });
}

export async function setSettings(newSettings: Partial<Settings>) {
  const data = (await chrome.storage.sync.get('settings')) as Record<string, any>;
  const settings = { ...DEFAULT_SETTINGS, ...(data.settings || {}), ...newSettings } as Settings;
  await chrome.storage.sync.set({ settings });
}

export async function exportJson(): Promise<string> {
  const state = await getState();
  // For exports, use alphabetical sorting for predictable file output
  const exportPrompts = state.prompts.slice().sort((a, b) => a.name.localeCompare(b.name));
  const blob = {
    version: state.version,
    settings: state.settings,
    prompts: exportPrompts,
  };
  return JSON.stringify(blob, null, 2);
}

export async function importJson(text: string, opts?: { force?: boolean }) {
  const parsed = JSON.parse(text);
  if (!parsed || !Array.isArray(parsed.prompts)) throw new Error('Invalid import file');

  const prompts = parsed.prompts as Prompt[];

  // Prevent accidental destructive imports: importing an empty prompts array would
  // otherwise delete all existing prompts. Require explicit confirmation via opts.force.
  if (prompts.length === 0 && !opts?.force) {
    throw new Error(
      'Import contains zero prompts. Aborted to avoid deleting all existing prompts. ' +
      'Call importJson(text, { force: true }) to proceed if you really want to replace all prompts.'
    );
  }

  // Validate prompts minimally (ensure ids exist) to avoid creating malformed keys
  for (const p of prompts) {
    if (!p || typeof p.id !== 'string' || p.id.trim() === '') {
      throw new Error('Invalid prompt entry in import file (missing id)');
    }
  }

  // Only remove existing prompt_* keys after validation has passed
  const localItems = (await chrome.storage.local.get()) as Record<string, any>;
  const keysToRemove = Object.keys(localItems).filter(k => k.startsWith(PROMPT_KEY_PREFIX));
  if (keysToRemove.length > 0) {
    await chrome.storage.local.remove(keysToRemove);
  }

  const settings = { ...DEFAULT_SETTINGS, ...(parsed.settings || {}) } as Settings;

  // Prepare object mapping prompt keys to prompt values for a single set call to local
  const toSetLocal: Record<string, unknown> = {};
  for (const p of prompts) {
    const key = `${PROMPT_KEY_PREFIX}${p.id}`;
    toSetLocal[key] = p;
  }

  // Persist prompts locally and settings (and lastUsedPromptId) in sync
  await chrome.storage.local.set(toSetLocal);
  await chrome.storage.sync.set({ settings, lastUsedPromptId: prompts[0]?.id });
  // Notify listeners and include import metadata (count)
  broadcastUpdate({ action: 'imported', count: prompts.length });
}
 
// Note: prompts are stored in chrome.storage.local now to avoid chrome.storage.sync per-item quota limits.
// Settings and lastUsedPromptId remain in chrome.storage.sync so user preferences can still sync if desired.