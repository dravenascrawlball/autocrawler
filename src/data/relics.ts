import type { Relic } from '../sim/relics';

/**
 * Placeholder relic pool for the between-room shop — a handful of
 * whole-party buffs to prove the system out. Expand freely; nothing else
 * needs to change to add more (see state/dungeonOrchestrator.ts's
 * rollRelicOffers, which draws uniformly from this whole list).
 */
export const RELIC_REGISTRY: Relic[] = [
  {
    id: 'relic-whetstone',
    name: 'Communal Whetstone',
    description: '+10% Attack Power for the whole party, rest of the run.',
    modifiers: [{ stat: 'attackPower', type: 'percent', amount: 10, source: 'relic:relic-whetstone' }],
    price: 15,
  },
  {
    id: 'relic-ironskin-draught',
    name: 'Ironskin Draught',
    description: '+15% Max HP for the whole party, rest of the run.',
    modifiers: [{ stat: 'maxHp', type: 'percent', amount: 15, source: 'relic:relic-ironskin-draught' }],
    price: 15,
  },
  {
    id: 'relic-healers-incense',
    name: "Healer's Incense",
    description: '+20% Heal Power for the whole party, rest of the run.',
    modifiers: [{ stat: 'healPower', type: 'percent', amount: 20, source: 'relic:relic-healers-incense' }],
    price: 12,
  },
  {
    id: 'relic-lucky-coin',
    name: 'Lucky Coin',
    description: '+5% Crit Chance for the whole party, rest of the run.',
    modifiers: [{ stat: 'critChance', type: 'flat', amount: 5, source: 'relic:relic-lucky-coin' }],
    price: 12,
  },
  {
    id: 'relic-swift-boots',
    name: 'Swift Boots',
    description: '+10% Speed for the whole party, rest of the run.',
    modifiers: [{ stat: 'speed', type: 'percent', amount: 10, source: 'relic:relic-swift-boots' }],
    price: 10,
  },
];
