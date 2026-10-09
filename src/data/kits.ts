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

// --- Halloween event Kits (data/events.ts's HALLOWEEN_EVENT_ACTIVE): one costume per character ---
// Every one grants the 'spooky' tag (Haunting synergy, Jack-o'-Lantern relic, lane Fear) plus a
// small stat trade-off. Unlocked by reaching Floor 2 with the character while the event is on;
// sold for Renown once it's off (data/kitShop.ts).

export const GUDRUN_HALLOWEEN_KIT: Kit = {
  id: 'gudrun-halloween',
  name: 'Blood Countess',
  description: 'A high-collared crimson cape and fangs to match the lipstick. +8% Attack Power, -5% Max HP. Spooky.',
  modifiers: [
    { stat: 'attackPower', type: 'percent', amount: 8, source: 'kit:gudrun-halloween' },
    { stat: 'maxHp', type: 'percent', amount: -5, source: 'kit:gudrun-halloween' },
  ],
  tags: ['spooky'],
  artKey: 'gudrun-halloween',
  title: 'Vampire Countess',
};

export const DAWNETH_HALLOWEEN_KIT: Kit = {
  id: 'dawneth-halloween',
  name: 'The Banshee',
  description: 'Her mourning veil turned spectral, in a tattered burial gown. +10% Heal Power, -5% Max HP. Spooky.',
  modifiers: [
    { stat: 'healPower', type: 'percent', amount: 10, source: 'kit:dawneth-halloween' },
    { stat: 'maxHp', type: 'percent', amount: -5, source: 'kit:dawneth-halloween' },
  ],
  tags: ['spooky'],
  artKey: 'dawneth-halloween',
  title: 'Banshee',
};

export const ISILWEN_HALLOWEEN_KIT: Kit = {
  id: 'isilwen-halloween',
  name: 'Grave Jester',
  description: 'Black-and-white harlequin with skull bells and a deck of bone cards. +5 Crit Chance, -5% Max HP. Spooky.',
  modifiers: [
    { stat: 'critChance', type: 'flat', amount: 5, source: 'kit:isilwen-halloween' },
    { stat: 'maxHp', type: 'percent', amount: -5, source: 'kit:isilwen-halloween' },
  ],
  tags: ['spooky'],
  artKey: 'isilwen-halloween',
  title: 'Grave Jester',
};

export const THARAVEL_HALLOWEEN_KIT: Kit = {
  id: 'tharavel-halloween',
  name: "Headless Horsewoman",
  description: "A tattered officer coat and a jack-o'-lantern under her arm (head firmly attached). +8% Speed, -5% Max HP. Spooky.",
  modifiers: [
    { stat: 'speed', type: 'percent', amount: 8, source: 'kit:tharavel-halloween' },
    { stat: 'maxHp', type: 'percent', amount: -5, source: 'kit:tharavel-halloween' },
  ],
  tags: ['spooky'],
  artKey: 'tharavel-halloween',
  title: 'Headless Horsewoman',
};

export const BODIL_HALLOWEEN_KIT: Kit = {
  id: 'bodil-halloween',
  name: "Pumpkin Bunny",
  description: "An orange-and-black bunny with a jack-o'-lantern-carved cleaver. +10% Max HP, -5% Speed. Spooky.",
  modifiers: [
    { stat: 'maxHp', type: 'percent', amount: 10, source: 'kit:bodil-halloween' },
    { stat: 'speed', type: 'percent', amount: -5, source: 'kit:bodil-halloween' },
  ],
  tags: ['spooky'],
  artKey: 'bodil-halloween',
  title: 'Pumpkin Bunny',
};

export const GLINT_HALLOWEEN_KIT: Kit = {
  id: 'glint-halloween',
  name: 'Golden Mummy',
  description: 'A bandage-wrap bikini under gilded scarab plates. +2 Armor, -5% Speed. Spooky.',
  modifiers: [
    { stat: 'armor', type: 'flat', amount: 2, source: 'kit:glint-halloween' },
    { stat: 'speed', type: 'percent', amount: -5, source: 'kit:glint-halloween' },
  ],
  tags: ['spooky'],
  artKey: 'glint-halloween',
  title: 'Golden Mummy',
};

export const DRIFTA_HALLOWEEN_KIT: Kit = {
  id: 'drifta-halloween',
  name: "Ghost Pirate",
  description: "A spectral sea-green captain's coat and a phantom rapier. +8% Speed, -5% Max HP. Spooky.",
  modifiers: [
    { stat: 'speed', type: 'percent', amount: 8, source: 'kit:drifta-halloween' },
    { stat: 'maxHp', type: 'percent', amount: -5, source: 'kit:drifta-halloween' },
  ],
  tags: ['spooky'],
  artKey: 'drifta-halloween',
  title: 'Ghost Pirate',
};

