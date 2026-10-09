import { createAdventurer, type Adventurer, type AdventurerTemplate } from '../sim/adventurer';
import {
  AttackNearestAction,
  AttackLowestHpAction,
  PowerAttackAction,
  CleaveAction,
  FlankStrikeAction,
  VenomSpitAction,
  SearingTouchAction,
  DrainingKissAction,
  HookChainAction,
} from '../sim/actions/attack';
import { THORNS_TRAIT, ENRAGE_TRAIT } from '../sim/traits';
import { HealAction } from '../sim/actions/heal';
import { HexAction } from '../sim/actions/support';
import { plainFaces } from '../sim/dieFace';
import type { Row } from '../sim/formation';
import {
  KOBOLD_SKIRMISHER_EXECUTE_SPECIAL,
  GRUNT_POWER_ATTACK_SPECIAL,
  SHAMAN_ATTACK_SPECIAL,
  SENTINEL_VENGEANCE_SPECIAL,
  TROLL_REGENERATE_SPECIAL,
  SUCCUBUS_CHARM_SPECIAL,
  DEMON_KING_HELLFIRE_SPECIAL,
  DEMON_KING_RAISE_DEAD_SPECIAL,
  BANNERMAN_WAR_BANNER_SPECIAL,
  GUARDIAN_WARD_SPECIAL,
} from './specialActions';

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

// --- Enemy variety pass (docs/roadmap.md item 7): each has an enemy-only mechanic ---

/** Grunt-tier loot — shared by the new light enemies below. */
const LIGHT_LOOT = [
  { itemId: 'rusty-dagger', dropChance: 0.3 },
  { itemId: 'wooden-shield', dropChance: 0.25 },
  { itemId: 'leather-armor', dropChance: 0.2 },
  { itemId: 'lucky-ring', dropChance: 0.1 },
];

/**
 * Lane-aware skirmisher (rooms 1-3): Flank Strike ignores its own lane and
 * hits the front of whichever party lane is weakest — a thin lane gets
 * punished wherever the Flanker stands (see targeting.ts's
 * selectWeakestLaneFront). Still can't reach past a lane's front unit.
 */
export const GOBLIN_FLANKER_TEMPLATE: AdventurerTemplate = {
  name: 'Goblin Flanker',
  maxHp: 9,
  attackPower: 5,
  speed: 6,
  actions: ['flank-strike'],
  dieFaces: plainFaces(FlankStrikeAction),
  lootTable: LIGHT_LOOT,
  goldDrop: { chance: 0.75, min: 5, max: 15 },
  basicAction: FlankStrikeAction,
};

/** Fragile early fire-starter (rooms 1-3): Searing Touch is a melee hit that also sets the target Burning. */
export const EMBER_IMP_TEMPLATE: AdventurerTemplate = {
  name: 'Ember Imp',
  maxHp: 7,
  attackPower: 3,
  speed: 7,
  actions: ['searing-touch'],
  dieFaces: plainFaces(SearingTouchAction),
  lootTable: [{ itemId: 'ring-of-embers', dropChance: 0.08 }, ...LIGHT_LOOT],
  goldDrop: { chance: 0.75, min: 4, max: 12 },
  basicAction: SearingTouchAction,
};

/**
 * Back-row poisoner (rooms 2-4): Venom Spit is a ranged hit on the weakest
 * party member — ignoring lanes and ranks, so a back-row healer isn't
 * automatically safe — that also Poisons them.
 */
export const VENOM_SPITTER_TEMPLATE: AdventurerTemplate = {
  name: 'Venom Spitter',
  maxHp: 11,
  attackPower: 3,
  speed: 5,
  actions: ['venom-spit'],
  dieFaces: plainFaces(VenomSpitAction),
  lootTable: LIGHT_LOOT,
  goldDrop: { chance: 0.8, min: 8, max: 20 },
  basicAction: VenomSpitAction,
};

