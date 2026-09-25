import type { StatModifier } from './stats';
import type { Action } from './action';
import type { EnchantmentId } from './enchantments';
import type { DieFace } from './dieFace';
import type { RngSource } from './rng';

export type EquipmentSlot = 'weapon' | 'armor' | 'trinket';

export type FaceEffectKind =
  | { kind: 'replace-action'; action: Action }
  | { kind: 'enchant'; enchantmentId: EnchantmentId };

/**
 * A kit-altering effect beyond stat modifiers (roadmap item 13) — e.g.
 * "replace die face 3 with Power Attack" or "die face 1 gets the Burning
 * enchantment". `faceIndex` is rolled once, when the item is actually
 * generated (see rollItemInstance), not chosen by the player.
 */
export interface FaceEffect {
  faceIndex: number;
  effect: FaceEffectKind;
  /**
   * Snapshot of what occupied this face immediately before this item was
   * equipped — set by equipItem/resetToTemplateBaseline's re-apply step,
   * consumed by unequipItem to restore it exactly. Undefined while the item
   * sits unequipped (a run's inventory or town storage).
   */
  previousFace?: DieFace;
}

export interface Item {
  id: string;
  name: string;
  slot: EquipmentSlot;
  /** Stat modifiers this item grants while equipped; source should read `item:<itemId>`. */
  modifiers: StatModifier[];
  /** Gold cost to buy this item from the town shop. */
  price: number;
  faceEffect?: FaceEffect;
  /**
   * Whether the player has already been prompted about (equipped or
   * skipped) this specific item while it sat in a run's inventory — see
   * ui/LootModal.svelte. Meaningless outside an active run's inventory,
   * same as Adventurer.downedSummary.acknowledged.
   */
  promptDismissed?: boolean;
}

export interface EquipmentSlots {
  weapon: Item | null;
  armor: Item | null;
  trinket: Item | null;
}

export function createEmptyEquipmentSlots(): EquipmentSlots {
  return { weapon: null, armor: null, trinket: null };
}

export interface LootTableEntry {
  itemId: string;
  /** Independent drop probability in [0, 1]. */
  dropChance: number;
}

/** Resolves an item id to its definition; injected so sim/ never depends on data/. */
export type ItemLookup = (itemId: string) => Item;

/**
 * Inventory scoped to a single dungeon run. Deliberately structurally
 * separate from any persistent player-owned storage — no save-slot or
 * external-storage identifier ever appears here, and nothing in this
 * module reads or writes outside the run itself.
 */
export interface RunInventory {
  items: Item[];
  /** Gold collected during the run so far; not an item, merged separately into town gold. */
  gold: number;
}

export function createRunInventory(): RunInventory {
  return { items: [], gold: 0 };
}

/** Every adventurer has exactly 6 die faces (see dieFace.ts) — the range rollItemInstance rolls a faceEffect's faceIndex from. */
const DIE_FACE_COUNT = 6;

/**
 * Returns a fresh copy of `item` with its `faceEffect`'s `faceIndex` freshly
 * rolled — called once, when the item is actually instantiated into the
 * world (a loot drop; see loot.ts), so multiple drops of the same magic
 * item can land on different faces. A no-op passthrough (returns `item`
 * unchanged) for any item without a faceEffect.
 */
export function rollItemInstance(item: Item, rng: RngSource): Item {
  if (!item.faceEffect) {
    return item;
  }
  return {
    ...item,
    faceEffect: { ...item.faceEffect, faceIndex: Math.floor(rng() * DIE_FACE_COUNT) },
  };
}
