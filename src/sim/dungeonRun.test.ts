import { describe, it, expect } from 'vitest';
import { plainFaces } from './dieFace';
import { createAdventurer, type AdventurerTemplate } from './adventurer';
import { AttackNearestAction, GildedStrikeAction } from './actions/attack';
import { RetreatAction } from './actions/retreat';
import { runDungeon, startDungeonRun, resolveNextRoom, retreatDungeonRun, type RoomDefinition } from './dungeonRun';

function heroTemplate(): AdventurerTemplate {
  return {
    name: 'Hero',
    maxHp: 20,
    attackPower: 10,
    speed: 10,
    actions: ['attack-nearest'],
    dieFaces: plainFaces(AttackNearestAction),
  };
}

function enemyTemplate(hp: number, attackPower: number): AdventurerTemplate {
  return {
    name: 'Goblin',
    maxHp: hp,
    attackPower,
    speed: 5,
    actions: ['attack-nearest'],
    dieFaces: plainFaces(AttackNearestAction),
  };
}

// Every enemy has 15 HP against the hero's 10 attack power, so it always
// takes exactly two hero hits to kill, guaranteeing it survives to land
// exactly one counterattack (round 1) before dying on the hero's round-2 hit.
function makeRoom(enemyAttackPower: number): RoomDefinition {
  const enemy = createAdventurer('goblin', enemyTemplate(15, enemyAttackPower), 'front');
  return { enemies: [enemy] };
}

describe('runDungeon', () => {
  it('chains 4 rooms to completion, healing/clamping HP between rooms', () => {
    const hero = createAdventurer('hero', heroTemplate(), 'front');

    // Damage taken per room (the single hit each surviving enemy lands):
    // 3, 8, 3, 8. Heal is a flat 5 between rooms.
    const enemyAttackPowers = [3, 8, 3, 8];
    const rooms = enemyAttackPowers.map((power) => makeRoom(power));

    const run = runDungeon([hero], rooms, () => 0.5);

    expect(run.outcome).toBe('completed');
    expect(run.rooms).toHaveLength(4);
    expect(run.rooms.every((r) => r.result.outcome === 'win')).toBe(true);

    // Room 1 starts fresh: full HP, no heal applied yet (heal is only *between* rooms).
    expect(run.rooms[0].partyAtRoomStart).toEqual([{ id: 'hero', hp: 20 }]);
    // Room 1 ends at 20 - 3 = 17. Heal +5 = 22, clamped to max (20).
    expect(run.rooms[1].partyAtRoomStart).toEqual([{ id: 'hero', hp: 20 }]);
    // Room 2 ends at 20 - 8 = 12. Heal +5 = 17 (no clamp).
    expect(run.rooms[2].partyAtRoomStart).toEqual([{ id: 'hero', hp: 17 }]);
    // Room 3 ends at 17 - 3 = 14. Heal +5 = 19 (no clamp).
    expect(run.rooms[3].partyAtRoomStart).toEqual([{ id: 'hero', hp: 19 }]);

    // Room 4 (the last room) ends at 19 - 8 = 11; no heal is applied after the final room.
    expect(hero.hp).toBe(11);
  });

  it('stops immediately on a loss and never attempts the remaining rooms', () => {
    const hero = createAdventurer('hero', heroTemplate(), 'front');

    const easyRoom1 = makeRoom(3);
    const easyRoom2 = makeRoom(3);
    // A one-shot enemy: the hero's turn goes first each round (higher speed), so it gets one hit
    // in before this enemy counterattacks for lethal damage.
    const lethalEnemy = createAdventurer('ogre', enemyTemplate(100, 25), 'front');
    const lethalRoom: RoomDefinition = { enemies: [lethalEnemy] };
    const neverReachedEnemy = createAdventurer('never-reached', enemyTemplate(1, 1), 'front');
    const room4: RoomDefinition = { enemies: [neverReachedEnemy] };

    const run = runDungeon([hero], [easyRoom1, easyRoom2, lethalRoom, room4]);

    expect(run.outcome).toBe('loss');
    // Only 3 rooms were attempted; room 4 never ran.
    expect(run.rooms).toHaveLength(3);
    expect(run.rooms[2].result.outcome).toBe('loss');
    expect(hero.hp).toBe(0);

    // Proof room 4 never executed: its enemy's HP is still untouched.
    expect(neverReachedEnemy.hp).toBe(1);
  });
});

describe('Downed lasts for the rest of the run', () => {
  it('does not revive a Downed party member with the between-room heal, and keeps their DownedSummary', () => {
    // Party order matters here: battle.adventurers === party, and melee targeting picks the
    // first living front-row candidate in that order — so the grunt hits heroB (front-row,
    // index 0) before heroA ever gets a turn.
    const heroB = createAdventurer(
      'heroB',
      {
        name: 'HeroB',
        maxHp: 1,
        attackPower: 1,
        speed: 5,
        actions: ['attack-nearest'],
        dieFaces: plainFaces(AttackNearestAction),
      },
      'front',
    );
    const heroA = createAdventurer(
      'heroA',
      {
        name: 'HeroA',
        maxHp: 20,
        attackPower: 20,
        speed: 1,
        actions: ['attack-nearest'],
        dieFaces: plainFaces(AttackNearestAction),
      },
      'front',
    );

    const grunt = createAdventurer(
      'grunt',
      {
        name: 'Grunt',
        maxHp: 5,
        attackPower: 5,
        speed: 10,
        actions: ['attack-nearest'],
        dieFaces: plainFaces(AttackNearestAction),
      },
      'front',
    );
    const trivialEnemy = createAdventurer('weak', enemyTemplate(1, 0), 'front');

    const rooms: RoomDefinition[] = [{ enemies: [grunt] }, { enemies: [trivialEnemy] }];
    const run = runDungeon([heroB, heroA], rooms, () => 0.5);

    expect(run.outcome).toBe('completed');
    // heroB went down in room 1 (grunt outspeeds both heroes and hits first) and stayed there —
    // the room 2 between-room heal (a flat +5) never touched them.
    expect(run.rooms[1].partyAtRoomStart).toEqual(
      expect.arrayContaining([{ id: 'heroB', hp: 0 }]),
    );
    expect(heroB.hp).toBe(0);
    expect(heroB.downedSummary).toEqual({
      roomIndex: 0,
      killerArchetype: 'Grunt',
      xpGained: 0,
      damageDone: 0,
      damageTaken: 5,
      healed: 0,
      acknowledged: false,
    });
  });
});

