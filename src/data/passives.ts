import type { PassiveAbility } from '../sim/leveling';

/**
 * Starter passive roster, picked via a level-up's 'passive' upgrade
 * choice. Each is a permanent StatModifier grant (see
 * resolveUpgradeChoice) — no new sim hooks, only stats already wired
 * through getEffectiveStat (maxHp, speed, attackPower, interRoomHeal), the
 * same set items use. Numbers are placeholders pending the balance pass
 * (roadmap item 6).
 */

export const VITALITY_PASSIVE: PassiveAbility = {
  id: 'vitality',
  name: 'Vitality',
  modifiers: [{ stat: 'maxHp', type: 'percent', amount: 10, source: 'passive:vitality' }],
};

export const SWIFT_REFLEXES_PASSIVE: PassiveAbility = {
  id: 'swift-reflexes',
  name: 'Swift Reflexes',
  modifiers: [{ stat: 'speed', type: 'flat', amount: 1, source: 'passive:swift-reflexes' }],
};

export const BATTLE_HARDENED_PASSIVE: PassiveAbility = {
  id: 'battle-hardened',
  name: 'Battle-Hardened',
  modifiers: [{ stat: 'attackPower', type: 'percent', amount: 10, source: 'passive:battle-hardened' }],
};

export const SECOND_WIND_PASSIVE: PassiveAbility = {
  id: 'second-wind',
  name: 'Second Wind',
  modifiers: [{ stat: 'interRoomHeal', type: 'flat', amount: 3, source: 'passive:second-wind' }],
};

/** Full passive roster, one entry per passive defined above. */
export const ALL_PASSIVES: PassiveAbility[] = [
  VITALITY_PASSIVE,
  SWIFT_REFLEXES_PASSIVE,
  BATTLE_HARDENED_PASSIVE,
  SECOND_WIND_PASSIVE,
];
