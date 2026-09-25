import type { Adventurer } from './adventurer';
import type { Action } from './action';
import type { Row } from './formation';
import type { EnchantmentId } from './enchantments';
import type { EquipmentSlot, FaceEffect, Item, RunInventory } from './items';

/**
 * Between-room party management. Every function here operates only on an
 * adventurer object and a run-scoped RunInventory — both live entirely
 * within a single dungeon run. Nothing here reads, writes, or even names
 * any persistent storage outside the run; that boundary is enforced by
 * having no parameter, return type, or import in this file capable of
 * referring to one.
 */

/**
 * Writes `faceEffect`'s effect onto `adventurer`'s die face at
 * `faceEffect.faceIndex`, replacing whatever's there. Exported for
 * `adventurer.ts`'s `resetToTemplateBaseline`, which re-applies every
 * equipped item's faceEffect fresh against the just-rebuilt baseline (no
 * `previousFace` snapshot needed there — the rebuild is already clean, see
 * that function's own doc comment).
 */
export function applyFaceEffect(adventurer: Adventurer, faceEffect: FaceEffect): void {
  const { faceIndex, effect } = faceEffect;
  if (effect.kind === 'replace-action') {
    adventurer.dieFaces[faceIndex] = { action: effect.action };
  } else {
    adventurer.dieFaces[faceIndex] = { ...adventurer.dieFaces[faceIndex], enchantmentId: effect.enchantmentId };
  }
}

/**
 * True if `faceIndex` is currently controlled by one of `adventurer`'s
 * equipped items' faceEffect (roadmap item 13) — checked via `previousFace`
 * being set, i.e. the effect is actually active right now, not just present
 * on an item sitting unequipped somewhere. `swapInAction`/`enchantFace`
 * refuse to touch a locked face, so `unequipItem`'s restore is never racing
 * a newer manual change.
 */
export function isFaceLockedByEquipment(adventurer: Adventurer, faceIndex: number): boolean {
  return Object.values(adventurer.equipment).some(
    (item) => item?.faceEffect?.faceIndex === faceIndex && item.faceEffect.previousFace !== undefined,
  );
}

/**
 * Equips `item` into `slot`, pulling it out of `inventory`. If the slot was
 * already occupied, the previous item is swapped back into `inventory`
 * (never discarded, never sent anywhere else), including restoring
 * whatever face it had overridden. Applies the item's stat modifiers and
 * removes the previous item's, if any; if `item` has a `faceEffect`,
 * snapshots the current face (for `unequipItem` to restore later) then
 * overwrites it.
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
    if (previousItem.faceEffect?.previousFace) {
      adventurer.dieFaces[previousItem.faceEffect.faceIndex] = previousItem.faceEffect.previousFace;
      previousItem.faceEffect.previousFace = undefined;
    }
    inventory.items.push(previousItem);
  }

  inventory.items.splice(inventoryIndex, 1);
  adventurer.equipment[slot] = item;
  adventurer.modifiers = [...adventurer.modifiers, ...item.modifiers];
  if (item.faceEffect) {
    item.faceEffect.previousFace = { ...adventurer.dieFaces[item.faceEffect.faceIndex] };
    applyFaceEffect(adventurer, item.faceEffect);
  }
}

/**
 * Unequips whatever occupies `slot`, returning it to `inventory`, removing
 * its stat modifiers, and — if it had a `faceEffect` — restoring exactly
 * what was on that face before it was equipped. No-op if empty.
 */
export function unequipItem(adventurer: Adventurer, inventory: RunInventory, slot: EquipmentSlot): void {
  const item = adventurer.equipment[slot];
  if (!item) {
    return;
  }

  adventurer.modifiers = adventurer.modifiers.filter((modifier) => !item.modifiers.includes(modifier));
  if (item.faceEffect?.previousFace) {
    adventurer.dieFaces[item.faceEffect.faceIndex] = item.faceEffect.previousFace;
    item.faceEffect.previousFace = undefined;
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
  if (isFaceLockedByEquipment(adventurer, faceIndex)) {
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
  if (isFaceLockedByEquipment(adventurer, faceIndex)) {
    return false;
  }

  adventurer.dieFaces[faceIndex] = { ...adventurer.dieFaces[faceIndex], enchantmentId };
  return true;
}

/** Reassigns `adventurer`'s formation row (front/back) — see formation.ts. Always succeeds; no eligibility rule to fail. */
export function setRow(adventurer: Adventurer, row: Row): void {
  adventurer.row = row;
}
