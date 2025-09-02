import type { Prompt, InsertMode } from './types';

export type MsgInsertPrompt = {
  type: 'INSERT_PROMPT';
  prompt: Prompt;
  mode?: InsertMode;
};

export type MsgPromptsUpdated = {
  type: 'PROMPTS_UPDATED';
};

export type RuntimeMessage = MsgInsertPrompt | MsgPromptsUpdated;
