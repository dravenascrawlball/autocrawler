import { get } from 'svelte/store';
import { roster } from './roster';
import { townStorage } from './townStorage';
import type { Item, EquipmentSlot } from '../sim/items';
import type { Row } from '../sim/formation';
import {
  equipItem as simEquipItem,
  unequipItem as simUnequipItem,
  setRow as simSetRow,
} from '../sim/partyManagement';
import { recruitAdventurer as simRecruitAdventurer } from '../sim/recruitment';
import { buyShopItem as simBuyShopItem } from '../sim/shop';
import { ITEM_REGISTRY } from '../data/items';
import { recruitmentPool } from './recruitmentPool';

/**
 * Sim functions mutate the Adventurer/inventory objects in place; Svelte's
 * store `set`/`update` only notifies subscribers when the stored reference
 * changes, so every wrapper below re-wraps the (mutated) state in a fresh
 * top-level object to force the UI to re-render.
 */
function touchRoster(): void {
  roster.update((state) => ({ ...state }));
}

function touchTownStorage(): void {
  townStorage.update((state) => ({ ...state }));
}

function findAdventurer(id: string) {
  return get(roster).adventurers.find((adventurer) => adventurer.id === id) ?? null;
}

/** Equips `item` (pulled from town storage) onto `adventurerId`'s matching slot, per item.slot. */
export function equipItemForAdventurer(adventurerId: string, item: Item): void {
  const adventurer = findAdventurer(adventurerId);
  if (!adventurer) {
    return;
  }

  try {
    simEquipItem(adventurer, get(townStorage), item, item.slot);
  } catch {
    return; // e.g. item no longer in inventory; leave state untouched
  }

  touchRoster();
  touchTownStorage();
}

/** Unequips whatever `adventurerId` has in `slot`, returning it to town storage. */
export function unequipItemForAdventurer(adventurerId: string, slot: EquipmentSlot): void {
  const adventurer = findAdventurer(adventurerId);
  if (!adventurer) {
    return;
  }

  simUnequipItem(adventurer, get(townStorage), slot);
  touchRoster();
  touchTownStorage();
}

/** Reassigns `adventurerId`'s formation row (front/back) — see sim/formation.ts. */
export function setAdventurerRow(adventurerId: string, row: Row): void {
  const adventurer = findAdventurer(adventurerId);
  if (!adventurer) {
    return;
  }

  simSetRow(adventurer, row);
  touchRoster();
}

/**
 * Recruits the candidate with `candidateId`: deducts their cost from town
 * gold and adds their id to `roster.recruitedIds` (granting "always
 * offerable as a draft substitute" rights — see sim/recruitment.ts), then
 * removes them from the pool. No-ops (returns false) if gold is
 * insufficient or the candidate is gone.
 */
export function recruitAdventurer(candidateId: string): boolean {
  const pool = get(recruitmentPool);
  const candidate = pool.find((c) => c.id === candidateId);
  if (!candidate) {
    return false;
  }

  const nextPool = [...pool];
  const state = get(roster);
  const nextRecruitedIds = [...state.recruitedIds];
  const succeeded = simRecruitAdventurer(candidate, nextPool, nextRecruitedIds, get(townStorage));
  if (!succeeded) {
    return false;
  }

  recruitmentPool.set(nextPool);
  roster.set({ ...state, recruitedIds: nextRecruitedIds });
  touchTownStorage();
  return true;
}

/** Buys `itemId` from the shop's item roster, deducting its price from town gold. No-ops (returns false) if unaffordable. */
export function buyShopItem(itemId: string): boolean {
  const succeeded = simBuyShopItem(itemId, (id) => ITEM_REGISTRY[id], get(townStorage));
  if (!succeeded) {
    return false;
  }

  touchTownStorage();
  return true;
}
