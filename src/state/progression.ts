import { writable } from 'svelte/store';
import type { Adventurer } from '../sim/adventurer';
import type { ActionId } from '../sim/action';
import type { CharacterPoolEntry } from '../sim/characterPool';
import type { DungeonOutcome } from '../sim/dungeonRun';
import type { RunRenownBreakdown } from '../sim/renown';
import { CHARACTER_UNLOCK_POOL } from '../data/characterUnlocks';
import { KIT_SHOP_CATALOG } from '../data/kitShop';

/**
 * Read-side helpers for the meta-progression UI (roadmap item 3): what a
 * character has unlocked, what's still locked and how to get it, and what
 * the last run earned. Pure lookups over data/characterUnlocks.ts,
 * data/kitShop.ts and the runHistory/metaProgression stores' values — no
 * game logic of its own lives here.
 */

/** A clear-unlock: a Special Action/Trait added to a character's random pool once they've cleared a run. */
export interface ClearUnlock {
  characterName: string;
  name: string;
  /** For a Special Action — look its description up via ui/actionDescriptions.ts. */
  actionId?: ActionId;
  /** For a Trait, its own description. */
  description?: string;
}

function toClearUnlock(characterName: string, entry: CharacterPoolEntry): ClearUnlock {
  return entry.kind === 'special-action'
    ? { characterName, name: entry.specialAction.name, actionId: entry.specialAction.action.id }
    : { characterName, name: entry.trait.name, description: entry.trait.description };
}

/** Every clear-unlock `characterName` has, earned or not. */
export function clearUnlocksFor(characterName: string): ClearUnlock[] {
  return (CHARACTER_UNLOCK_POOL[characterName] ?? []).map((entry) => toClearUnlock(characterName, entry));
}

/**
 * The clear-unlocks a just-finished run newly earned: on a completed run,
 * every party member who hadn't cleared before (`clearedBefore`) and has an
 * unlock entry. Empty for a loss/retreat.
 */
export function newUnlocksForRun(party: Adventurer[], outcome: DungeonOutcome | null, clearedBefore: string[]): ClearUnlock[] {
  if (outcome !== 'completed') return [];
  return party.filter((member) => !clearedBefore.includes(member.id)).flatMap((member) => clearUnlocksFor(member.name));
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

/** What the most recent run earned — set by dungeonOrchestrator.ts's finishDungeonRun, shown once by the town toast. Not persisted. */
export interface RunReward {
  outcome: DungeonOutcome | null;
  renown: RunRenownBreakdown;
  newUnlocks: ClearUnlock[];
}

export const lastRunReward = writable<RunReward | null>(null);
