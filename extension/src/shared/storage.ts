import type { Profile, StorageSchema, Settings } from './types';

// Use a prefix to store each profile; profiles will be persisted in chrome.storage.local
// to avoid chrome.storage.sync per-item quota limits for large content.
const PROFILE_KEY_PREFIX = 'profile_';

const DEFAULT_SETTINGS: Settings = {
  insertMode: 'replace',
  showContextMenu: true,
  theme: 'auto',
  confirmOverwriteSystem: true,
};

const DEFAULT_PROFILE: Profile = {
  id: crypto.randomUUID(),
  name: 'Concise Helpful Assistant',
  content: `You are a helpful, concise assistant.\n- Prefer short, clear answers with bullet points.\n- Ask one clarifying question if requirements are ambiguous.\n- Avoid speculation; state uncertainties explicitly.\n- When code is relevant, show minimal, runnable snippets.`,
  createdAt: Date.now(),
  updatedAt: Date.now(),
};
 
// Helper: broadcast profile updates to any open extension views.
// Suppress errors when there is no receiver.
function broadcastUpdate() {
  try {
    // Some chrome typings return a Promise; if so we safely ignore rejections.
    // If not, this call is still safe inside try/catch.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (chrome.runtime.sendMessage as any)({ type: 'PROFILES_UPDATED' }).catch?.(() => {});
  } catch {
    // ignore
  }
}
 
// Assemble state: settings/lastUsedProfileId are stored in chrome.storage.sync,
// profiles are stored in chrome.storage.local to avoid sync per-item quota.
export async function getState(): Promise<StorageSchema> {
  const syncItems = (await chrome.storage.sync.get()) as Record<string, any>;
  const localItems = (await chrome.storage.local.get()) as Record<string, any>;

  const settings = { ...DEFAULT_SETTINGS, ...(syncItems.settings || {}) } as Settings;
  const lastUsedProfileId = typeof syncItems.lastUsedProfileId === 'string' ? syncItems.lastUsedProfileId as string : undefined;

  const profiles: Profile[] = [];
  for (const k of Object.keys(localItems)) {
    if (k.startsWith(PROFILE_KEY_PREFIX)) {
      profiles.push(localItems[k] as Profile);
    }
  }

  if (profiles.length === 0) {
    // Ensure at least one profile exists
    profiles.push(DEFAULT_PROFILE);
    // persist default profile locally and ensure sync keys exist
    await chrome.storage.local.set({ [`${PROFILE_KEY_PREFIX}${DEFAULT_PROFILE.id}`]: DEFAULT_PROFILE });
    await chrome.storage.sync.set({ settings: DEFAULT_SETTINGS, lastUsedProfileId: DEFAULT_PROFILE.id });
  }

  return {
    profiles: profiles.sort((a, b) => (a.name > b.name ? 1 : -1)),
    lastUsedProfileId: lastUsedProfileId ?? profiles[0]?.id,
    settings,
    version: (syncItems.version as number) ?? 1,
  };
}

// Accept the flexible input shape callers provide.
export async function upsertProfile(
  p: Omit<Profile, 'id' | 'createdAt' | 'updatedAt'> & Partial<Pick<Profile, 'id'>>
): Promise<Profile> {
  const now = Date.now();
  const id = p.id ?? crypto.randomUUID();
  const key = `${PROFILE_KEY_PREFIX}${id}`;

  // Fetch existing profile from local to preserve createdAt and optional fields
  const existingItems = (await chrome.storage.local.get(key)) as Record<string, any>;
  const existing = existingItems[key] as Profile | undefined;

  const profileToSave: Profile = {
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

  // Persist profile to local storage (larger quota)
  await chrome.storage.local.set({ [key]: profileToSave });
  broadcastUpdate();
  return profileToSave;
}

export async function deleteProfile(id: string) {
  const key = `${PROFILE_KEY_PREFIX}${id}`;
  await chrome.storage.local.remove(key);

  // If deleted profile was last used, update lastUsedProfileId to an existing profile (if any)
  const state = await getState();
  if (state.lastUsedProfileId === id) {
    await setLastUsedProfile(state.profiles[0]?.id);
  }
  broadcastUpdate();
}

export async function setLastUsedProfile(id: string | undefined) {
  await chrome.storage.sync.set({ lastUsedProfileId: id });
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
    profiles: state.profiles,
  };
  return JSON.stringify(blob, null, 2);
}

export async function importJson(text: string) {
  const parsed = JSON.parse(text);
  if (!parsed || !Array.isArray(parsed.profiles)) throw new Error('Invalid import file');

  // Remove existing profile_* keys from local storage
  const localItems = (await chrome.storage.local.get()) as Record<string, any>;
  const keysToRemove = Object.keys(localItems).filter(k => k.startsWith(PROFILE_KEY_PREFIX));
  if (keysToRemove.length > 0) {
    await chrome.storage.local.remove(keysToRemove);
  }

  const settings = { ...DEFAULT_SETTINGS, ...(parsed.settings || {}) } as Settings;
  const profiles = parsed.profiles as Profile[];

  // Prepare object mapping profile keys to profile values for a single set call to local
  const toSetLocal: Record<string, unknown> = {};
  for (const p of profiles) {
    const key = `${PROFILE_KEY_PREFIX}${p.id}`;
    toSetLocal[key] = p;
  }

  // Persist profiles locally and settings (and lastUsedProfileId) in sync
  await chrome.storage.local.set(toSetLocal);
  await chrome.storage.sync.set({ settings, lastUsedProfileId: profiles[0]?.id });
  broadcastUpdate();
}
 
// Note: profiles are stored in chrome.storage.local now to avoid chrome.storage.sync per-item quota limits.
// Settings and lastUsedProfileId remain in chrome.storage.sync so user preferences can still sync if desired.
