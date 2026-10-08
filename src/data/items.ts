import type { Item } from '../sim/items';
import { RING_OF_EMBERS_BURN_SPECIAL } from './specialActions';

/**
 * Item roster grouped by the enemy archetype whose loot table drops it
 * (see enemies.ts) — Grunt gear is light/common, Brute gear is heavy
 * melee, Shaman gear is magic/utility (percent modifiers, reach, support).
 * Several items carry a tradeoff (a second, opposing modifier) rather than
 * a single flat bonus, so equip choices aren't strictly additive.
 *
 * Shop price is flat per tier (matching the same Grunt/Brute/Shaman
 * grouping as the loot tables) rather than per-item, pending the real
 * balance pass (roadmap item 6).
 */
const GRUNT_TIER_PRICE = 15;
const BRUTE_TIER_PRICE = 35;
const SHAMAN_TIER_PRICE = 55;

// --- Grunt loot: light, common gear ---

export const RUSTY_DAGGER_ITEM: Item = {
  id: 'rusty-dagger',
  name: 'Rusty Dagger',
  slot: 'weapon',
  modifiers: [{ stat: 'attackPower', type: 'flat', amount: 2, source: 'item:rusty-dagger' }],
  price: GRUNT_TIER_PRICE,
};

export const WOODEN_SHIELD_ITEM: Item = {
  id: 'wooden-shield',
  name: 'Wooden Shield',
  slot: 'armor',
  modifiers: [
    { stat: 'maxHp', type: 'flat', amount: 5, source: 'item:wooden-shield' },
    { stat: 'armor', type: 'flat', amount: 2, source: 'item:wooden-shield' },
  ],
  price: GRUNT_TIER_PRICE,
};

export const LEATHER_ARMOR_ITEM: Item = {
  id: 'leather-armor',
  name: 'Leather Armor',
  slot: 'armor',
  modifiers: [
    { stat: 'maxHp', type: 'flat', amount: 6, source: 'item:leather-armor' },
    { stat: 'speed', type: 'flat', amount: 1, source: 'item:leather-armor' },
    { stat: 'armor', type: 'flat', amount: 1, source: 'item:leather-armor' },
  ],
  price: GRUNT_TIER_PRICE,
};

export const LUCKY_RING_ITEM: Item = {
  id: 'lucky-ring',
  name: 'Lucky Ring',
  slot: 'trinket',
  modifiers: [{ stat: 'speed', type: 'flat', amount: 1, source: 'item:lucky-ring' }],
  price: GRUNT_TIER_PRICE,
};

export const SWIFT_BOOTS_ITEM: Item = {
  id: 'swift-boots',
  name: 'Swift Boots',
  slot: 'trinket',
  modifiers: [
    { stat: 'speed', type: 'flat', amount: 2, source: 'item:swift-boots' },
    { stat: 'maxHp', type: 'flat', amount: -3, source: 'item:swift-boots' },
  ],
  price: GRUNT_TIER_PRICE,
};

// --- Brute loot: heavy melee gear ---

export const IRON_SWORD_ITEM: Item = {
  id: 'iron-sword',
  name: 'Iron Sword',
  slot: 'weapon',
  modifiers: [{ stat: 'attackPower', type: 'flat', amount: 4, source: 'item:iron-sword' }],
  price: BRUTE_TIER_PRICE,
};

export const WARHAMMER_ITEM: Item = {
  id: 'warhammer',
  name: 'Heavy Warhammer',
  slot: 'weapon',
  modifiers: [
    { stat: 'attackPower', type: 'flat', amount: 7, source: 'item:warhammer' },
    { stat: 'speed', type: 'flat', amount: -1, source: 'item:warhammer' },
  ],
  price: BRUTE_TIER_PRICE,
};

export const CHAINMAIL_ITEM: Item = {
  id: 'chainmail',
  name: 'Chainmail',
  slot: 'armor',
  modifiers: [
    { stat: 'maxHp', type: 'flat', amount: 12, source: 'item:chainmail' },
    { stat: 'speed', type: 'flat', amount: -1, source: 'item:chainmail' },
    { stat: 'armor', type: 'flat', amount: 4, source: 'item:chainmail' },
  ],
  price: BRUTE_TIER_PRICE,
};

export const SPIKED_BUCKLER_ITEM: Item = {
  id: 'spiked-buckler',
  name: 'Spiked Buckler',
  slot: 'armor',
  modifiers: [
    { stat: 'maxHp', type: 'flat', amount: 3, source: 'item:spiked-buckler' },
    { stat: 'attackPower', type: 'flat', amount: 1, source: 'item:spiked-buckler' },
    { stat: 'armor', type: 'flat', amount: 2, source: 'item:spiked-buckler' },
  ],
  price: BRUTE_TIER_PRICE,
};

export const BERSERKERS_TOTEM_ITEM: Item = {
  id: 'berserkers-totem',
  name: "Berserker's Totem",
  slot: 'trinket',
  modifiers: [
    { stat: 'attackPower', type: 'flat', amount: 4, source: 'item:berserkers-totem' },
    { stat: 'maxHp', type: 'flat', amount: -4, source: 'item:berserkers-totem' },
  ],
  price: BRUTE_TIER_PRICE,
};

