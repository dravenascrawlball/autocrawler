import { writable } from 'svelte/store';

const STORAGE_KEY = 'autocrawler:battleSpeed';

export type BattleSpeedMultiplier = 1 | 2 | 4;

const VALID_MULTIPLIERS: BattleSpeedMultiplier[] = [1, 2, 4];

function loadInitialSpeed(): BattleSpeedMultiplier {
  try {
    const raw = Number(localStorage.getItem(STORAGE_KEY));
    return VALID_MULTIPLIERS.includes(raw as BattleSpeedMultiplier) ? (raw as BattleSpeedMultiplier) : 1;
  } catch {
    return 1; // localStorage unavailable (e.g. private mode) — just don't persist this session
  }
}

/** Room-replay playback speed — a display preference, not game state, so it's kept out of the save file/autosave and persisted to localStorage directly instead. */
export const battleSpeed = writable<BattleSpeedMultiplier>(loadInitialSpeed());

battleSpeed.subscribe((value) => {
  try {
    localStorage.setItem(STORAGE_KEY, String(value));
  } catch {
    // localStorage unavailable — the setting just won't survive a reload this session
  }
});
