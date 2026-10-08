import { createAdventurer, type Adventurer, type AdventurerTemplate } from '../sim/adventurer';
import { AttackNearestAction, AttackLowestHpAction, PowerAttackAction, CleaveAction } from '../sim/actions/attack';
import { HealAction } from '../sim/actions/heal';
import { plainFaces } from '../sim/dieFace';
import type { Row } from '../sim/formation';
import { KOBOLD_SKIRMISHER_EXECUTE_SPECIAL, GRUNT_POWER_ATTACK_SPECIAL, SHAMAN_ATTACK_SPECIAL } from './specialActions';

/**
 * Extra weak enemy with a chittering buff. Hit-and-run flavor: Attack
 * Nearest as her Basic Action every turn, plus Opportunist (Attack Lowest
 * HP, fires on-turn-start — see data/specialActions.ts) finishing off
 * whoever's already weakest alongside it — a skirmisher who never passes up
 * a free kill rather than trading blows head-on.
 */
export const KOBOLD_SKIRMISHER_TEMPLATE: AdventurerTemplate = {
  name: 'Kobold Skirmisher',
  maxHp: 6,
  attackPower: 4,
  speed: 6,
  actions: ['attack-nearest', 'attack-lowest-hp'],
  dieFaces: [...plainFaces(AttackNearestAction, 4), ...plainFaces(AttackLowestHpAction, 2)],
  xpReward: 3,
  // Light, common gear — see data/items.ts's Grunt-tier items.
  lootTable: [
    { itemId: 'rusty-dagger', dropChance: 0.25 },
    { itemId: 'wooden-shield', dropChance: 0.2 },
    { itemId: 'leather-armor', dropChance: 0.1 },
    { itemId: 'lucky-ring', dropChance: 0.1 },
    { itemId: 'swift-boots', dropChance: 0.1 },
  ],
  // ×3 over the original 1-4 — see docs/roadmap.md's balance pass: per-room gold income was far
  // too thin to ever afford a between-room Shop purchase (recruit, relic, or item), let alone the
  // "1-2 things a room" target.
  goldDrop: { chance: 0.75, min: 3, max: 12 },
  basicAction: AttackNearestAction,
  specialActionPool: [{ kind: 'special-action', specialAction: KOBOLD_SKIRMISHER_EXECUTE_SPECIAL }],
};

/** Weak baseline threat — a basic soldier: Attack Nearest as her Basic Action, plus Heavy Swing (Power Attack, fires on-turn-start) landing an extra harder hit alongside it every turn. */
export const GRUNT_TEMPLATE: AdventurerTemplate = {
  name: 'Grunt',
  maxHp: 10,
  attackPower: 6,
  speed: 4,
  actions: ['attack-nearest', 'power-attack'],
  dieFaces: [...plainFaces(AttackNearestAction, 4), ...plainFaces(PowerAttackAction, 2)],
  xpReward: 3,
  // Light, common gear — see data/items.ts's Grunt-tier items.
  lootTable: [
    { itemId: 'rusty-dagger', dropChance: 0.35 },
    { itemId: 'wooden-shield', dropChance: 0.3 },
    { itemId: 'leather-armor', dropChance: 0.2 },
    { itemId: 'lucky-ring', dropChance: 0.15 },
    { itemId: 'swift-boots', dropChance: 0.1 },
  ],
  // ×3 — see Kobold Skirmisher's goldDrop comment above.
  goldDrop: { chance: 0.75, min: 6, max: 18 },
  basicAction: AttackNearestAction,
  specialActionPool: [{ kind: 'special-action', specialAction: GRUNT_POWER_ATTACK_SPECIAL }],
};

