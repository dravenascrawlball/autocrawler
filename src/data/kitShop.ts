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
  // Halloween event Kits
  GUDRUN_HALLOWEEN_KIT,
  DAWNETH_HALLOWEEN_KIT,
  ISILWEN_HALLOWEEN_KIT,
  THARAVEL_HALLOWEEN_KIT,
  BODIL_HALLOWEEN_KIT,
  GLINT_HALLOWEEN_KIT,
  DRIFTA_HALLOWEEN_KIT,
  FALLACY_HALLOWEEN_KIT,
  MIRKA_HALLOWEEN_KIT,
  NERISSA_HALLOWEEN_KIT,
  DRAVENA_HALLOWEEN_KIT,
  CALADWEN_HALLOWEEN_KIT,
  MELPOMENE_HALLOWEEN_KIT,
  MIRA_HALLOWEEN_KIT,
} from './kits';

/** One Shop listing: a Kit purchasable for `price` Renown, tied to the one character it applies to (matches AdventurerTemplate.name, same convention as data/characterUnlocks.ts). */
export interface KitShopEntry {
  characterName: string;
  kit: Kit;
  price: number;
  /**
   * A seasonal event Kit: while that event is active (data/events.ts) it
   * can't be bought — it's earned instead (state/progression.ts's
   * kitsFor shows how); once the event is off it sells for `price`.
   */
  event?: 'halloween';
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
  // Halloween event Kits — earned while HALLOWEEN_EVENT_ACTIVE, sold for Renown after.
  { characterName: 'Gudrun', kit: GUDRUN_HALLOWEEN_KIT, price: 50, event: 'halloween' },
  { characterName: 'Dawneth', kit: DAWNETH_HALLOWEEN_KIT, price: 50, event: 'halloween' },
  { characterName: 'Isilwen', kit: ISILWEN_HALLOWEEN_KIT, price: 50, event: 'halloween' },
  { characterName: 'Tharavel', kit: THARAVEL_HALLOWEEN_KIT, price: 50, event: 'halloween' },
  { characterName: 'Bodil', kit: BODIL_HALLOWEEN_KIT, price: 50, event: 'halloween' },
  { characterName: 'Glint', kit: GLINT_HALLOWEEN_KIT, price: 50, event: 'halloween' },
  { characterName: 'Drifta', kit: DRIFTA_HALLOWEEN_KIT, price: 50, event: 'halloween' },
  { characterName: 'Fallacy', kit: FALLACY_HALLOWEEN_KIT, price: 50, event: 'halloween' },
  { characterName: 'Mirka', kit: MIRKA_HALLOWEEN_KIT, price: 50, event: 'halloween' },
  { characterName: 'Nerissa', kit: NERISSA_HALLOWEEN_KIT, price: 50, event: 'halloween' },
  { characterName: 'Dravena', kit: DRAVENA_HALLOWEEN_KIT, price: 50, event: 'halloween' },
  { characterName: 'Caladwen', kit: CALADWEN_HALLOWEEN_KIT, price: 50, event: 'halloween' },
  { characterName: 'Melpomene', kit: MELPOMENE_HALLOWEEN_KIT, price: 50, event: 'halloween' },
  { characterName: 'Mira', kit: MIRA_HALLOWEEN_KIT, price: 50, event: 'halloween' },
];
