import { get } from 'svelte/store';
import { roster } from './roster';
import { metaProgression } from './metaProgression';
import type { GridPosition } from '../sim/formation';
import { setPosition as simSetPosition } from '../sim/partyManagement';
import { recruitAdventurer as simRecruitAdventurer } from '../sim/recruitment';
import { buyKit as simBuyKit } from '../sim/shop';
import { KIT_SHOP_CATALOG } from '../data/kitShop';
import { recruitmentPool } from './recruitmentPool';
import { trainingCost } from '../sim/training';
import { applyTrainingFromProgress, isEventKitEarnOnly } from './progression';

/**
 * Sim functions mutate the Adventurer/inventory objects in place; Svelte's
 * store `set`/`update` only notifies subscribers when the stored reference
 * changes, so every wrapper below re-wraps the (mutated) state in a fresh
 * top-level object to force the UI to re-render.
 */
function touchRoster(): void {
  roster.update((state) => ({ ...state }));
}

function touchMetaProgression(): void {
  metaProgression.update((state) => ({ ...state }));
}

function findAdventurer(id: string) {
  return get(roster).adventurers.find((adventurer) => adventurer.id === id) ?? null;
}

/** Reassigns `adventurerId`'s full grid position (lane + rank) — see sim/formation.ts. Used by the pre-fight layout-choice scene (ui/DungeonPauseView.svelte); works equally whether `adventurerId` is currently in Town or mid-run, since both read the same live roster record. */
export function setAdventurerPosition(adventurerId: string, position: GridPosition): void {
  const adventurer = findAdventurer(adventurerId);
  if (!adventurer) {
    return;
  }

  simSetPosition(adventurer, position);
  touchRoster();
}

/**
 * Recruits the candidate with `candidateId`: deducts their cost from
 * Renown and adds their id to `roster.recruitedIds` (granting "always
 * offerable as a draft substitute" rights — see sim/recruitment.ts), then
 * removes them from the pool. No-ops (returns false) if Renown is
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
  const wallet = get(metaProgression);
  const succeeded = simRecruitAdventurer(candidate, nextPool, nextRecruitedIds, wallet);
  if (!succeeded) {
    return false;
  }

  recruitmentPool.set(nextPool);
  roster.set({ ...state, recruitedIds: nextRecruitedIds });
  touchMetaProgression();
  return true;
}

/** Buys `kitId` (for `characterName`) from the Shop's Kit catalog (see data/kitShop.ts), deducting its price from Renown. No-ops (returns false) if unaffordable or already owned. */
export function buyKitFromShop(characterName: string, kitId: string): boolean {
  const entry = KIT_SHOP_CATALOG.find((candidate) => candidate.characterName === characterName && candidate.kit.id === kitId);
  // A seasonal Kit can't be bought while its event runs — it's earned instead.
  if (!entry || isEventKitEarnOnly(entry)) {
    return false;
  }

  const wallet = get(metaProgression);
  const succeeded = simBuyKit(entry.characterName, entry.kit, entry.price, wallet, wallet.unlockedKitIds);
  if (!succeeded) {
    return false;
  }

  touchMetaProgression();
  return true;
}

/**
 * Buys the next Training rank for `characterName` with Renown (roadmap item
 * 5 — see sim/training.ts): deducts trainingCost, bumps the rank, and
 * applies it to their roster record right away. Returns false (no-op) at
 * the cap or without enough Renown.
 */
export function buyTrainingRank(characterName: string): boolean {
  const state = get(metaProgression);
  const rank = state.trainingRanks[characterName] ?? 0;
  const cost = trainingCost(rank);
  if (cost === null || state.renown < cost) {
    return false;
  }

  metaProgression.set({
    ...state,
    renown: state.renown - cost,
    trainingRanks: { ...state.trainingRanks, [characterName]: rank + 1 },
  });
  for (const adventurer of get(roster).adventurers.filter((candidate) => candidate.name === characterName)) {
    applyTrainingFromProgress(adventurer);
  }
  touchRoster();
  return true;
}

