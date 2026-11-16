import { User } from './api';

export interface CustomEmoji {
  id: number;
  name: string;
  url: string;
}

export interface Extras {
  groups: { id: number; handle: string; member_ids: number[] }[];
  emojis: CustomEmoji[];
  sections: { id: number; name: string }[];
}

let members: User[] = [];
let extras: Extras = { groups: [], emojis: [], sections: [] };

/** The Home screen keeps this current, so chat screens can offer mentions and emoji. */
export function setWorkspaceData(nextMembers: User[], nextExtras: Extras) {
  members = nextMembers;
  extras = nextExtras;
}

export const getExtras = () => extras;

export function mentionNames(meId?: number): string[] {
  return [
    ...members.filter((member) => member.id !== meId).map((member) => member.name),
    'channel',
    'here',
    ...extras.groups.map((group) => group.handle),
  ];
}
