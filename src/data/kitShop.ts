import type { Kit } from '../sim/kits';
import { GUDRUN_BERSERKER_KIT, NERISSA_SHADOW_THIEF_KIT, CALADWEN_VENOMOUS_BLADE_KIT } from './kits';

/** One Shop listing: a Kit purchasable for `price` Renown, tied to the one character it applies to (matches AdventurerTemplate.name, same convention as data/characterUnlocks.ts). */
export interface KitShopEntry {
  characterName: string;
  kit: Kit;
  price: number;
}

/** The Shop's full Kit roster (ui/ShopView.svelte) — placeholder prices pending the balance pass, same convention as recruitCost/item prices. */
export const KIT_SHOP_CATALOG: KitShopEntry[] = [
  { characterName: 'Gudrun', kit: GUDRUN_BERSERKER_KIT, price: 40 },
  { characterName: 'Nerissa', kit: NERISSA_SHADOW_THIEF_KIT, price: 40 },
  { characterName: 'Caladwen', kit: CALADWEN_VENOMOUS_BLADE_KIT, price: 40 },
];
