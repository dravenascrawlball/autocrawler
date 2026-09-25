import { createAdventurer, type Adventurer, type AdventurerTemplate } from '../sim/adventurer';
import { AttackNearestAction, AttackLowestHpAction, PowerAttackAction, CleaveAction } from '../sim/actions/attack';
import { HealAction } from '../sim/actions/heal';
import { plainFaces } from '../sim/dieFace';
import type { Row } from '../sim/formation';

/**
 * Extra weak enemy with a chittering buff. Hit-and-run flavor: mostly a
 * cheap Attack Nearest, but a couple of faces finish off whoever's already
 * weakest (Attack (Lowest HP)) — a skirmisher picks off the vulnerable
 * rather than trading blows head-on.
 */
export const KOBOLD_SKIRMISHER_TEMPLATE: AdventurerTemplate = {
  name: 'Kobold Skirmisher',
  maxHp: 6,
  attackPower: 4,
  speed: 6,
  accuracy: 80,
  evasion: 10,
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
  goldDrop: { chance: 0.75, min: 1, max: 4 },
};

/** Weak baseline threat — a basic soldier: mostly Attack Nearest, with a couple of Power Attack faces for an occasional harder hit. */
export const GRUNT_TEMPLATE: AdventurerTemplate = {
  name: 'Grunt',
  maxHp: 10,
  attackPower: 6,
  speed: 4,
  accuracy: 80,
  evasion: 0,
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
  goldDrop: { chance: 0.75, min: 2, max: 6 },
};

/** Tougher, harder-hitting enemy — a heavy smasher: mostly Attack Nearest, with a couple of Cleave faces hitting the whole row at once. */
export const BRUTE_TEMPLATE: AdventurerTemplate = {
  name: 'Brute',
  maxHp: 30,
  attackPower: 13,
  speed: 3,
  accuracy: 75,
  evasion: 0,
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
  goldDrop: { chance: 0.9, min: 8, max: 18 },
};

/**
 * 2 Heal / 4 Attack Nearest faces: mostly attacks, but heals a hurt ally
 * (a fellow Shaman/Grunt/Brute in the same room) often enough to matter,
 * proving enemy dice faces can mix actions exactly like adventurer dice do.
 * `healPower` is deliberately its own (modest) number, not tied to
 * `attackPower` — raising attackPower here previously also raised heal
 * output for free (HealAction used to just reuse attackPower), which let a
 * two-Shaman room mutually-sustain indefinitely against a weak party during
 * the balance pass (roadmap item 6). Now independent.
 */
export const SHAMAN_TEMPLATE: AdventurerTemplate = {
  name: 'Shaman',
  maxHp: 15,
  attackPower: 3,
  speed: 5,
  accuracy: 80,
  evasion: 5,
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
  goldDrop: { chance: 0.8, min: 5, max: 12 },
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
