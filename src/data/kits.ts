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
  description: 'A reckless alternate build: +20% Attack Power, -15% Max HP.',
  modifiers: [
    { stat: 'attackPower', type: 'percent', amount: 20, source: 'kit:gudrun-berserker' },
    { stat: 'maxHp', type: 'percent', amount: -15, source: 'kit:gudrun-berserker' },
  ],
  artKey: 'gudrun-berserker',
  role: 'Berserker',
};

export const NERISSA_SHADOW_THIEF_KIT: Kit = {
  id: 'nerissa-shadow-thief',
  name: 'Shadow Thief',
  description: 'A swifter, sharper alternate build: +15% Speed, +8% Crit Chance.',
  modifiers: [
    { stat: 'speed', type: 'percent', amount: 15, source: 'kit:nerissa-shadow-thief' },
    { stat: 'critChance', type: 'flat', amount: 8, source: 'kit:nerissa-shadow-thief' },
  ],
  artKey: 'nerissa-shadow-thief',
  role: 'Shadow Thief',
};

export const CALADWEN_VENOMOUS_BLADE_KIT: Kit = {
  id: 'caladwen-venomous-blade',
  name: 'Venomous Blade',
  description: 'A more aggressive alternate build: +15% Attack Power, +10% Speed.',
  modifiers: [
    { stat: 'attackPower', type: 'percent', amount: 15, source: 'kit:caladwen-venomous-blade' },
    { stat: 'speed', type: 'percent', amount: 10, source: 'kit:caladwen-venomous-blade' },
  ],
  artKey: 'caladwen-venomous-blade',
  role: 'Venomous Blade',
};
