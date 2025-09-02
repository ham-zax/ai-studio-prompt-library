import type { Prompt, StorageSchema, Settings } from './types';

// Use a prefix to store each prompt; prompts will be persisted in chrome.storage.local
// to avoid chrome.storage.sync per-item quota limits for large content.
const PROMPT_KEY_PREFIX = 'prompt_';

const DEFAULT_SETTINGS: Settings = {
  insertMode: 'replace',
  showContextMenu: true,
  theme: 'auto',
  confirmOverwriteSystem: true,
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
 
// Helper: broadcast prompt updates to any open extension views.
// Suppress errors when there is no receiver.
function broadcastUpdate() {
  try {
    // Some chrome typings return a Promise; if so we safely ignore rejections.
    // If not, this call is still safe inside try/catch.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (chrome.runtime.sendMessage as any)({ type: 'PROMPTS_UPDATED' }).catch?.(() => {});
  } catch {
    // ignore
  }
}
 
// Assemble state: settings/lastUsedPromptId are stored in chrome.storage.sync,
// prompts are stored in chrome.storage.local to avoid sync per-item quota.
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

  if (prompts.length === 0) {
    // Ensure at least one prompt exists
    prompts.push(DEFAULT_PROMPT);
    // persist default prompt locally and ensure sync keys exist
    await chrome.storage.local.set({ [`${PROMPT_KEY_PREFIX}${DEFAULT_PROMPT.id}`]: DEFAULT_PROMPT });
    await chrome.storage.sync.set({ settings: DEFAULT_SETTINGS, lastUsedPromptId: DEFAULT_PROMPT.id });
  }

  return {
    prompts: prompts.sort((a, b) => (a.name > b.name ? 1 : -1)),
    lastUsedPromptId: lastUsedPromptId ?? prompts[0]?.id,
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
  broadcastUpdate();
  return promptToSave;
}

export async function deletePrompt(id: string) {
  const key = `${PROMPT_KEY_PREFIX}${id}`;
  await chrome.storage.local.remove(key);

  // If deleted prompt was last used, update lastUsedPromptId to an existing prompt (if any)
  const state = await getState();
  if (state.lastUsedPromptId === id) {
    await setLastUsedPrompt(state.prompts[0]?.id);
  }
  broadcastUpdate();
}

export async function setLastUsedPrompt(id: string | undefined) {
  await chrome.storage.sync.set({ lastUsedPromptId: id });
}

export async function setSettings(newSettings: Partial<Settings>) {
  const data = (await chrome.storage.sync.get('settings')) as Record<string, any>;
  const settings = { ...DEFAULT_SETTINGS, ...(data.settings || {}), ...newSettings } as Settings;
  await chrome.storage.sync.set({ settings });
}

export async function exportJson(): Promise<string> {
  const state = await getState();
  const blob = {
    version: state.version,
    settings: state.settings,
    prompts: state.prompts,
  };
  return JSON.stringify(blob, null, 2);
}

export async function importJson(text: string) {
  const parsed = JSON.parse(text);
  if (!parsed || !Array.isArray(parsed.prompts)) throw new Error('Invalid import file');

  // Remove existing prompt_* keys from local storage
  const localItems = (await chrome.storage.local.get()) as Record<string, any>;
  const keysToRemove = Object.keys(localItems).filter(k => k.startsWith(PROMPT_KEY_PREFIX));
  if (keysToRemove.length > 0) {
    await chrome.storage.local.remove(keysToRemove);
  }

  const settings = { ...DEFAULT_SETTINGS, ...(parsed.settings || {}) } as Settings;
  const prompts = parsed.prompts as Prompt[];

  // Prepare object mapping prompt keys to prompt values for a single set call to local
  const toSetLocal: Record<string, unknown> = {};
  for (const p of prompts) {
    const key = `${PROMPT_KEY_PREFIX}${p.id}`;
    toSetLocal[key] = p;
  }

  // Persist prompts locally and settings (and lastUsedPromptId) in sync
  await chrome.storage.local.set(toSetLocal);
  await chrome.storage.sync.set({ settings, lastUsedPromptId: prompts[0]?.id });
  broadcastUpdate();
}
 
// Note: prompts are stored in chrome.storage.local now to avoid chrome.storage.sync per-item quota limits.
// Settings and lastUsedPromptId remain in chrome.storage.sync so user preferences can still sync if desired.