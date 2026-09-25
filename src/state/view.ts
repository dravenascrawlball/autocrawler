import { get, writable } from 'svelte/store';
import { dungeonPlayback } from './dungeonPlayback';

export type ViewName = 'town' | 'dungeon';

/**
 * Which top-level phase is active: the Svelte Town DOM UI, or the Phaser
 * dungeon scene. Boots straight into the dungeon phase when there's a run
 * to resume — checked against dungeonPlayback's own reconstructed initial
 * value (see state/dungeonPlayback.ts's resumeFromSave), not the raw save,
 * so this can never disagree with whether a resume actually succeeded.
 */
export const currentView = writable<ViewName>(get(dungeonPlayback) ? 'dungeon' : 'town');