/**
 * Reactive tank (rooms 3-5): Spiked Carapace (THORNS_TRAIT) hurts whoever
 * hits it in melee, and Vengeance (an on-ally-downed Special) makes it
 * much more dangerous once its friends start falling — so it's a real
 * question whether to kill it first or last.
 */
export const BONE_SENTINEL_TEMPLATE: AdventurerTemplate = {
  name: 'Bone Sentinel',
  maxHp: 24,
  attackPower: 6,
  speed: 3,
  actions: ['attack-nearest'],
  dieFaces: plainFaces(AttackNearestAction),
  lootTable: [
    { itemId: 'iron-sword', dropChance: 0.15 },
    { itemId: 'chainmail', dropChance: 0.12 },
  ],
  goldDrop: { chance: 0.9, min: 18, max: 40 },
  traits: [THORNS_TRAIT],
  basicAction: AttackNearestAction,
  innateSpecialActions: [SENTINEL_VENGEANCE_SPECIAL],
};

/**
 * The finale boss (room 5, every run): Cleave as its Basic Action, plus two
 * mechanics — Regenerate (an always-on Special healing a little each
 * turn, so chip damage loses the race) and Enrage (ENRAGE_TRAIT: much
 * harder hits below half HP, so the back half of the fight is the
 * dangerous one).
 */
export const TROLL_WARLORD_TEMPLATE: AdventurerTemplate = {
  name: 'Troll Warlord',
  maxHp: 40,
  attackPower: 9,
  speed: 3,
  actions: ['cleave'],
  dieFaces: plainFaces(CleaveAction),
  lootTable: [
    { itemId: 'warhammer', dropChance: 0.3 },
    { itemId: 'berserkers-totem', dropChance: 0.2 },
  ],
  goldDrop: { chance: 1, min: 40, max: 80 },
  traits: [ENRAGE_TRAIT],
  basicAction: CleaveAction,
  innateSpecialActions: [TROLL_REGENERATE_SPECIAL],
};

// --- 15-room dungeon: floor bosses (floor 1 is the Troll Warlord above) ---

/**
 * Floor 2 boss (back rank): Draining Kiss is a ranged hit on the weakest
 * hero that heals her, and Charm (on-hit-taken) stuns the nearest hero
 * whenever she's struck — so chipping at her has a cost.
 */
export const SUCCUBUS_TEMPLATE: AdventurerTemplate = {
  name: 'Succubus',
  maxHp: 30,
  attackPower: 7,
  speed: 6,
  actions: ['draining-kiss'],
  dieFaces: plainFaces(DrainingKissAction),
  lootTable: [
    { itemId: 'lucky-ring', dropChance: 0.3 },
    { itemId: 'tome-of-power', dropChance: 0.2 },
  ],
  goldDrop: { chance: 1, min: 40, max: 80 },
  basicAction: DrainingKissAction,
  innateSpecialActions: [SUCCUBUS_CHARM_SPECIAL],
};

/**
 * Floor 3 boss, the dungeon's finale (front rank): Cleave, plus Hellfire
 * every turn (half-damage hits that Burn several heroes) and Raise Dead
 * (revives one fallen demon per turn) — kill him first or fight his army
 * twice.
 */
export const DEMON_KING_TEMPLATE: AdventurerTemplate = {
  name: 'Demon King',
  maxHp: 55,
  attackPower: 10,
  speed: 4,
  actions: ['cleave'],
  dieFaces: plainFaces(CleaveAction),
  lootTable: [{ itemId: 'warhammer', dropChance: 0.3 }],
  goldDrop: { chance: 1, min: 60, max: 120 },
  basicAction: CleaveAction,
  innateSpecialActions: [DEMON_KING_HELLFIRE_SPECIAL, DEMON_KING_RAISE_DEAD_SPECIAL],
};

// --- Monster pass: infernal court (floor 2) / demon army (floor 3), not exclusively ---

