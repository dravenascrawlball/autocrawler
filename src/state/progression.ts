import { get, writable } from 'svelte/store';
import type { Adventurer } from '../sim/adventurer';
import { rerollPoolPicks } from '../sim/adventurer';
import type { ActionId } from '../sim/action';
import type { CharacterPoolEntry } from '../sim/characterPool';
import type { DungeonOutcome } from '../sim/dungeonRun';
import type { Kit } from '../sim/kits';
import type { RngSource } from '../sim/rng';
import type { RunRenownBreakdown } from '../sim/renown';
import type { RecruitShopOffer } from '../sim/shopOffers';
import { CHARACTER_UNLOCK_POOL, type UnlockCondition } from '../data/characterUnlocks';
import { CHARACTER_TEMPLATES } from '../data/characters';
import { KIT_SHOP_CATALOG } from '../data/kitShop';
import { runHistory, type RunHistoryState } from './runHistory';
import { metaProgression } from './metaProgression';
import { roster } from './roster';

/**
 * Meta-progression rules and read-side helpers (roadmap item 3 and the
 * unlock content pass): whether a character's unlock is earned, what's
 * still locked and how to get it, what the last run earned, and the
 * re-roll of offered recruits. Unlock data lives in
 * data/characterUnlocks.ts and data/kitShop.ts; history in the
 * runHistory/metaProgression stores.
 */

/** Whether `condition` is met for adventurer `adventurerId` given `history`. */
export function isUnlockEarned(condition: UnlockCondition, adventurerId: string, history: RunHistoryState): boolean {
  const stats = history.characterStats[adventurerId];
  switch (condition.kind) {
    case 'clear-run':
      return history.clearedWithIds.includes(adventurerId);
    case 'reach-room':
      return (stats?.bestRoomsWon ?? 0) >= condition.roomsWon;
    case 'runs':
      return (stats?.runs ?? 0) >= condition.count;
  }
}

/** Player-facing goal text for `condition`, e.g. "Reach room 4 with Bodil". */
export function conditionLabel(condition: UnlockCondition, characterName: string): string {
  switch (condition.kind) {
    case 'clear-run':
      return `Clear a run with ${characterName}`;
    case 'reach-room':
      return `Reach room ${condition.roomsWon + 1} with ${characterName}`;
    case 'runs':
      return `Take ${characterName} on ${condition.count} runs`;
  }
}

/** The pool entries `characterName`'s earned unlocks add — fed to createAdventurer/resetToTemplateBaseline/rerollPoolPicks. */
export function unlockedPoolEntriesFor(characterName: string, adventurerId: string, history: RunHistoryState): CharacterPoolEntry[] {
  return (CHARACTER_UNLOCK_POOL[characterName] ?? [])
    .filter((unlock) => isUnlockEarned(unlock.condition, adventurerId, history))
    .map((unlock) => unlock.entry);
}

/** The Shop Kits `characterName` owns — merged into their kitPool. */
export function unlockedKitsFor(characterName: string, unlockedKitIds: Record<string, string[]>): Kit[] {
  const owned = new Set(unlockedKitIds[characterName] ?? []);
  return KIT_SHOP_CATALOG.filter((entry) => entry.characterName === characterName && owned.has(entry.kit.id)).map(
    (entry) => entry.kit,
  );
}

/** A character's earned-through-play unlock: a Special Action/Trait added to their random pool once its condition is met. */
export interface ClearUnlock {
  characterName: string;
  name: string;
  /** For a Special Action — look its description up via ui/actionDescriptions.ts. */
  actionId?: ActionId;
  /** For a Trait, its own description. */
  description?: string;
  condition: UnlockCondition;
  /** Player-facing goal text — see conditionLabel. */
  conditionText: string;
  earned: boolean;
}

/** Every unlock `characterName` has, with whether `adventurerId` has earned it under `history`. */
export function clearUnlocksFor(characterName: string, adventurerId: string, history: RunHistoryState): ClearUnlock[] {
  return (CHARACTER_UNLOCK_POOL[characterName] ?? []).map(({ entry, condition }) => ({
    characterName,
    name: entry.kind === 'special-action' ? entry.specialAction.name : entry.trait.name,
    actionId: entry.kind === 'special-action' ? entry.specialAction.action.id : undefined,
    description: entry.kind === 'trait' ? entry.trait.description : undefined,
    condition,
    conditionText: conditionLabel(condition, characterName),
    earned: isUnlockEarned(condition, adventurerId, history),
  }));
}

/** The unlocks a finished run newly earned: earned under `after` but not under `before`, for each party member. */
export function newUnlocksForRun(party: Adventurer[], before: RunHistoryState, after: RunHistoryState): ClearUnlock[] {
  return party.flatMap((member) => {
    const earnedBefore = new Set(clearUnlocksFor(member.name, member.id, before).filter((u) => u.earned).map((u) => u.name));
    return clearUnlocksFor(member.name, member.id, after).filter((u) => u.earned && !earnedBefore.has(u.name));
  });
}

/** One Kit listing for a character, with whether they already own it. */
export interface KitProgress {
  kitId: string;
  name: string;
  description: string;
  price: number;
  owned: boolean;
}

/** Every Kit the Shop sells for `characterName`, with ownership from `unlockedKitIds` (metaProgression). */
export function kitsFor(characterName: string, unlockedKitIds: Record<string, string[]>): KitProgress[] {
  const owned = new Set(unlockedKitIds[characterName] ?? []);
  return KIT_SHOP_CATALOG.filter((entry) => entry.characterName === characterName).map((entry) => ({
    kitId: entry.kit.id,
    name: entry.kit.name,
    description: entry.kit.description,
    price: entry.price,
    owned: owned.has(entry.kit.id),
  }));
}

/**
 * Re-draws the pool Special and Kit of every offered recruit who isn't
 * already in the party (see sim/adventurer.ts's rerollPoolPicks) — called
 * whenever a shop rolls its recruit offers (state/openingShop.ts,
 * state/dungeonPlayback.ts's rollShopOffers). Passing on a character and
 * seeing them offered again later gives a fresh roll; the offer's tooltip
 * shows the Special they'll actually bring.
 */
export function rerollOfferedCharacters(offers: RecruitShopOffer[], rng: RngSource): void {
  const history = get(runHistory);
  const { unlockedKitIds } = get(metaProgression);
  let changed = false;
  for (const offer of offers) {
    if (offer.alreadyInParty) continue;
    const { adventurer } = offer;
    const template = CHARACTER_TEMPLATES.find((candidate) => candidate.name === adventurer.name);
    if (!template) continue;
    rerollPoolPicks(
      adventurer,
      template,
      unlockedPoolEntriesFor(template.name, adventurer.id, history),
      unlockedKitsFor(template.name, unlockedKitIds),
      rng,
    );
    changed = true;
  }
  if (changed) roster.update((state) => ({ ...state }));
}

/** What the most recent run earned — set by dungeonOrchestrator.ts's finishDungeonRun, shown once by the town toast. Not persisted. */
export interface RunReward {
  outcome: DungeonOutcome | null;
  renown: RunRenownBreakdown;
  newUnlocks: ClearUnlock[];
}

export const lastRunReward = writable<RunReward | null>(null);
