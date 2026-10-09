import { writable } from 'svelte/store';

const STORAGE_KEY = 'autocrawler:cutIns';

/**
 * Portrait cut-ins during a room replay (ui/cutIns.ts): `off`, `key` (killing
 * blows, saves, heroes falling, boss entrances), or `all` (key moments plus
 * every Special Action that isn't always-on).
 */
export type CutInSetting = 'off' | 'key' | 'all';

const VALID_SETTINGS: CutInSetting[] = ['off', 'key', 'all'];

function loadInitialSetting(): CutInSetting {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return VALID_SETTINGS.includes(raw as CutInSetting) ? (raw as CutInSetting) : 'all';
  } catch {
    return 'all'; // localStorage unavailable — just don't persist this session
  }
}

/** A display preference like battleSpeed — persisted to localStorage, not the save file. */
export const cutInSetting = writable<CutInSetting>(loadInitialSetting());

cutInSetting.subscribe((value) => {
  try {
    localStorage.setItem(STORAGE_KEY, value);
  } catch {
    // localStorage unavailable — the setting just won't survive a reload this session
  }
});