describe('startDungeonRun / resolveNextRoom', () => {
  it('pauses between rooms (returns null) until the last room, then returns the outcome', () => {
    const hero = createAdventurer('hero', heroTemplate(), 'front');
    const rooms = [makeRoom(3), makeRoom(3), makeRoom(3)];

    const state = startDungeonRun([hero], rooms);

    expect(resolveNextRoom(state)).toBeNull();
    expect(state.roomIndex).toBe(1);
    expect(state.roomRecords).toHaveLength(1);

    expect(resolveNextRoom(state)).toBeNull();
    expect(state.roomIndex).toBe(2);
    expect(state.roomRecords).toHaveLength(2);

    expect(resolveNextRoom(state)).toBe('completed');
    expect(state.roomIndex).toBe(3);
    expect(state.roomRecords).toHaveLength(3);
  });

  it('threads partyGold from startDungeonRun into each room\'s battle (Nerissa\'s Gilded Strike — roadmap item 11)', () => {
    const nerissa = createAdventurer(
      'nerissa',
      { name: 'Nerissa', maxHp: 20, attackPower: 10, speed: 10, actions: ['gilded-strike'], dieFaces: plainFaces(GildedStrikeAction) },
      'front',
    );
    const rooms = [makeRoom(0)]; // 0 enemy attack power so the room result is easy to read, unaffected by counterattacks

    const state = startDungeonRun([nerissa], rooms, 40); // 40 gold -> +20% damage
    expect(state.partyGold).toBe(40);

    resolveNextRoom(state, () => 0.5);

    const firstAttackEvent = state.roomRecords[0].result.rounds[0].turns[0].turn.events[0];
    expect(firstAttackEvent).toMatchObject({
      type: 'action',
      outcome: { type: 'attack', damage: Math.round(10 * 1.2) }, // base 10 * (1 + 40*0.5%/gold)
    });
  });

  it('lets changes made during the pause affect the next room (pausing is a real hook, not cosmetic)', () => {
    // A weak hero who'd normally lose room 2 (100 HP enemy, only 1 attack power), but boosting
    // attack power between rooms is enough to win within the round cap.
    const hero = createAdventurer('hero', enemyTemplate(20, 1), 'front');
    const toughEnemy = createAdventurer('tough', enemyTemplate(100, 1), 'front');
    const rooms: RoomDefinition[] = [
      makeRoom(1),
      { enemies: [toughEnemy], maxRounds: 3 },
    ];

    const state = startDungeonRun([hero], rooms);
    expect(resolveNextRoom(state, () => 0.5)).toBeNull();

    // Stands in for an equip made during the between-room pause: mutating live adventurer state
    // here, between resolveNextRoom calls, is exactly the hook a real equip action would use.
    hero.attackPower = 60;

    const outcome = resolveNextRoom(state, () => 0.5);
    expect(outcome).toBe('completed');
    expect(state.roomRecords[1].result.outcome).toBe('win');
  });

  it('retreatDungeonRun ends the run early without resolving another room', () => {
    const hero = createAdventurer('hero', heroTemplate(), 'front');
    const rooms = [makeRoom(3), makeRoom(3)];

    const state = startDungeonRun([hero], rooms);
    resolveNextRoom(state);

    const outcome = retreatDungeonRun();

    expect(outcome).toBe('retreat');
    expect(state.roomRecords).toHaveLength(1);
  });

  it('a Retreat action mid-room ends the whole run early, same as retreatDungeonRun', () => {
    const tactician = createAdventurer(
      'tactician',
      {
        name: 'Tactician',
        maxHp: 20,
        attackPower: 3,
        speed: 10, // acts before the enemy so the retreat fires before any damage lands
        actions: ['retreat', 'attack-nearest'],
        dieFaces: plainFaces(RetreatAction),
      },
      'front',
    );
    tactician.hp = 1; // party average well below the retreat threshold alone
    const rooms = [makeRoom(3), makeRoom(3)];

    const outcome = runDungeon([tactician], rooms);

    expect(outcome.outcome).toBe('retreat');
    expect(outcome.rooms).toHaveLength(1); // the run ended inside room 1, never reaching room 2
    expect(outcome.rooms[0].result.outcome).toBe('retreat');
  });

  it('a room that hits its round cap without either side wiped ends the run as a forced retreat, not a crash', () => {
    // Both sides tanky/weak enough that neither wipes the other within 2 rounds.
    const hero = createAdventurer('hero', enemyTemplate(1000, 1), 'front');
    const stalemateEnemy = createAdventurer('stalemate-enemy', enemyTemplate(1000, 1), 'front');
    const rooms: RoomDefinition[] = [{ enemies: [stalemateEnemy], maxRounds: 2 }];

    const outcome = runDungeon([hero], rooms, () => 0.5);

    expect(outcome.outcome).toBe('retreat');
    expect(outcome.rooms[0].result.outcome).toBe('retreat');
  });
});
