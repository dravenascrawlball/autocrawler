import { describe, it, expect } from 'vitest';
import { plainFaces } from '../dieFace';
import { createAdventurer, type AdventurerTemplate } from '../adventurer';
import { AttackNearestAction } from './attack';
import { createBattleState } from '../battle';
import { getEffectiveStat } from '../stats';
import {
  EmpowerAction,
  CommandAction,
  EMPOWER_ATTACK_PERCENT_BONUS,
  EMPOWER_BUFF_DURATION_TURNS,
  InspireAction,
  INSPIRE_ACCURACY_BONUS,
  INSPIRE_CRIT_CHANCE_BONUS,
  INSPIRE_DURATION_TURNS,
  PotionTossAllyAction,
  PotionTossEnemyAction,
  POTION_BUFF_ATTACK_PERCENT,
  POTION_BUFF_ACCURACY,
  POTION_DEBUFF_ATTACK_PERCENT,
  POTION_DEBUFF_ACCURACY,
  POTION_EFFECT_DURATION_TURNS,
} from './support';

/** rng() returns each value in order, repeating the last once exhausted — same helper as attack.test.ts's own copy. */
function sequence(...values: number[]): () => number {
  let i = 0;
  return () => values[Math.min(i++, values.length - 1)];
}

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

describe('EmpowerAction (Fallacy\'s signature mechanic — roadmap item 11)', () => {
  it('buffs the highest-attackPower living ally, herself included, and deals no damage of her own', () => {
    const fallacy = createAdventurer('fallacy', template({ attackPower: 2 }), 'front');
    const strongAlly = createAdventurer('strong', template({ attackPower: 8 }), 'front');
    const enemy = createAdventurer('enemy', template({ maxHp: 100 }), 'front');
    const battle = createBattleState([fallacy, strongAlly], [enemy]);

    const target = EmpowerAction.selectTarget({ actor: fallacy, battle });
    expect(target).toBe(strongAlly);

    const outcome = EmpowerAction.resolve({ actor: fallacy, target: strongAlly, battle, rng: () => 0.5 });

    expect(outcome).toEqual({
      type: 'support-buff',
      targetId: 'strong',
      stat: 'attackPower',
      amount: EMPOWER_ATTACK_PERCENT_BONUS,
      durationTurns: EMPOWER_BUFF_DURATION_TURNS,
    });
    expect(getEffectiveStat(strongAlly.attackPower, 'attackPower', strongAlly.modifiers)).toBe(
      8 * (1 + EMPOWER_ATTACK_PERCENT_BONUS / 100),
    );
    expect(enemy.hp).toBe(100); // Empower never touches the opposing roster
  });
});

describe('CommandAction (Fallacy\'s signature mechanic — roadmap item 11)', () => {
  it('never commands herself, even as the only other option would be an enemy', () => {
    const fallacy = createAdventurer('fallacy', template(), 'front');
    const enemy = createAdventurer('enemy', template({ maxHp: 100 }), 'front');
    const battle = createBattleState([fallacy], [enemy]);

    expect(CommandAction.selectTarget({ actor: fallacy, battle })).toBeNull();
  });

  it('grants a random living ally a bonus attack that lands real damage on an enemy, crediting the commanded ally not Fallacy', () => {
    const fallacy = createAdventurer('fallacy', template({ attackPower: 1 }), 'front');
    const ally = createAdventurer('ally', template({ attackPower: 7 }), 'front');
    const enemy = createAdventurer('enemy', template({ maxHp: 100 }), 'front');
    const battle = createBattleState([fallacy, ally], [enemy]);

    const outcome = CommandAction.resolve({ actor: fallacy, target: ally, battle, rng: () => 0.5 });

    expect(outcome).toEqual({
      type: 'command',
      commandedAllyId: 'ally',
      attackOutcome: { damage: 7, hit: true, targetId: 'enemy' },
    });
    expect(enemy.hp).toBe(93); // the ally's own attackPower, not Fallacy's
  });

  it('picks among every other living ally, not just the first found', () => {
    const fallacy = createAdventurer('fallacy', template(), 'front');
    const allyA = createAdventurer('ally-a', template(), 'front');
    const allyB = createAdventurer('ally-b', template(), 'front');
    const enemy = createAdventurer('enemy', template({ maxHp: 100 }), 'front');
    const battle = createBattleState([fallacy, allyA, allyB], [enemy]);

    // rng() = 0 picks index 0 of the 2 commandable allies (allyA); rng() close to 1 picks the last.
    const lowRoll = CommandAction.resolve({ actor: fallacy, target: allyA, battle, rng: () => 0 });
    expect(lowRoll).toMatchObject({ commandedAllyId: 'ally-a' });

    const highRoll = CommandAction.resolve({ actor: fallacy, target: allyA, battle, rng: () => 0.999999 });
    expect(highRoll).toMatchObject({ commandedAllyId: 'ally-b' });
  });
});

