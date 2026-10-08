import type { Kit } from './kits';

/** Just the piece of meta-progression state buyKit needs to touch — sim/ stays decoupled from state/metaProgression.ts's full shape. */
export interface RenownWallet {
  renown: number;
}

/**
 * Buys `kit` for `characterName` from the Shop's Kit catalog (see
 * data/kitShop.ts): deducts `price` from `wallet.renown` and records the
 * unlock in `unlockedKitIds` (characterName -> owned kit ids). Merged into
 * that character's kitPool at their next creation/reset (see
 * sim/adventurer.ts's createAdventurer/resetToTemplateBaseline) — same
 * "takes effect on their very next run" convention as
 * data/characterUnlocks.ts's free Special Action/Trait unlocks. No-ops,
 * returning false, if Renown is insufficient or `characterName` already
 * owns this Kit.
 */
export function buyKit(
  characterName: string,
  kit: Kit,
  price: number,
  wallet: RenownWallet,
  unlockedKitIds: Record<string, string[]>,
): boolean {
  const owned = unlockedKitIds[characterName] ?? [];
  if (owned.includes(kit.id)) {
    return false;
  }
  if (wallet.renown < price) {
    return false;
  }

  wallet.renown -= price;
  unlockedKitIds[characterName] = [...owned, kit.id];
  return true;
}
