import { describe, it, expect } from 'vitest';
import { plainFaces } from '../dieFace';
import { createAdventurer, type AdventurerTemplate } from '../adventurer';
import { AttackNearestAction } from './attack';
import { RetreatAction, RETREAT_PARTY_HP_THRESHOLD_FRACTION } from './retreat';
import { createBattleState } from '../battle';
import { resolveRoom } from '../room';
import type { BattleState } from '../battle';

function template(overrides: Partial<AdventurerTemplate> = {}): AdventurerTemplate {
  return {
    name: 'Unit',
    maxHp: 20,
    attackPower: 3,
    speed: 5,
    actions: ['retreat', 'attack-nearest'],
    dieFaces: plainFaces(RetreatAction),
    ...overrides,
  };
}

describe('RetreatAction targeting', () => {
  it('is invalid while the party average HP ratio is at or above the threshold', () => {
    const actor = createAdventurer('actor', template(), 'front');
    const ally = createAdventurer('ally', template(), 'front');
    // Average ratio exactly at the threshold -> still not below it -> invalid.
    actor.hp = Math.round(actor.maxHp * RETREAT_PARTY_HP_THRESHOLD_FRACTION);
    ally.hp = Math.round(ally.maxHp * RETREAT_PARTY_HP_THRESHOLD_FRACTION);
    const battle = createBattleState([actor, ally], []);

    expect(RetreatAction.selectTarget({ actor, battle })).toBeNull();
  });

  it('targets the actor itself once the party average HP ratio drops below the threshold', () => {
    const actor = createAdventurer('actor', template(), 'front');
    const ally = createAdventurer('ally', template(), 'front');
    actor.hp = 1;
    ally.hp = 1;
    const battle = createBattleState([actor, ally], []);

    expect(RetreatAction.selectTarget({ actor, battle })).toBe(actor);
  });

  it('counts a downed ally (0 HP) against the party average, not just living members', () => {
    const actor = createAdventurer('actor', template(), 'front');
    const downedAlly = createAdventurer('downed', template(), 'front');
    actor.hp = actor.maxHp; // full HP alone would be well above threshold
    downedAlly.hp = 0;
    const battle = createBattleState([actor, downedAlly], []);

    // Average of (1.0, 0.0) = 0.5, still above the default 0.3 threshold —
    // confirms the downed member is included in the average, not excluded.
    expect(RetreatAction.selectTarget({ actor, battle })).toBeNull();

    downedAlly.hp = 0;
    actor.hp = Math.round(actor.maxHp * 0.1); // average now (0.1, 0.0) = 0.05, below threshold
    expect(RetreatAction.selectTarget({ actor, battle })).toBe(actor);
  });

  it('resolves to a retreat outcome', () => {
    const actor = createAdventurer('actor', template(), 'front');
    const battle = createBattleState([actor], []);
    expect(RetreatAction.resolve({ actor, target: actor, battle, rng: () => 0.5 })).toEqual({ type: 'retreat' });
  });
});

describe('RetreatAction wired into the turn engine and room resolution', () => {
  it('ends the room with a retreat outcome once the party HP ratio drops below threshold, even with enemies still alive', () => {
    const tactician = createAdventurer('tactician', template(), 'front');
    tactician.hp = 1; // well below threshold alone
    const enemy = createAdventurer(
      'enemy',
      template({ actions: ['attack-nearest'], dieFaces: plainFaces(AttackNearestAction), attackPower: 0, maxHp: 100 }),
      'front',
    );

    const battle: BattleState = createBattleState([tactician], [enemy]);

    const result = resolveRoom(battle, () => 0.5, 5);

    expect(result.outcome).toBe('retreat');
    expect(enemy.hp).toBe(100); // enemy untouched — the room ended via retreat, not combat
  });
});
