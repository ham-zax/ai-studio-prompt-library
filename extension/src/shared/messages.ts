import type { Profile, InsertMode } from './types';

export type MsgInsertProfile = {
  type: 'INSERT_PROFILE';
  profile: Profile;
  mode?: InsertMode;
};

export type MsgProfilesUpdated = {
  type: 'PROFILES_UPDATED';
};

export type RuntimeMessage = MsgInsertProfile | MsgProfilesUpdated;
