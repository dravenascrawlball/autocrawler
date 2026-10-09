import type { Kit } from '../sim/kits';

/**
 * The first real Kit content (docs/kit-trait-tag-framework.md's "none yet"
 * gap) — alternate-costume stat variants sold from the Shop for Renown
 * (see data/kitShop.ts), not freely rolled: deliberately NOT placed on any
 * AdventurerTemplate.kitPool directly, since that would let pickKit draw
 * them for free at creation. A character only has one of these available
 * to roll once the player's bought it (see sim/kits.ts's applyKit/
 * state/metaProgression.ts's unlockedKitIds). Placeholder stat swings,
 * pending the balance pass, same convention as every other number here.
 */
export const GUDRUN_BERSERKER_KIT: Kit = {
  id: 'gudrun-berserker',
  name: "Berserker's Fury",
  description: 'A reckless alternate build: +13% Attack Power, -15% Max HP.',
  modifiers: [
    { stat: 'attackPower', type: 'percent', amount: 13, source: 'kit:gudrun-berserker' },
    { stat: 'maxHp', type: 'percent', amount: -15, source: 'kit:gudrun-berserker' },
  ],
  artKey: 'gudrun-berserker',
  title: 'Berserker',
};

export const NERISSA_SHADOW_THIEF_KIT: Kit = {
  id: 'nerissa-shadow-thief',
  name: 'Shadow Thief',
  description: 'A swifter, sharper alternate build: +10% Speed, -10% Max HP.',
  modifiers: [
    { stat: 'speed', type: 'percent', amount: 10, source: 'kit:nerissa-shadow-thief' },
    { stat: 'maxHp', type: 'percent', amount: -10, source: 'kit:nerissa-shadow-thief' },
  ],
  artKey: 'nerissa-shadow-thief',
  title: 'Shadow Thief',
};

export const CALADWEN_VENOMOUS_BLADE_KIT: Kit = {
  id: 'caladwen-venomous-blade',
  name: 'Venomous Blade',
  description: 'A more aggressive alternate build: +10% Attack Power, -10% Max HP.',
  modifiers: [
    { stat: 'attackPower', type: 'percent', amount: 10, source: 'kit:caladwen-venomous-blade' },
    { stat: 'maxHp', type: 'percent', amount: -10, source: 'kit:caladwen-venomous-blade' },
  ],
  artKey: 'caladwen-venomous-blade',
  title: 'Venomous Blade',
};

// --- Kits for everyone (Renown shop): one costume per character, flirty-fantasy pin-up flavor ---
// Each is a trade-off (a strength paid for, mostly in Max HP) rather than a pure upgrade, so a Kit
// is a playstyle choice: all-Kits-bought tested at +16 points full-clear as pure upgrades.
// Most change only stats and the displayed title; Corsair, Masquerade and Field Medic also swap the
// character's synergy role (Kit.synergyRole) as a deliberate build lever.

export const BODIL_FUR_AND_FURY_KIT: Kit = {
  id: 'bodil-fur-and-fury',
  name: 'Fur & Fury',
  description: 'A barbarian fur bikini and not much else: +10% Attack Power, -10% Max HP.',
  modifiers: [
    { stat: 'attackPower', type: 'percent', amount: 10, source: 'kit:bodil-fur-and-fury' },
    { stat: 'maxHp', type: 'percent', amount: -10, source: 'kit:bodil-fur-and-fury' },
  ],
  artKey: 'bodil-fur-and-fury',
  title: 'Barbarian',
};

export const GLINT_GILDED_BIKINI_MAIL_KIT: Kit = {
  id: 'glint-gilded-bikini-mail',
  name: 'Gilded Bikini Mail',
  description: 'Polished golden bikini armor that catches every eye: +10% Max HP, -10% Speed.',
  modifiers: [
    { stat: 'maxHp', type: 'percent', amount: 10, source: 'kit:glint-gilded-bikini-mail' },
    { stat: 'speed', type: 'percent', amount: -10, source: 'kit:glint-gilded-bikini-mail' },
  ],
  artKey: 'glint-gilded-bikini-mail',
  title: 'Gilded Champion',
};

export const MIRKA_VALKYRIES_WINGS_KIT: Kit = {
  id: 'mirka-valkyries-wings',
  name: "Valkyrie's Wings",
  description: 'Winged helm and an armored bodice fit for a saga: +8% Max HP, -5% Speed.',
  modifiers: [
    { stat: 'maxHp', type: 'percent', amount: 8, source: 'kit:mirka-valkyries-wings' },
    { stat: 'speed', type: 'percent', amount: -5, source: 'kit:mirka-valkyries-wings' },
  ],
  artKey: 'mirka-valkyries-wings',
  title: 'Valkyrie',
};