export const FALLACY_HALLOWEEN_KIT: Kit = {
  id: 'fallacy-halloween',
  name: 'Little Devil',
  description: 'A red devil corset and forked tail to go with her horns. +8% Attack Power, -5% Max HP. Spooky.',
  modifiers: [
    { stat: 'attackPower', type: 'percent', amount: 8, source: 'kit:fallacy-halloween' },
    { stat: 'maxHp', type: 'percent', amount: -5, source: 'kit:fallacy-halloween' },
  ],
  tags: ['spooky'],
  artKey: 'fallacy-halloween',
  title: 'Little Devil',
};

export const MIRKA_HALLOWEEN_KIT: Kit = {
  id: 'mirka-halloween',
  name: 'The Reaper',
  description: 'A black cowl over her void eyes and a scythe for a flail. +10% Attack Power, -8% Max HP. Spooky.',
  modifiers: [
    { stat: 'attackPower', type: 'percent', amount: 10, source: 'kit:mirka-halloween' },
    { stat: 'maxHp', type: 'percent', amount: -8, source: 'kit:mirka-halloween' },
  ],
  tags: ['spooky'],
  artKey: 'mirka-halloween',
  title: 'Reaper',
};

export const NERISSA_HALLOWEEN_KIT: Kit = {
  id: 'nerissa-halloween',
  name: 'Black Cat',
  description: 'A full black-cat costume with a bell collar and paw gloves, still a thief. +8% Speed, -5% Max HP. Spooky.',
  modifiers: [
    { stat: 'speed', type: 'percent', amount: 8, source: 'kit:nerissa-halloween' },
    { stat: 'maxHp', type: 'percent', amount: -5, source: 'kit:nerissa-halloween' },
  ],
  tags: ['spooky'],
  artKey: 'nerissa-halloween',
  title: 'Black Cat',
};

export const DRAVENA_HALLOWEEN_KIT: Kit = {
  id: 'dravena-halloween',
  name: 'Spider Queen',
  description: 'A black-widow gown of web lace and a spider-leg crown. +8% Attack Power, -5% Speed. Spooky.',
  modifiers: [
    { stat: 'attackPower', type: 'percent', amount: 8, source: 'kit:dravena-halloween' },
    { stat: 'speed', type: 'percent', amount: -5, source: 'kit:dravena-halloween' },
  ],
  tags: ['spooky'],
  artKey: 'dravena-halloween',
  title: 'Spider Queen',
};

export const CALADWEN_HALLOWEEN_KIT: Kit = {
  id: 'caladwen-halloween',
  name: 'Stitched Bride',
  description: 'Stitched seams, neck bolts, and her vials relabeled as reanimation serum. +10% Max HP, -5% Attack Power. Spooky.',
  modifiers: [
    { stat: 'maxHp', type: 'percent', amount: 10, source: 'kit:caladwen-halloween' },
    { stat: 'attackPower', type: 'percent', amount: -5, source: 'kit:caladwen-halloween' },
  ],
  tags: ['spooky'],
  artKey: 'caladwen-halloween',
  title: 'Stitched Bride',
};

export const MELPOMENE_HALLOWEEN_KIT: Kit = {
  id: 'melpomene-halloween',
  name: 'Werewolf Huntress',
  description: 'Wolf ears and tail, fur-trimmed leather, and a moonlit bow. +8% Attack Power, -5% Max HP. Spooky.',
  modifiers: [
    { stat: 'attackPower', type: 'percent', amount: 8, source: 'kit:melpomene-halloween' },
    { stat: 'maxHp', type: 'percent', amount: -5, source: 'kit:melpomene-halloween' },
  ],
  tags: ['spooky'],
  artKey: 'melpomene-halloween',
  title: 'Werewolf',
};

export const MIRA_HALLOWEEN_KIT: Kit = {
  id: 'mira-halloween',
  name: 'Pumpkin Witch',
  description: 'A pointed hat, a broom, and potions brewed into cauldron bubbles. +10% Heal Power, -5% Attack Power. Spooky.',
  modifiers: [
    { stat: 'healPower', type: 'percent', amount: 10, source: 'kit:mira-halloween' },
    { stat: 'attackPower', type: 'percent', amount: -5, source: 'kit:mira-halloween' },
  ],
  tags: ['spooky'],
  artKey: 'mira-halloween',
  title: 'Pumpkin Witch',
};
