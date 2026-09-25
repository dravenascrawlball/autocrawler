import { writable } from 'svelte/store';
import { createTownStorage, type TownStorage } from '../sim/townStorage';
import { STARTER_TOWN_ITEMS } from '../data/items';
import { INITIAL_SAVE } from './persistence';

function createInitialTownStorage(): TownStorage {
  if (INITIAL_SAVE) {
    return INITIAL_SAVE.townStorage;
  }
  const storage = createTownStorage();
  storage.items.push(...STARTER_TOWN_ITEMS);
  return storage;
}

/** Sourced from a save if one exists, otherwise /src/data fixtures. */
export const townStorage = writable<TownStorage>(createInitialTownStorage());
