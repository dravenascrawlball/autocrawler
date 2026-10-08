import type { StatModifier } from './stats';
import type { SpecialAction } from './specialActions';

export type EquipmentSlot = 'weapon' | 'armor' | 'trinket';

export interface Item {
  id: string;
  name: string;
  slot: EquipmentSlot;
  /** Stat modifiers this item grants while equipped; source should read `item:<itemId>`. */
  modifiers: StatModifier[];
  /** Gold cost to buy this item from the town shop. */
  price: number;
  /**
   * A kit-altering effect beyond stat modifiers (roadmap item 13) — grants
   * this Special Action while equipped, purely additively alongside
   * whatever the character already has (see partyManagement.ts's
   * equipItem/unequipItem). Replaces the dice-era FaceEffect mechanism
   * (overwriting/restoring a die face), which went dead once the turn
   * engine stopped reading dieFaces at all (step 2 of the combat overhaul).
   */
  grantedSpecialAction?: SpecialAction;
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