/** Tougher, harder-hitting enemy — a heavy smasher: Cleave is her Basic Action, hitting every living enemy at her target's rank every turn. No Special Action — same as several of the 15 player characters whose whole identity is their Basic Action alone. */
export const BRUTE_TEMPLATE: AdventurerTemplate = {
  name: 'Brute',
  maxHp: 30,
  attackPower: 13,
  speed: 3,
  actions: ['attack-nearest', 'cleave'],
  dieFaces: [...plainFaces(AttackNearestAction, 4), ...plainFaces(CleaveAction, 2)],
  xpReward: 10,
  // Heavy melee gear — see data/items.ts's Brute-tier items.
  lootTable: [
    { itemId: 'iron-sword', dropChance: 0.35 },
    { itemId: 'chainmail', dropChance: 0.3 },
    { itemId: 'spiked-buckler', dropChance: 0.2 },
    { itemId: 'warhammer', dropChance: 0.15 },
    { itemId: 'berserkers-totem', dropChance: 0.1 },
  ],
  // ×3 — see Kobold Skirmisher's goldDrop comment above.
  goldDrop: { chance: 0.9, min: 24, max: 54 },
  basicAction: CleaveAction,
};

/**
 * Heal is her Basic Action every turn (heals a hurt ally — a fellow
 * Shaman/Grunt/Brute in the same room — when anyone qualifies, otherwise
 * idle), plus Lash Out (Attack Nearest, fires on-turn-start) landing a hit
 * alongside it — proving an enemy's kit can mix support and offense exactly
 * like a player character's can. `healPower` is deliberately its own
 * (modest) number, not tied to `attackPower` — raising attackPower here
 * previously also raised heal output for free (HealAction used to just
 * reuse attackPower), which let a two-Shaman room mutually-sustain
 * indefinitely against a weak party during the balance pass (roadmap item
 * 6). Now independent.
 */
export const SHAMAN_TEMPLATE: AdventurerTemplate = {
  name: 'Shaman',
  maxHp: 15,
  attackPower: 3,
  speed: 5,
  healPower: 3,
  actions: ['heal', 'attack-nearest'],
  dieFaces: [...plainFaces(HealAction, 2), ...plainFaces(AttackNearestAction, 4)],
  xpReward: 8,
  // Magic/utility gear — see data/items.ts's Shaman-tier items, including its 2 signature
  // faceEffect items (roadmap item 13), kept rare relative to the plain stat-stick gear.
  lootTable: [
    { itemId: 'sages-charm', dropChance: 0.3 },
    { itemId: 'amulet-of-vigor', dropChance: 0.3 },
    { itemId: 'long-spear', dropChance: 0.2 },
    { itemId: 'tower-shield', dropChance: 0.15 },
    { itemId: 'assassins-blade', dropChance: 0.1 },
    { itemId: 'ring-of-embers', dropChance: 0.08 },
    { itemId: 'tome-of-power', dropChance: 0.08 },
  ],
  // ×3 — see Kobold Skirmisher's goldDrop comment above.
  goldDrop: { chance: 0.8, min: 15, max: 36 },
  basicAction: HealAction,
  specialActionPool: [{ kind: 'special-action', specialAction: SHAMAN_ATTACK_SPECIAL }],
};

export type EnemyFactory = (row: Row) => Adventurer;

let nextEnemyInstanceId = 1;

function createEnemy(template: AdventurerTemplate, row: Row): Adventurer {
  const slug = template.name.toLowerCase().replace(/\s+/g, '-');
  const id = `${slug}-${nextEnemyInstanceId}`;
  nextEnemyInstanceId += 1;
  return createAdventurer(id, template, row);
}

export function createKoboldSkirmisher(row: Row): Adventurer {
  return createEnemy(KOBOLD_SKIRMISHER_TEMPLATE, row);
}

export function createGrunt(row: Row): Adventurer {
  return createEnemy(GRUNT_TEMPLATE, row);
}

export function createBrute(row: Row): Adventurer {
  return createEnemy(BRUTE_TEMPLATE, row);
}

export function createShaman(row: Row): Adventurer {
  return createEnemy(SHAMAN_TEMPLATE, row);
}
