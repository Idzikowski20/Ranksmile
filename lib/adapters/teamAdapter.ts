import { notImplemented } from './types';

export type CreateTeamInput = {
  name: string;
  emails: string[];
  role?: 'member' | 'manager' | 'admin';
};

export type CreateTeamResult = {
  workspaceId?: number;
  invited: string[];
};

/**
 * Create team / workspace + invites.
 * Prefer existing workspace setup + members APIs when wired.
 */
export async function createTeam(_input: CreateTeamInput): Promise<CreateTeamResult> {
  notImplemented('Create team');
}

export const teamAdapter = { create: createTeam };