// --- Shaman loot: magic/utility gear ---

export const LONG_SPEAR_ITEM: Item = {
  id: 'long-spear',
  name: 'Long Spear',
  slot: 'weapon',
  // Used to also grant +1 range; that stat no longer exists now that reach
  // is a fixed melee/ranged category on the action rather than a number
  // (roadmap item 7's front/back-row follow-up) — folded into attackPower
  // instead so the item keeps roughly its old total value.
  modifiers: [{ stat: 'attackPower', type: 'flat', amount: 2, source: 'item:long-spear' }],
  price: SHAMAN_TIER_PRICE,
};

export const ASSASSINS_BLADE_ITEM: Item = {
  id: 'assassins-blade',
  name: "Assassin's Blade",
  slot: 'weapon',
  modifiers: [{ stat: 'attackPower', type: 'percent', amount: 20, source: 'item:assassins-blade' }],
  price: SHAMAN_TIER_PRICE,
};

export const TOWER_SHIELD_ITEM: Item = {
  id: 'tower-shield',
  name: 'Tower Shield',
  slot: 'armor',
  // Used to also grant -1 move range; movement no longer exists (roadmap
  // item 7's front/back-row follow-up removed it entirely), so that
  // downside is simply gone rather than replaced.
  modifiers: [
    { stat: 'maxHp', type: 'percent', amount: 20, source: 'item:tower-shield' },
    { stat: 'armor', type: 'flat', amount: 3, source: 'item:tower-shield' },
  ],
  price: SHAMAN_TIER_PRICE,
};

export const AMULET_OF_VIGOR_ITEM: Item = {
  id: 'amulet-of-vigor',
  name: 'Amulet of Vigor',
  slot: 'trinket',
  modifiers: [{ stat: 'interRoomHeal', type: 'flat', amount: 3, source: 'item:amulet-of-vigor' }],
  price: SHAMAN_TIER_PRICE,
};

export const SAGES_CHARM_ITEM: Item = {
  id: 'sages-charm',
  name: "Sage's Charm",
  slot: 'trinket',
  modifiers: [
    { stat: 'attackPower', type: 'percent', amount: 15, source: 'item:sages-charm' },
    { stat: 'interRoomHeal', type: 'flat', amount: 1, source: 'item:sages-charm' },
  ],
  price: SHAMAN_TIER_PRICE,
};

// --- Magic items: kit-altering effects, not just stat modifiers (roadmap item 13) ---
// Loot-only (never added to ALL_ITEMS, so never shop-purchasable) — 2 bespoke signature items
// proving the mechanism, not a full roster.

export const RING_OF_EMBERS_ITEM: Item = {
  id: 'ring-of-embers',
  name: 'Ring of Embers',
  slot: 'trinket',
  modifiers: [{ stat: 'speed', type: 'flat', amount: 1, source: 'item:ring-of-embers' }],
  price: SHAMAN_TIER_PRICE,
  grantedSpecialAction: RING_OF_EMBERS_BURN_SPECIAL,
};

export const TOME_OF_POWER_ITEM: Item = {
  id: 'tome-of-power',
  name: 'Tome of Power',
  slot: 'trinket',
  modifiers: [{ stat: 'attackPower', type: 'flat', amount: 1, source: 'item:tome-of-power' }],
  price: SHAMAN_TIER_PRICE,
};

/** Magic items — resolvable via ITEM_REGISTRY (loot drops), deliberately excluded from ALL_ITEMS/the shop. */
export const MAGIC_ITEMS: Item[] = [RING_OF_EMBERS_ITEM, TOME_OF_POWER_ITEM];

/** Full item roster, one entry per item defined above. */
export const ALL_ITEMS: Item[] = [
  RUSTY_DAGGER_ITEM,
  WOODEN_SHIELD_ITEM,
  LEATHER_ARMOR_ITEM,
  LUCKY_RING_ITEM,
  SWIFT_BOOTS_ITEM,
  IRON_SWORD_ITEM,
  WARHAMMER_ITEM,
  CHAINMAIL_ITEM,
  SPIKED_BUCKLER_ITEM,
  BERSERKERS_TOTEM_ITEM,
  LONG_SPEAR_ITEM,
  ASSASSINS_BLADE_ITEM,
  TOWER_SHIELD_ITEM,
  AMULET_OF_VIGOR_ITEM,
  SAGES_CHARM_ITEM,
];

/** Basic starter kit a fresh town storage begins with — one item per slot, all from the Grunt (common) tier. */
export const STARTER_TOWN_ITEMS: Item[] = [RUSTY_DAGGER_ITEM, WOODEN_SHIELD_ITEM, LUCKY_RING_ITEM];

/** Resolves an item id (e.g. from a loot table) to its definition. */
export const ITEM_REGISTRY: Record<string, Item> = Object.fromEntries(
  [...ALL_ITEMS, ...MAGIC_ITEMS].map((item) => [item.id, item]),
);