describe('InspireAction (Tharavel\'s signature mechanic — roadmap item 11)', () => {
  it('buffs every living ally at once, herself included, with both accuracy and critChance, and deals no damage of her own', () => {
    const tharavel = createAdventurer('tharavel', template(), 'front');
    const ally = createAdventurer('ally', template(), 'front');
    const downedAlly = createAdventurer('downed', template(), 'front');
    downedAlly.hp = 0;
    const enemy = createAdventurer('enemy', template({ maxHp: 100 }), 'front');
    const battle = createBattleState([tharavel, ally, downedAlly], [enemy]);

    const outcome = InspireAction.resolve({ actor: tharavel, target: ally, battle, rng: () => 0.5 });

    expect(outcome).toEqual({
      type: 'party-buff',
      buffedAllyIds: ['tharavel', 'ally'],
      accuracyAmount: INSPIRE_ACCURACY_BONUS,
      critChanceAmount: INSPIRE_CRIT_CHANCE_BONUS,
      durationTurns: INSPIRE_DURATION_TURNS,
    });

    for (const buffed of [tharavel, ally]) {
      expect(getEffectiveStat(buffed.accuracy, 'accuracy', buffed.modifiers)).toBe(buffed.accuracy + INSPIRE_ACCURACY_BONUS);
      expect(getEffectiveStat(buffed.critChance, 'critChance', buffed.modifiers)).toBe(
        buffed.critChance + INSPIRE_CRIT_CHANCE_BONUS,
      );
    }
    expect(getEffectiveStat(downedAlly.accuracy, 'accuracy', downedAlly.modifiers)).toBe(downedAlly.accuracy); // downed — untouched
    expect(enemy.hp).toBe(100); // Inspire never touches the opposing roster
  });

  it('refreshes both buffs (not stacking) if re-cast before they expire', () => {
    const tharavel = createAdventurer('tharavel', template(), 'front');
    const battle = createBattleState([tharavel], []);

    InspireAction.resolve({ actor: tharavel, target: tharavel, battle, rng: () => 0.5 });
    InspireAction.resolve({ actor: tharavel, target: tharavel, battle, rng: () => 0.5 });

    // Two independent buffs (accuracy, critChance), each refreshed once — never four entries.
    expect(tharavel.buffs).toHaveLength(2);
    expect(getEffectiveStat(tharavel.accuracy, 'accuracy', tharavel.modifiers)).toBe(
      tharavel.accuracy + INSPIRE_ACCURACY_BONUS,
    );
    expect(getEffectiveStat(tharavel.critChance, 'critChance', tharavel.modifiers)).toBe(
      tharavel.critChance + INSPIRE_CRIT_CHANCE_BONUS,
    );
  });
});