export const DRIFTA_SEA_SPRAY_CORSAIR_KIT: Kit = {
  id: 'drifta-sea-spray-corsair',
  name: 'Sea-Spray Corsair',
  description: "A pirate captain's open coat and a wicked grin: +7% Speed, -10% Max HP. Counts as a Rogue for synergies.",
  modifiers: [
    { stat: 'speed', type: 'percent', amount: 7, source: 'kit:drifta-sea-spray-corsair' },
    { stat: 'maxHp', type: 'percent', amount: -10, source: 'kit:drifta-sea-spray-corsair' },
  ],
  artKey: 'drifta-sea-spray-corsair',
  title: 'Corsair',
  synergyRole: 'Rogue',
};

export const ISILWEN_HIGH_ROLLER_KIT: Kit = {
  id: 'isilwen-high-roller',
  name: 'High Roller',
  description: "A silk dealer's gown with a deck tucked in her garter: +5 Crit Chance, -10% Max HP.",
  modifiers: [
    { stat: 'critChance', type: 'flat', amount: 5, source: 'kit:isilwen-high-roller' },
    { stat: 'maxHp', type: 'percent', amount: -10, source: 'kit:isilwen-high-roller' },
  ],
  artKey: 'isilwen-high-roller',
  title: 'Card Sharp',
};

export const DRAVENA_MIDNIGHT_ENCHANTRESS_KIT: Kit = {
  id: 'dravena-midnight-enchantress',
  name: 'Midnight Enchantress',
  description: 'Sheer starlit robes that shimmer with every spell: +10% Attack Power, -10% Max HP.',
  modifiers: [
    { stat: 'attackPower', type: 'percent', amount: 10, source: 'kit:dravena-midnight-enchantress' },
    { stat: 'maxHp', type: 'percent', amount: -10, source: 'kit:dravena-midnight-enchantress' },
  ],
  artKey: 'dravena-midnight-enchantress',
  title: 'Enchantress',
};

export const MELPOMENE_GLADE_HUNTRESS_KIT: Kit = {
  id: 'melpomene-glade-huntress',
  name: 'Glade Huntress',
  description: 'A leaf-and-vine bikini and a longbow, at home in the deep woods: +7% Speed, -10% Max HP.',
  modifiers: [
    { stat: 'speed', type: 'percent', amount: 7, source: 'kit:melpomene-glade-huntress' },
    { stat: 'maxHp', type: 'percent', amount: -10, source: 'kit:melpomene-glade-huntress' },
  ],
  artKey: 'melpomene-glade-huntress',
  title: 'Huntress',
};

export const DAWNETH_TEMPLE_DANCER_KIT: Kit = {
  id: 'dawneth-temple-dancer',
  name: 'Temple Dancer',
  description: 'Veils and bangles that chime as she heals: +10% Heal Power, -10% Max HP.',
  modifiers: [
    { stat: 'healPower', type: 'percent', amount: 10, source: 'kit:dawneth-temple-dancer' },
    { stat: 'maxHp', type: 'percent', amount: -10, source: 'kit:dawneth-temple-dancer' },
  ],
  artKey: 'dawneth-temple-dancer',
  title: 'Dancer',
};

export const MIRA_TAVERN_ALCHEMIST_KIT: Kit = {
  id: 'mira-tavern-alchemist',
  name: 'Tavern Alchemist',
  description: 'A corseted barmaid with a bandolier of potions: +8% Max HP, -10% Attack Power.',
  modifiers: [
    { stat: 'maxHp', type: 'percent', amount: 8, source: 'kit:mira-tavern-alchemist' },
    { stat: 'attackPower', type: 'percent', amount: -10, source: 'kit:mira-tavern-alchemist' },
  ],
  artKey: 'mira-tavern-alchemist',
  title: 'Barmaid',
};

export const FALLACY_MASQUERADE_KIT: Kit = {
  id: 'fallacy-masquerade',
  name: 'Masquerade',
  description: 'A ball gown and a half-mask, all intrigue: +3 Crit Chance, -10% Max HP. Counts as a Rogue for synergies.',
  modifiers: [
    { stat: 'critChance', type: 'flat', amount: 3, source: 'kit:fallacy-masquerade' },
    { stat: 'maxHp', type: 'percent', amount: -10, source: 'kit:fallacy-masquerade' },
  ],
  artKey: 'fallacy-masquerade',
  title: 'Masked Mistress',
  synergyRole: 'Rogue',
};

export const THARAVEL_FIELD_MEDIC_KIT: Kit = {
  id: 'tharavel-field-medic',
  name: 'Field Medic',
  description: "A battlefield nurse's whites, bandages at the ready. Counts as a Healer for synergies.",
  modifiers: [],
  artKey: 'tharavel-field-medic',
  title: 'War Nurse',
  synergyRole: 'Healer',
};
