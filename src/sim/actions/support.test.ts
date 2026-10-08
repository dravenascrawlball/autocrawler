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
  INSPIRE_CRIT_CHANCE_BONUS,
  INSPIRE_DURATION_TURNS,
  PotionTossAllyAction,
  PotionTossEnemyAction,
  POTION_BUFF_ATTACK_PERCENT,
  POTION_BUFF_CRIT_CHANCE,
  POTION_DEBUFF_ATTACK_PERCENT,
  POTION_DEBUFF_VULNERABILITY_PERCENT,
  POTION_EFFECT_DURATION_TURNS,
  ShieldWallAction,
  SHIELD_WALL_AMOUNT,
  SHIELD_WALL_DURATION_TURNS,
  TauntAction,
  TAUNT_DURATION_TURNS,
  MarkAction,
  MARK_VULNERABILITY_PERCENT,
  MARK_DURATION_TURNS,
  SilenceAction,
  SILENCE_DURATION_TURNS,
  StunAction,
  STUN_DURATION_TURNS,
  GuardiansWardAction,
  GUARDIANS_WARD_DURATION_TURNS,
  VanishAction,
  VANISH_DURATION_TURNS,
} from './support';
import { selectFirstEnemy } from './targeting';
import { resolveSpecialActionTriggers } from '../specialActions';
import { resolveTurn } from '../turnEngine';

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
  it('buffs every living ally at once, herself included, with critChance, and deals no damage of her own', () => {
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
      critChanceAmount: INSPIRE_CRIT_CHANCE_BONUS,
      durationTurns: INSPIRE_DURATION_TURNS,
    });

    for (const buffed of [tharavel, ally]) {
      expect(getEffectiveStat(buffed.critChance, 'critChance', buffed.modifiers)).toBe(
        buffed.critChance + INSPIRE_CRIT_CHANCE_BONUS,
      );
    }
    expect(getEffectiveStat(downedAlly.critChance, 'critChance', downedAlly.modifiers)).toBe(downedAlly.critChance); // downed — untouched
    expect(enemy.hp).toBe(100); // Inspire never touches the opposing roster
  });

  it('refreshes the buff (not stacking) if re-cast before it expires', () => {
    const tharavel = createAdventurer('tharavel', template(), 'front');
    const battle = createBattleState([tharavel], []);

    InspireAction.resolve({ actor: tharavel, target: tharavel, battle, rng: () => 0.5 });
    InspireAction.resolve({ actor: tharavel, target: tharavel, battle, rng: () => 0.5 });

    expect(tharavel.buffs).toHaveLength(1);
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

  it('can roll the critChance buff instead of the attackPower one', () => {
    const mira = createAdventurer('mira', template(), 'front');
    const battle = createBattleState([mira], []);

    // target-index roll -> mira herself (only ally); effect roll (0.99, >= 0.5) -> critChance buff.
    const outcome = PotionTossAllyAction.resolve({ actor: mira, target: mira, battle, rng: sequence(0, 0.99) });

    expect(outcome).toEqual({
      type: 'support-buff',
      targetId: 'mira',
      stat: 'critChance',
      amount: POTION_BUFF_CRIT_CHANCE,
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

  it('can roll the vulnerability debuff instead of the attackPower one', () => {
    const mira = createAdventurer('mira', template(), 'front');
    const enemy = createAdventurer('enemy', template({ maxHp: 100 }), 'front');
    const battle = createBattleState([mira], [enemy]);

    // target-index roll -> the only enemy; effect roll (0.99, >= 0.5) -> vulnerability debuff.
    const outcome = PotionTossEnemyAction.resolve({ actor: mira, target: enemy, battle, rng: sequence(0, 0.99) });

    expect(outcome).toEqual({
      type: 'support-debuff',
      targetId: 'enemy',
      stat: 'vulnerability',
      amount: POTION_DEBUFF_VULNERABILITY_PERCENT,
      durationTurns: POTION_EFFECT_DURATION_TURNS,
    });
  });
});

describe('ShieldWallAction (Glint\'s second signature mechanic)', () => {
  it('grants Shield to whichever living ally has the lowest HP, herself included, with no attack of her own', () => {
    const glint = createAdventurer('glint', template(), 'front');
    glint.hp = 15;
    const woundedAlly = createAdventurer('ally', template(), 'front');
    woundedAlly.hp = 5;
    const enemy = createAdventurer('enemy', template({ maxHp: 100 }), 'front');
    const battle = createBattleState([glint, woundedAlly], [enemy]);

    const target = ShieldWallAction.selectTarget({ actor: glint, battle });
    expect(target).toBe(woundedAlly);

    const outcome = ShieldWallAction.resolve({ actor: glint, target: woundedAlly, battle, rng: () => 0.5 });

    expect(outcome).toEqual({
      type: 'support-shield',
      targetId: 'ally',
      amount: SHIELD_WALL_AMOUNT,
      durationTurns: SHIELD_WALL_DURATION_TURNS,
    });
    expect(woundedAlly.shields).toEqual([{ id: 'shield-wall', amount: SHIELD_WALL_AMOUNT, remainingTurns: SHIELD_WALL_DURATION_TURNS }]);
    expect(enemy.hp).toBe(100); // never deals damage
  });

  it('still resolves (shields herself) even when nobody else needs it', () => {
    const glint = createAdventurer('glint', template(), 'front');
    const battle = createBattleState([glint], []);

    const target = ShieldWallAction.selectTarget({ actor: glint, battle });
    expect(target).toBe(glint);
  });
});

describe('TauntAction (Bodil\'s second signature mechanic)', () => {
  it('targets herself only and deals no damage', () => {
    const bodil = createAdventurer('bodil', template(), 'front');
    const enemy = createAdventurer('enemy', template({ maxHp: 100 }), 'front');
    const battle = createBattleState([bodil], [enemy]);

    expect(TauntAction.selectTarget({ actor: bodil, battle })).toBe(bodil);

    const outcome = TauntAction.resolve({ actor: bodil, target: bodil, battle, rng: () => 0.5 });

    expect(outcome).toEqual({ type: 'support-buff', targetId: 'bodil', stat: 'taunt', amount: 1, durationTurns: TAUNT_DURATION_TURNS });
    expect(enemy.hp).toBe(100);
  });

  it('actually forces opposing targeting onto her once resolved', () => {
    const bodil = createAdventurer('bodil', template(), 'back');
    const frontFoe = createAdventurer('front-foe', template(), 'front');
    const attacker = createAdventurer('attacker', template(), 'front');
    const battle = createBattleState([attacker], [frontFoe, bodil]);

    TauntAction.resolve({ actor: bodil, target: bodil, battle, rng: () => 0.5 });

    expect(selectFirstEnemy({ actor: attacker, battle }, true)).toBe(bodil);
  });
});

describe("MarkAction (Isilwen's second signature mechanic)", () => {
  it('applies a timed vulnerability debuff to a living enemy, dealing no damage', () => {
    const isilwen = createAdventurer('isilwen', template(), 'front');
    const enemy = createAdventurer('enemy', template({ maxHp: 100 }), 'front');
    const battle = createBattleState([isilwen], [enemy]);

    const outcome = MarkAction.resolve({ actor: isilwen, target: enemy, battle, rng: () => 0.5 });

    expect(outcome).toEqual({
      type: 'support-debuff',
      targetId: 'enemy',
      stat: 'vulnerability',
      amount: MARK_VULNERABILITY_PERCENT,
      durationTurns: MARK_DURATION_TURNS,
    });
    expect(getEffectiveStat(0, 'vulnerability', enemy.modifiers)).toBe(MARK_VULNERABILITY_PERCENT);
    expect(enemy.hp).toBe(100);
  });

  it('actually makes the marked target take more damage from a landed hit', () => {
    const isilwen = createAdventurer('isilwen', template(), 'front');
    const attacker = createAdventurer('attacker', template({ attackPower: 10 }), 'front');
    const enemy = createAdventurer('enemy', template({ maxHp: 1000 }), 'front');
    const battle = createBattleState([isilwen, attacker], [enemy]);

    MarkAction.resolve({ actor: isilwen, target: enemy, battle, rng: () => 0.5 });
    const outcome = AttackNearestAction.resolve({ actor: attacker, target: enemy, battle, rng: () => 0.5 });

    expect(outcome).toMatchObject({ hit: true, damage: Math.round(10 * (1 + MARK_VULNERABILITY_PERCENT / 100)) });
  });
});

describe("SilenceAction (Fallacy's second signature mechanic)", () => {
  it('applies a timed Silence debuff to a living enemy, dealing no damage', () => {
    const fallacy = createAdventurer('fallacy', template(), 'front');
    const enemy = createAdventurer('enemy', template({ maxHp: 100 }), 'front');
    const battle = createBattleState([fallacy], [enemy]);

    const outcome = SilenceAction.resolve({ actor: fallacy, target: enemy, battle, rng: () => 0.5 });

    expect(outcome).toEqual({ type: 'support-debuff', targetId: 'enemy', stat: 'silence', amount: 1, durationTurns: SILENCE_DURATION_TURNS });
    expect(enemy.hp).toBe(100);
  });

  it('actually suppresses every Special Action the silenced unit has, regardless of trigger', () => {
    const fallacy = createAdventurer('fallacy', template(), 'front');
    const enemy = createAdventurer('enemy', template(), 'front');
    const battle = createBattleState([fallacy], [enemy]);

    SilenceAction.resolve({ actor: fallacy, target: enemy, battle, rng: () => 0.5 });
    const outcomes = resolveSpecialActionTriggers(
      enemy,
      [{ id: 'test-special', name: 'Test', trigger: 'on-turn-start', action: EmpowerAction }],
      { trigger: 'on-turn-start' },
      battle,
      () => 0.5,
    );

    expect(outcomes).toEqual([]);
  });
});

describe("StunAction (Mirka's second signature mechanic)", () => {
  it('applies a timed Stun debuff to a living enemy, dealing no damage', () => {
    const mirka = createAdventurer('mirka', template(), 'front');
    const enemy = createAdventurer('enemy', template({ maxHp: 100 }), 'front');
    const battle = createBattleState([mirka], [enemy]);

    const outcome = StunAction.resolve({ actor: mirka, target: enemy, battle, rng: () => 0.5 });

    expect(outcome).toEqual({ type: 'support-debuff', targetId: 'enemy', stat: 'stun', amount: 1, durationTurns: STUN_DURATION_TURNS });
    expect(enemy.hp).toBe(100);
  });

  it('actually skips the stunned unit\'s entire next turn (no Basic Action, no on-turn-start Special)', () => {
    const mirka = createAdventurer('mirka', template(), 'front');
    const stunnedEnemy = createAdventurer('enemy', template(), 'front');
    const victim = createAdventurer('victim', template({ maxHp: 100 }), 'front');
    const battle = createBattleState([mirka], [stunnedEnemy, victim]);

    StunAction.resolve({ actor: mirka, target: stunnedEnemy, battle, rng: () => 0.5 });
    const result = resolveTurn(stunnedEnemy, battle, () => 0.5);

    expect(result.events).toEqual([]);
    expect(victim.hp).toBe(100); // stunnedEnemy's Basic Action (an attack) never fired
  });
});

describe("GuardiansWardAction (Tharavel's second signature mechanic)", () => {
  it('grants Invulnerability to whichever living ally has the lowest HP, herself included', () => {
    const tharavel = createAdventurer('tharavel', template(), 'front');
    tharavel.hp = 15;
    const woundedAlly = createAdventurer('ally', template(), 'front');
    woundedAlly.hp = 5;
    const battle = createBattleState([tharavel, woundedAlly], []);

    const target = GuardiansWardAction.selectTarget({ actor: tharavel, battle });
    expect(target).toBe(woundedAlly);

    const outcome = GuardiansWardAction.resolve({ actor: tharavel, target: woundedAlly, battle, rng: () => 0.5 });

    expect(outcome).toEqual({
      type: 'support-buff',
      targetId: 'ally',
      stat: 'invulnerable',
      amount: 1,
      durationTurns: GUARDIANS_WARD_DURATION_TURNS,
    });
    expect(getEffectiveStat(0, 'invulnerable', woundedAlly.modifiers)).toBe(1);
  });
});

describe("VanishAction (Dravena's second signature mechanic)", () => {
  it('targets herself only and grants Stealth, dealing no damage', () => {
    const dravena = createAdventurer('dravena', template(), 'front');
    const enemy = createAdventurer('enemy', template({ maxHp: 100 }), 'front');
    const battle = createBattleState([dravena], [enemy]);

    expect(VanishAction.selectTarget({ actor: dravena, battle })).toBe(dravena);

    const outcome = VanishAction.resolve({ actor: dravena, target: dravena, battle, rng: () => 0.5 });

    expect(outcome).toEqual({ type: 'support-buff', targetId: 'dravena', stat: 'stealth', amount: 1, durationTurns: VANISH_DURATION_TURNS });
    expect(enemy.hp).toBe(100);
  });

  it('actually removes her from enemy targeting once resolved, while a non-Stealthed ally stays targetable', () => {
    const dravena = createAdventurer('dravena', template(), 'front');
    const otherAlly = createAdventurer('other-ally', template(), 'front');
    const attacker = createAdventurer('attacker', template(), 'front');
    const battle = createBattleState([attacker], [dravena, otherAlly]);

    VanishAction.resolve({ actor: dravena, target: dravena, battle, rng: () => 0.5 });

    expect(selectFirstEnemy({ actor: attacker, battle }, true)).toBe(otherAlly);
  });

  it('falls back to showing her if Vanishing would leave the opposing side with no targets at all', () => {
    const dravena = createAdventurer('dravena', template(), 'front');
    const attacker = createAdventurer('attacker', template(), 'front');
    const battle = createBattleState([attacker], [dravena]);

    VanishAction.resolve({ actor: dravena, target: dravena, battle, rng: () => 0.5 });
    // Re-check with restrictToMelee=false too, to ensure the fallback isn't melee-specific.
    expect(selectFirstEnemy({ actor: attacker, battle }, false)).toBe(dravena);
  });
});