describe('PotionTossAllyAction (Mira\'s signature mechanic — roadmap item 3)', () => {
  it('buffs a uniformly random living ally (herself included) and deals no damage of her own', () => {
    const mira = createAdventurer('mira', template(), 'front');
    const allyA = createAdventurer('ally-a', template(), 'front');
    const allyB = createAdventurer('ally-b', template(), 'front');
    const enemy = createAdventurer('enemy', template({ maxHp: 100 }), 'front');
    const battle = createBattleState([mira, allyA, allyB], [enemy]);

    // target-index roll -> ally-b (index 2 of [mira, ally-a, ally-b]); effect roll (0, < 0.5) -> attackPower buff.
    const outcome = PotionTossAllyAction.resolve({ actor: mira, target: mira, battle, rng: sequence(0.99, 0) });

    expect(outcome).toEqual({
      type: 'support-buff',
      targetId: 'ally-b',
      stat: 'attackPower',
      amount: POTION_BUFF_ATTACK_PERCENT,
      durationTurns: POTION_EFFECT_DURATION_TURNS,
    });
    expect(getEffectiveStat(allyB.attackPower, 'attackPower', allyB.modifiers)).toBe(
      allyB.attackPower * (1 + POTION_BUFF_ATTACK_PERCENT / 100),
    );
    expect(enemy.hp).toBe(100); // never touches the opposing roster
  });

  it('can roll the accuracy buff instead of the attackPower one', () => {
    const mira = createAdventurer('mira', template(), 'front');
    const battle = createBattleState([mira], []);

    // target-index roll -> mira herself (only ally); effect roll (0.99, >= 0.5) -> accuracy buff.
    const outcome = PotionTossAllyAction.resolve({ actor: mira, target: mira, battle, rng: sequence(0, 0.99) });

    expect(outcome).toEqual({
      type: 'support-buff',
      targetId: 'mira',
      stat: 'accuracy',
      amount: POTION_BUFF_ACCURACY,
      durationTurns: POTION_EFFECT_DURATION_TURNS,
    });
  });
});

describe('PotionTossEnemyAction (Mira\'s signature mechanic — roadmap item 3)', () => {
  it('is a ranged action that can reach the back row directly even while the front row is alive', () => {
    expect(PotionTossEnemyAction.reach).toBe('ranged');

    const mira = createAdventurer('mira', template(), 'front');
    const frontEnemy = createAdventurer('front', template({ maxHp: 100 }), 'front');
    const backEnemy = createAdventurer('back', template({ maxHp: 100 }), 'back');
    const battle = createBattleState([mira], [frontEnemy, backEnemy]);

    // target-index roll -> backEnemy (index 1 of [front, back]); effect roll (0, < 0.5) -> attackPower debuff.
    const outcome = PotionTossEnemyAction.resolve({ actor: mira, target: frontEnemy, battle, rng: sequence(0.99, 0) });

    expect(outcome).toEqual({
      type: 'support-debuff',
      targetId: 'back',
      stat: 'attackPower',
      amount: POTION_DEBUFF_ATTACK_PERCENT,
      durationTurns: POTION_EFFECT_DURATION_TURNS,
    });
    expect(getEffectiveStat(backEnemy.attackPower, 'attackPower', backEnemy.modifiers)).toBe(
      backEnemy.attackPower * (1 + POTION_DEBUFF_ATTACK_PERCENT / 100),
    );
    expect(frontEnemy.hp).toBe(100); // never deals damage
  });

  it('can roll the accuracy debuff instead of the attackPower one', () => {
    const mira = createAdventurer('mira', template(), 'front');
    const enemy = createAdventurer('enemy', template({ maxHp: 100 }), 'front');
    const battle = createBattleState([mira], [enemy]);

    // target-index roll -> the only enemy; effect roll (0.99, >= 0.5) -> accuracy debuff.
    const outcome = PotionTossEnemyAction.resolve({ actor: mira, target: enemy, battle, rng: sequence(0, 0.99) });

    expect(outcome).toEqual({
      type: 'support-debuff',
      targetId: 'enemy',
      stat: 'accuracy',
      amount: POTION_DEBUFF_ACCURACY,
      durationTurns: POTION_EFFECT_DURATION_TURNS,
    });
  });
});
