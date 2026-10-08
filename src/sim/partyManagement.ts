import type { Adventurer } from './adventurer';
import type { Action } from './action';
import type { GridPosition } from './formation';
import type { EnchantmentId } from './enchantments';
import type { EquipmentSlot, Item, RunInventory } from './items';

/**
 * Between-room party management. Every function here operates only on an
 * adventurer object and a run-scoped RunInventory — both live entirely
 * within a single dungeon run. Nothing here reads, writes, or even names
 * any persistent storage outside the run; that boundary is enforced by
 * having no parameter, return type, or import in this file capable of
 * referring to one.
 */

/**
 * Equips `item` into `slot`, pulling it out of `inventory`. If the slot was
 * already occupied, the previous item is swapped back into `inventory`
 * (never discarded, never sent anywhere else). Applies the item's stat
 * modifiers and removes the previous item's, if any; if `item` grants a
 * Special Action, adds it to `activeSpecialActions` — purely additively,
 * alongside whatever the character already has (see adventurer.ts's
 * `activeSpecialActions` doc comment and Item's `grantedSpecialAction` —
 * this replaces the old dice-era faceEffect overwrite/restore dance, which
 * is no longer needed since nothing here touches dieFaces at all).
 */
export function equipItem(adventurer: Adventurer, inventory: RunInventory, item: Item, slot: EquipmentSlot): void {
  if (item.slot !== slot) {
    throw new Error(`Item ${item.id} is a ${item.slot} item and cannot be equipped to slot ${slot}`);
  }

  const inventoryIndex = inventory.items.indexOf(item);
  if (inventoryIndex === -1) {
    throw new Error(`Item ${item.id} is not in the run inventory`);
  }

  const previousItem = adventurer.equipment[slot];
  if (previousItem) {
    adventurer.modifiers = adventurer.modifiers.filter((modifier) => !previousItem.modifiers.includes(modifier));
    if (previousItem.grantedSpecialAction) {
      adventurer.activeSpecialActions = adventurer.activeSpecialActions.filter(
        (special) => special !== previousItem.grantedSpecialAction,
      );
    }
    inventory.items.push(previousItem);
  }

  inventory.items.splice(inventoryIndex, 1);
  adventurer.equipment[slot] = item;
  adventurer.modifiers = [...adventurer.modifiers, ...item.modifiers];
  if (item.grantedSpecialAction) {
    adventurer.activeSpecialActions = [...adventurer.activeSpecialActions, item.grantedSpecialAction];
  }
}

/**
 * Unequips whatever occupies `slot`, returning it to `inventory`, removing
 * its stat modifiers and — if it granted one — its Special Action. No-op if
 * empty.
 */
export function unequipItem(adventurer: Adventurer, inventory: RunInventory, slot: EquipmentSlot): void {
  const item = adventurer.equipment[slot];
  if (!item) {
    return;
  }

  adventurer.modifiers = adventurer.modifiers.filter((modifier) => !item.modifiers.includes(modifier));
  if (item.grantedSpecialAction) {
    adventurer.activeSpecialActions = adventurer.activeSpecialActions.filter((special) => special !== item.grantedSpecialAction);
  }
  adventurer.equipment[slot] = null;
  inventory.items.push(item);
}

/**
 * How many of `adventurer`'s owned copies of `action` aren't currently
 * occupying a die face — i.e. available to swap in. Compares by reference,
 * not id: `ownedFaces`/`dieFaces` only ever hold the canonical Action
 * singletons from data/actions.ts's ACTION_REGISTRY, so a lookalike object
 * that merely shares an id (never a legitimate value in real play) can't
 * masquerade as an owned copy.
 */
export function spareFaceCount(adventurer: Adventurer, action: Action): number {
  const owned = adventurer.ownedFaces.filter((a) => a === action).length;
  const slotted = adventurer.dieFaces.filter((face) => face.action === action).length;
  return owned - slotted;
}

/** Every action `adventurer` owns at least one Face of, deduped — the pool a "swap in"/level-up-Face picker offers. */
export function distinctFaceActions(adventurer: Adventurer): Action[] {
  const seen = new Set<string>();
  const result: Action[] = [];
  for (const action of adventurer.ownedFaces) {
    if (!seen.has(action.id)) {
      seen.add(action.id);
      result.push(action);
    }
  }
  return result;
}

/**
 * Replaces the die face at `faceIndex` with `newAction`, only if a spare
 * owned copy is available (see spareFaceCount) — the face currently there
 * returns to the spare pool, same as it always could. Returns whether the
 * swap happened. Face order doesn't affect odds (each of the 6 faces is
 * rolled with equal probability) — this only changes *which* action lives
 * on that face. Replacing a face always clears any enchantment it carried —
 * a fresh face token, not a carry-over (see enchantFace to re-enchant).
 */
export function swapInAction(adventurer: Adventurer, newAction: Action, faceIndex: number): boolean {
  if (faceIndex < 0 || faceIndex >= adventurer.dieFaces.length) {
    return false;
  }
  if (spareFaceCount(adventurer, newAction) <= 0) {
    return false;
  }

  adventurer.dieFaces[faceIndex] = { action: newAction };
  return true;
}

/**
 * Sets (or clears, with `undefined`) the enchantment on die face
 * `faceIndex` — see dieFace.ts/enchantments.ts. Unlike swapInAction, this
 * isn't gated by ownership: there's no enchantment-acquisition economy yet
 * (roadmap item 7 Phase 4 is a stub/proof-of-concept), so enchanting is
 * currently free and unlimited. Returns whether it happened (only fails on
 * an out-of-range faceIndex).
 */
export function enchantFace(adventurer: Adventurer, faceIndex: number, enchantmentId: EnchantmentId | undefined): boolean {
  if (faceIndex < 0 || faceIndex >= adventurer.dieFaces.length) {
    return false;
  }

  adventurer.dieFaces[faceIndex] = { ...adventurer.dieFaces[faceIndex], enchantmentId };
  return true;
}

/**
 * Reassigns `adventurer`'s full grid position (lane + rank) — see
 * formation.ts. Always succeeds; no eligibility rule to fail (the caller
 * decides whether to enforce "one living party member per cell" — see
 * ui/PartyLayoutGrid.svelte's swap-on-occupied-cell convention). Replaces
 * the old front/back-only `setRow` once per-fight full 3x3 placement
 * shipped (the Autobattle Revision Cleanup's "Character Layout Choice"
 * pass — see docs/roadmap.md).
 */
export function setPosition(adventurer: Adventurer, position: GridPosition): void {
  adventurer.position = position;
}
