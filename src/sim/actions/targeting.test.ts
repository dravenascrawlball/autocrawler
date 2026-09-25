import { describe, it, expect } from 'vitest';
import { plainFaces } from '../dieFace';
import { createAdventurer, type AdventurerTemplate } from '../adventurer';
import { AttackNearestAction } from './attack';
import { createBattleState } from '../battle';
import { selectFirstEnemy, selectLowestHpEnemy, selectHighestAttackPowerAlly } from './targeting';

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

describe('row-restricted targeting (see formation.ts)', () => {
  it('a melee (restrictToMelee=true) selector only reaches the front row while any front-row member lives', () => {
    const actor = createAdventurer('actor', template(), 'front');
    const frontFoe = createAdventurer('front-foe', template(), 'front');
    const backFoe = createAdventurer('back-foe', template(), 'back');
    const battle = createBattleState([actor], [frontFoe, backFoe]);

    expect(selectFirstEnemy({ actor, battle }, true)).toBe(frontFoe);
  });

  it('a melee selector falls through to the back row once the front row has no living members', () => {
    const actor = createAdventurer('actor', template(), 'front');
    const deadFrontFoe = createAdventurer('front-foe', template(), 'front');
    deadFrontFoe.hp = 0;
    const backFoe = createAdventurer('back-foe', template(), 'back');
    const battle = createBattleState([actor], [deadFrontFoe, backFoe]);

    expect(selectFirstEnemy({ actor, battle }, true)).toBe(backFoe);
    expect(selectLowestHpEnemy({ actor, battle }, true)).toBe(backFoe);
  });

  it('a ranged (restrictToMelee=false) selector can reach the back row directly even while the front row is alive', () => {
    const actor = createAdventurer('actor', template(), 'front');
    const frontFoe = createAdventurer('front-foe', template(), 'front');
    const backFoe = createAdventurer('back-foe', template(), 'back');
    backFoe.hp = 1; // lowest HP, but behind a living front row — only reachable by an unrestricted selector
    const battle = createBattleState([actor], [frontFoe, backFoe]);

    expect(selectLowestHpEnemy({ actor, battle }, false)).toBe(backFoe);
  });
});

describe('selectHighestAttackPowerAlly (Fallacy\'s Empower — roadmap item 11)', () => {
  it('picks the living ally with the highest effective attackPower, self included', () => {
    const fallacy = createAdventurer('fallacy', template({ attackPower: 2 }), 'front');
    const weakAlly = createAdventurer('weak', template({ attackPower: 3 }), 'front');
    const strongAlly = createAdventurer('strong', template({ attackPower: 8 }), 'front');
    const battle = createBattleState([fallacy, weakAlly, strongAlly], []);

    expect(selectHighestAttackPowerAlly({ actor: fallacy, battle })).toBe(strongAlly);
  });

  it('compares effective attackPower (including modifiers), not just the base stat', () => {
    const fallacy = createAdventurer('fallacy', template({ attackPower: 2 }), 'front');
    const gearedAlly = createAdventurer(
      'geared',
      template({ attackPower: 3 }),
      'front',
      [{ stat: 'attackPower', type: 'flat', amount: 10, source: 'item:test-weapon' }],
    );
    const rawAlly = createAdventurer('raw', template({ attackPower: 8 }), 'front');
    const battle = createBattleState([fallacy, gearedAlly, rawAlly], []);

    expect(selectHighestAttackPowerAlly({ actor: fallacy, battle })).toBe(gearedAlly); // 3 + 10 = 13 > 8
  });

  it('ignores downed allies', () => {
    const fallacy = createAdventurer('fallacy', template({ attackPower: 2 }), 'front');
    const downedStrongAlly = createAdventurer('downed', template({ attackPower: 20 }), 'front');
    downedStrongAlly.hp = 0;
    const battle = createBattleState([fallacy, downedStrongAlly], []);

    expect(selectHighestAttackPowerAlly({ actor: fallacy, battle })).toBe(fallacy);
  });
});
