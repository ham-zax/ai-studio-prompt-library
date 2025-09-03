export type InsertMode = 'replace' | 'append' | 'prepend';

export type Theme = 'auto' | 'light' | 'dark';

export interface Prompt {
  id: string;
  name: string;
  content: string;
  tags?: string[];
  favorite?: boolean;
  createdAt: number;
  updatedAt: number;
}

export interface Settings {
  insertMode: InsertMode; // default: 'replace'
  showContextMenu: boolean; // default: true
  theme: Theme; // default: 'auto'
  confirmOverwriteSystem: boolean; // default: true
  // When true, show a confirmation dialog before deleting a prompt.
  // Users may turn this off to speed up deletions.
  confirmDeletePrompt?: boolean; // default: true
  customSelector?: string; // default: undefined
}

export interface StorageSchema {
  prompts: Prompt[];
  lastUsedPromptId?: string;
  settings: Settings;
  version: number; // for migrations
}
