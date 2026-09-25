import { writable } from 'svelte/store';
import type { UpgradeOffer } from '../sim/leveling';

/**
 * The 3 rolled offers currently on screen for one pending upgrade choice —
 * cached here so re-renders (or the modal simply staying open) don't
 * silently re-roll and swap the options out from under the player. Keyed by
 * `choiceId` so `LevelUpView` can tell "still the same choice, keep these
 * offers" from "moved on to a different choice, roll fresh ones" (see
 * state/leveling.ts's rollOffersForChoice). Not persisted to GameState/save
 * — a save/reload mid-choice just re-rolls next time, which is fine since
 * nothing was confirmed yet.
 */
export interface LevelUpOffersState {
  choiceId: string;
  offers: UpgradeOffer[];
}

export const currentLevelUpOffers = writable<LevelUpOffersState | null>(null);