/** Infernal court (front): Hook Chain drags the rearmost hero in its target lane to the front, then hits them. */
export const CHAIN_WARDEN_TEMPLATE: AdventurerTemplate = {
  name: 'Chain Warden',
  maxHp: 16,
  attackPower: 5,
  speed: 4,
  actions: ['hook-chain'],
  dieFaces: plainFaces(HookChainAction),
  lootTable: LIGHT_LOOT,
  goldDrop: { chance: 0.85, min: 12, max: 30 },
  basicAction: HookChainAction,
};

/** Infernal court (back): Hex cuts your strongest hero's attack and Silences their Specials. Deals no damage itself. */
export const HEX_WITCH_TEMPLATE: AdventurerTemplate = {
  name: 'Hex Witch',
  maxHp: 12,
  attackPower: 3,
  speed: 5,
  actions: ['hex'],
  dieFaces: plainFaces(HexAction),
  lootTable: [{ itemId: 'tome-of-power', dropChance: 0.1 }, ...LIGHT_LOOT],
  goldDrop: { chance: 0.85, min: 12, max: 30 },
  basicAction: HexAction,
};

/** Demon army (middle): attacks normally, and War Banner buffs every allied monster's attack each turn. */
export const INFERNAL_BANNERMAN_TEMPLATE: AdventurerTemplate = {
  name: 'Infernal Bannerman',
  maxHp: 18,
  attackPower: 4,
  speed: 4,
  actions: ['attack-nearest'],
  dieFaces: plainFaces(AttackNearestAction),
  lootTable: LIGHT_LOOT,
  goldDrop: { chance: 0.9, min: 15, max: 35 },
  basicAction: AttackNearestAction,
  innateSpecialActions: [BANNERMAN_WAR_BANNER_SPECIAL],
};

/** Demon army (front): a tough anchor that shields its most-hurt ally every turn. */
export const HELLFORGED_GUARDIAN_TEMPLATE: AdventurerTemplate = {
  name: 'Hellforged Guardian',
  maxHp: 28,
  attackPower: 5,
  speed: 3,
  actions: ['attack-nearest'],
  dieFaces: plainFaces(AttackNearestAction),
  lootTable: [
    { itemId: 'chainmail', dropChance: 0.15 },
    { itemId: 'wooden-shield', dropChance: 0.2 },
  ],
  goldDrop: { chance: 0.9, min: 18, max: 40 },
  basicAction: AttackNearestAction,
  innateSpecialActions: [GUARDIAN_WARD_SPECIAL],
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

export function createGoblinFlanker(row: Row): Adventurer {
  return createEnemy(GOBLIN_FLANKER_TEMPLATE, row);
}

export function createEmberImp(row: Row): Adventurer {
  return createEnemy(EMBER_IMP_TEMPLATE, row);
}

export function createVenomSpitter(row: Row): Adventurer {
  return createEnemy(VENOM_SPITTER_TEMPLATE, row);
}

export function createBoneSentinel(row: Row): Adventurer {
  return createEnemy(BONE_SENTINEL_TEMPLATE, row);
}

export function createTrollWarlord(row: Row): Adventurer {
  return createEnemy(TROLL_WARLORD_TEMPLATE, row);
}

export function createSuccubus(row: Row): Adventurer {
  return createEnemy(SUCCUBUS_TEMPLATE, row);
}

export function createDemonKing(row: Row): Adventurer {
  return createEnemy(DEMON_KING_TEMPLATE, row);
}

export function createChainWarden(row: Row): Adventurer {
  return createEnemy(CHAIN_WARDEN_TEMPLATE, row);
}

export function createHexWitch(row: Row): Adventurer {
  return createEnemy(HEX_WITCH_TEMPLATE, row);
}

export function createInfernalBannerman(row: Row): Adventurer {
  return createEnemy(INFERNAL_BANNERMAN_TEMPLATE, row);
}

export function createHellforgedGuardian(row: Row): Adventurer {
  return createEnemy(HELLFORGED_GUARDIAN_TEMPLATE, row);
}

