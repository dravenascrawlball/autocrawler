import type { Kit } from '../sim/kits';
import {
  GUDRUN_BERSERKER_KIT,
  NERISSA_SHADOW_THIEF_KIT,
  CALADWEN_VENOMOUS_BLADE_KIT,
  BODIL_FUR_AND_FURY_KIT,
  GLINT_GILDED_BIKINI_MAIL_KIT,
  MIRKA_VALKYRIES_WINGS_KIT,
  DRIFTA_SEA_SPRAY_CORSAIR_KIT,
  ISILWEN_HIGH_ROLLER_KIT,
  DRAVENA_MIDNIGHT_ENCHANTRESS_KIT,
  MELPOMENE_GLADE_HUNTRESS_KIT,
  DAWNETH_TEMPLE_DANCER_KIT,
  MIRA_TAVERN_ALCHEMIST_KIT,
  FALLACY_MASQUERADE_KIT,
  THARAVEL_FIELD_MEDIC_KIT,
} from './kits';

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
  { characterName: 'Bodil', kit: BODIL_FUR_AND_FURY_KIT, price: 40 },
  { characterName: 'Glint', kit: GLINT_GILDED_BIKINI_MAIL_KIT, price: 40 },
  { characterName: 'Mirka', kit: MIRKA_VALKYRIES_WINGS_KIT, price: 40 },
  { characterName: 'Drifta', kit: DRIFTA_SEA_SPRAY_CORSAIR_KIT, price: 40 },
  { characterName: 'Isilwen', kit: ISILWEN_HIGH_ROLLER_KIT, price: 40 },
  { characterName: 'Dravena', kit: DRAVENA_MIDNIGHT_ENCHANTRESS_KIT, price: 40 },
  { characterName: 'Melpomene', kit: MELPOMENE_GLADE_HUNTRESS_KIT, price: 40 },
  { characterName: 'Dawneth', kit: DAWNETH_TEMPLE_DANCER_KIT, price: 40 },
  { characterName: 'Mira', kit: MIRA_TAVERN_ALCHEMIST_KIT, price: 40 },
  { characterName: 'Fallacy', kit: FALLACY_MASQUERADE_KIT, price: 40 },
  { characterName: 'Tharavel', kit: THARAVEL_FIELD_MEDIC_KIT, price: 40 },
];
