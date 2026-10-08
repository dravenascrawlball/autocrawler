import { describe, it, expect } from 'vitest';
import { plainFaces } from '../dieFace';
import { createAdventurer, type AdventurerTemplate } from '../adventurer';
import { AttackNearestAction } from './attack';
import { createBattleState } from '../battle';
import { selectFirstEnemy, selectLowestHpEnemy, selectHighestAttackPowerAlly } from './targeting';
import { applyBuff } from '../buffs';

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

  it('a melee selector progresses rank by rank on a full 3-rank grid, not just front/back', () => {
    const actor = createAdventurer('actor', template(), 'front');
    const rank0 = createAdventurer('rank-0', template(), { lane: 1, rank: 0 });
    const rank1 = createAdventurer('rank-1', template(), { lane: 1, rank: 1 });
    const rank2 = createAdventurer('rank-2', template(), { lane: 1, rank: 2 });
    const battle = createBattleState([actor], [rank0, rank1, rank2]);

    expect(selectFirstEnemy({ actor, battle }, true)).toBe(rank0);

    rank0.hp = 0;
    expect(selectFirstEnemy({ actor, battle }, true)).toBe(rank1);

    rank1.hp = 0;
    expect(selectFirstEnemy({ actor, battle }, true)).toBe(rank2);
  });
});

describe('Taunt overrides targeting (Bodil\'s second signature mechanic)', () => {
  function tauntUnit(unit: ReturnType<typeof createAdventurer>): void {
    applyBuff(unit, 'taunt-self', { stat: 'taunt', type: 'flat', amount: 1, source: 'buff:taunt' }, 3);
  }

  it('forces selectFirstEnemy onto the Taunting unit even when it is not the normal melee-eligible pick', () => {
    const actor = createAdventurer('actor', template(), 'front');
    const frontFoe = createAdventurer('front-foe', template(), 'front');
    const taunter = createAdventurer('taunter', template(), 'back');
    tauntUnit(taunter);
    const battle = createBattleState([actor], [frontFoe, taunter]);

    expect(selectFirstEnemy({ actor, battle }, true)).toBe(taunter);
  });

  it('forces selectLowestHpEnemy onto the Taunting unit even when it is not actually the lowest HP', () => {
    const actor = createAdventurer('actor', template(), 'front');
    const lowHpFoe = createAdventurer('low-hp-foe', template(), 'front');
    lowHpFoe.hp = 1;
    const taunter = createAdventurer('taunter', template({ maxHp: 100 }), 'front');
    tauntUnit(taunter);
    const battle = createBattleState([actor], [lowHpFoe, taunter]);

    expect(selectLowestHpEnemy({ actor, battle }, true)).toBe(taunter);
  });

  it('does not affect targeting for the Taunting unit\'s own side (allies are never forced onto a taunting ally)', () => {
    const tauntingAlly = createAdventurer('ally', template(), 'front');
    tauntUnit(tauntingAlly);
    expect(selectHighestAttackPowerAlly({ actor: tauntingAlly, battle: createBattleState([tauntingAlly], []) })).toBe(tauntingAlly);
  });

  it('falls back to normal targeting once the Taunt expires', () => {
    const actor = createAdventurer('actor', template(), 'front');
    const frontFoe = createAdventurer('front-foe', template(), 'front');
    const taunter = createAdventurer('taunter', template(), 'back');
    const battle = createBattleState([actor], [frontFoe, taunter]);

    expect(selectFirstEnemy({ actor, battle }, true)).toBe(frontFoe); // never Taunted, normal rules apply
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

describe('lane-limited melee reach (see targeting.ts\'s meleeEligibleOpponents)', () => {
  it("only reaches the frontmost unit in the attacker's own lane, even if another lane has a weaker front unit", () => {
    const actor = createAdventurer('actor', template(), { lane: 0, rank: 0 });
    const tank = createAdventurer('tank', template(), { lane: 0, rank: 0 });
    const squishy = createAdventurer('squishy', template(), { lane: 0, rank: 2 });
    squishy.hp = 1;
    const otherLane = createAdventurer('other-lane', template(), { lane: 2, rank: 0 });
    otherLane.hp = 2;
    const battle = createBattleState([actor], [otherLane, squishy, tank]);

    expect(selectFirstEnemy({ actor, battle }, true)).toBe(tank);
    expect(selectLowestHpEnemy({ actor, battle }, true)).toBe(tank);
  });

  it('reaches the unit behind once the one in front of it falls', () => {
    const actor = createAdventurer('actor', template(), { lane: 0, rank: 0 });
    const tank = createAdventurer('tank', template(), { lane: 0, rank: 0 });
    tank.hp = 0;
    const squishy = createAdventurer('squishy', template(), { lane: 0, rank: 2 });
    const otherLane = createAdventurer('other-lane', template(), { lane: 1, rank: 0 });
    const battle = createBattleState([actor], [otherLane, tank, squishy]);

    expect(selectFirstEnemy({ actor, battle }, true)).toBe(squishy);
  });

  it("moves to the nearest lane's frontmost unit once its own lane is empty", () => {
    const actor = createAdventurer('actor', template(), { lane: 0, rank: 0 });
    const far = createAdventurer('far', template(), { lane: 2, rank: 0 });
    const nearBack = createAdventurer('near-back', template(), { lane: 1, rank: 2 });
    const battle = createBattleState([actor], [far, nearBack]);

    expect(selectFirstEnemy({ actor, battle }, true)).toBe(nearBack);
  });

  it('treats both side lanes as equally near for a center-lane attacker', () => {
    const actor = createAdventurer('actor', template(), { lane: 1, rank: 0 });
    const left = createAdventurer('left', template(), { lane: 0, rank: 1 });
    const right = createAdventurer('right', template(), { lane: 2, rank: 0 });
    right.hp = 3;
    const battle = createBattleState([actor], [left, right]);

    expect(selectFirstEnemy({ actor, battle }, true)).toBe(left);
    expect(selectLowestHpEnemy({ actor, battle }, true)).toBe(right);
  });

  it('ranged reach still ignores lanes', () => {
    const actor = createAdventurer('actor', template(), { lane: 0, rank: 0 });
    const tank = createAdventurer('tank', template(), { lane: 0, rank: 0 });
    const hidden = createAdventurer('hidden', template(), { lane: 2, rank: 2 });
    hidden.hp = 1;
    const battle = createBattleState([actor], [tank, hidden]);

    expect(selectLowestHpEnemy({ actor, battle }, false)).toBe(hidden);
  });
});
