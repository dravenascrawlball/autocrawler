import type { Synergy } from '../sim/synergies';

/**
 * Role synergies (roadmap item 6 — see sim/synergies.ts). Thresholds and
 * bonuses tuned with balanceSim.test.ts so a party built toward them clears
 * noticeably (~10-15 points) more often than one recruited at random.
 */
export const SYNERGIES: Synergy[] = [
  {
    id: 'vanguard',
    name: 'Vanguard',
    roles: ['Fighter'],
    description: 'Fighters gain max HP.',
    tiers: [
      { count: 2, stat: 'maxHp', type: 'percent', amount: 6, target: 'members' },
      { count: 3, stat: 'maxHp', type: 'percent', amount: 20, target: 'members' },
      { count: 4, stat: 'maxHp', type: 'percent', amount: 40, target: 'members' },
    ],
  },
  {
    id: 'cutthroats',
    name: 'Cutthroats',
    roles: ['Rogue'],
    description: 'Rogues gain critical chance.',
    tiers: [
      { count: 2, stat: 'critChance', type: 'flat', amount: 8, target: 'members' },
      { count: 3, stat: 'critChance', type: 'flat', amount: 30, target: 'members' },
    ],
  },
  {
    id: 'menders',
    name: 'Menders',
    roles: ['Healer'],
    description: 'The whole party heals more.',
    tiers: [{ count: 2, stat: 'healPower', type: 'percent', amount: 20, target: 'party' }],
  },
  {
    id: 'strategists',
    name: 'Strategists',
    roles: ['Tactician'],
    description: 'The whole party hits harder.',
    tiers: [{ count: 2, stat: 'attackPower', type: 'percent', amount: 8, target: 'party' }],
  },
  {
    id: 'marksmen',
    name: 'Marksmen',
    roles: ['Mage', 'Ranger'],
    description: 'Mages and Rangers hit harder.',
    tiers: [{ count: 2, stat: 'attackPower', type: 'percent', amount: 15, target: 'members' }],
  },
];
