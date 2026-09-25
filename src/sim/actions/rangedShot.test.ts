import { describe, it, expect } from 'vitest';
import { plainFaces } from '../dieFace';
import { createAdventurer, type AdventurerTemplate } from '../adventurer';
import { RangedShotAction, AttackNearestAction } from './attack';
import { createBattleState } from '../battle';
import { resolveTurn } from '../turnEngine';

function template(overrides: Partial<AdventurerTemplate> = {}): AdventurerTemplate {
  return {
    name: 'Unit',
    maxHp: 20,
    attackPower: 5,
    speed: 5,
    actions: ['attack-nearest'],
    dieFaces: plainFaces(AttackNearestAction),
    ...overrides,
  };
}

describe('RangedShotAction', () => {
  it('is a ranged action, unlike the melee-only Attack (Front)', () => {
    expect(RangedShotAction.reach).toBe('ranged');
    expect(AttackNearestAction.reach).toBe('melee');
  });

  it('lets a Ranger hit the back row directly, where a melee attacker is stuck targeting the front row instead', () => {
    const ranger = createAdventurer('ranger', template({ dieFaces: plainFaces(RangedShotAction) }), 'front');
    const meleeFighter = createAdventurer(
      'melee',
      template({ dieFaces: plainFaces(AttackNearestAction) }),
      'front',
    );
    const backFoe = createAdventurer('back-foe', template({ maxHp: 100 }), 'back');
    const frontFoe = createAdventurer('front-foe', template({ maxHp: 100 }), 'front');
    // Back-foe listed first in roster order: an unrestricted (ranged) pick reaches it directly,
    // while a melee pick has to skip it for the living front-row member instead.
    const battle = createBattleState([ranger, meleeFighter], [backFoe, frontFoe]);

    const rangerTurn = resolveTurn(ranger, battle, () => 0.5);
    expect(rangerTurn.events[0]).toMatchObject({
      type: 'action',
      actionId: 'ranged-shot',
      outcome: { targetId: 'back-foe' },
    });

    const meleeTurn = resolveTurn(meleeFighter, battle, () => 0.5);
    expect(meleeTurn.events[0]).toMatchObject({
      type: 'action',
      actionId: 'attack-nearest',
      outcome: { targetId: 'front-foe' },
    });
  });
});
