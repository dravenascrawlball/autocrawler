import { describe, it, expect } from 'vitest';
import { plainFaces } from '../dieFace';
import { createAdventurer, type AdventurerTemplate } from '../adventurer';
import {
  AttackNearestAction,
  FlankStrikeAction,
  VenomSpitAction,
  SearingTouchAction,
  VENOM_SPIT_POISON_PER_TICK,
  SEARING_TOUCH_BURN_PER_TICK,
} from './attack';
import { RegenerateAction, REGENERATE_HP_FRACTION } from './heal';
import { VengeanceAction, VENGEANCE_ATTACK_PERCENT } from './support';
import { createBattleState } from '../battle';
import { getEffectiveStat } from '../stats';
import { ENRAGE_TRAIT, ENRAGE_BONUS_FRACTION } from '../traits';
import { resolveTurn } from '../turnEngine';

function template(overrides: Partial<AdventurerTemplate> = {}): AdventurerTemplate {
  return {
    name: 'Unit',
    maxHp: 20,
    attackPower: 10,
    speed: 5,
    actions: ['attack-nearest'],
    dieFaces: plainFaces(AttackNearestAction),
    ...overrides,
  };
}

const noVariance = () => 0.5; // rollDamageVariance midpoint (×1), and above any crit chance

describe('Flank Strike (Goblin Flanker)', () => {
  it("hits the front of the weakest lane, not its own lane's front", () => {
    const flanker = createAdventurer('flanker', template(), { lane: 0, rank: 0 });
    const ownLaneTank = createAdventurer('tank', template({ maxHp: 40 }), { lane: 0, rank: 0 });
    const thinFront = createAdventurer('thin-front', template({ maxHp: 8 }), { lane: 2, rank: 0 });
    const middleLane = createAdventurer('middle', template(), { lane: 1, rank: 0 });
    const battle = createBattleState([ownLaneTank, middleLane, thinFront], [flanker]);

    expect(FlankStrikeAction.selectTarget({ actor: flanker, battle })).toBe(thinFront);
  });

  it('still cannot reach past the front unit of the weakest lane', () => {
    const flanker = createAdventurer('flanker', template(), { lane: 1, rank: 0 });
    const front = createAdventurer('front', template({ maxHp: 6 }), { lane: 2, rank: 0 });
    const behind = createAdventurer('behind', template({ maxHp: 2 }), { lane: 2, rank: 2 });
    const other = createAdventurer('other', template({ maxHp: 40 }), { lane: 0, rank: 0 });
    const battle = createBattleState([other, front, behind], [flanker]);

    expect(FlankStrikeAction.selectTarget({ actor: flanker, battle })).toBe(front);
  });
});

describe('attack-and-status (Venom Spit / Searing Touch)', () => {
  it('Venom Spit hits the weakest party member at range and poisons them', () => {
    const spitter = createAdventurer('spitter', template({ attackPower: 3 }), { lane: 1, rank: 2 });
    const front = createAdventurer('front', template(), { lane: 1, rank: 0 });
    const hiddenHealer = createAdventurer('healer', template(), { lane: 1, rank: 2 });
    hiddenHealer.hp = 10;
    const battle = createBattleState([front, hiddenHealer], [spitter]);

    const target = VenomSpitAction.selectTarget({ actor: spitter, battle })!;
    expect(target).toBe(hiddenHealer);
    const outcome = VenomSpitAction.resolve({ actor: spitter, target, battle, rng: noVariance });
    expect(outcome).toMatchObject({ type: 'attack-and-status', effectId: 'poison', statusApplied: true, damage: 3 });
    expect(hiddenHealer.statusEffects).toEqual([
      expect.objectContaining({ id: 'poison', damagePerTick: VENOM_SPIT_POISON_PER_TICK }),
    ]);
  });

  it('Searing Touch burns its melee target', () => {
    const imp = createAdventurer('imp', template({ attackPower: 3 }), 'front');
    const target = createAdventurer('target', template(), 'front');
    const battle = createBattleState([target], [imp]);

    const outcome = SearingTouchAction.resolve({ actor: imp, target, battle, rng: noVariance });
    expect(outcome).toMatchObject({ type: 'attack-and-status', effectId: 'burn', statusApplied: true });
    expect(target.statusEffects).toEqual([expect.objectContaining({ id: 'burn', damagePerTick: SEARING_TOUCH_BURN_PER_TICK })]);
  });

  it('applies no status when the hit is fully absorbed', () => {
    const imp = createAdventurer('imp', template({ attackPower: 3 }), 'front');
    const target = createAdventurer('target', template(), 'front');
    target.shields = [{ id: 'test', amount: 50, remainingTurns: 3 }];
    const battle = createBattleState([target], [imp]);

    const outcome = SearingTouchAction.resolve({ actor: imp, target, battle, rng: noVariance });
    expect(outcome).toMatchObject({ damage: 0, statusApplied: false });
    expect(target.statusEffects).toEqual([]);
  });
});

describe('Troll Warlord mechanics', () => {
  it('Regenerate heals a fraction of max HP while hurt, and is idle at full HP', () => {
    const troll = createAdventurer('troll', template({ maxHp: 100 }), 'front');
    const battle = createBattleState([], [troll]);
    expect(RegenerateAction.selectTarget({ actor: troll, battle })).toBeNull();

    troll.hp = 50;
    const outcome = RegenerateAction.resolve({ actor: troll, target: troll, battle, rng: noVariance });
    expect(outcome).toEqual({ type: 'heal', amount: 100 * REGENERATE_HP_FRACTION, targetId: 'troll' });
    expect(troll.hp).toBe(50 + 100 * REGENERATE_HP_FRACTION);
  });

  it('Enrage boosts damage only below half HP', () => {
    const troll = createAdventurer('troll', template({ attackPower: 10, traits: [ENRAGE_TRAIT] }), 'front');
    const hit = () => {
      const target = createAdventurer('target', template({ maxHp: 1000 }), 'front');
      const battle = createBattleState([target], [troll]);
      const outcome = AttackNearestAction.resolve({ actor: troll, target, battle, rng: noVariance });
      return outcome.type === 'attack' ? outcome.damage : NaN;
    };

    troll.hp = 15; // 75%
    expect(hit()).toBe(10);
    troll.hp = 5; // 25%
    expect(hit()).toBe(Math.round(10 * (1 + ENRAGE_BONUS_FRACTION)));
  });
});

describe('Bone Sentinel Vengeance', () => {
  it('grants the Sentinel a lasting attack buff', () => {
    const sentinel = createAdventurer('sentinel', template({ attackPower: 10 }), 'front');
    const battle = createBattleState([], [sentinel]);
    VengeanceAction.resolve({ actor: sentinel, target: sentinel, battle, rng: noVariance });
    expect(getEffectiveStat(sentinel.attackPower, 'attackPower', sentinel.modifiers)).toBe(10 * (1 + VENGEANCE_ATTACK_PERCENT / 100));
  });

  it('fires when an ally on its side is downed during a turn', () => {
    const killer = createAdventurer('killer', template({ attackPower: 50 }), 'front');
    const doomed = createAdventurer('doomed', template({ maxHp: 5 }), 'front');
    const sentinel = createAdventurer('sentinel', template(), 'back');
    sentinel.activeSpecialActions = [
      { id: 'sentinel-vengeance', name: 'Vengeance', trigger: 'on-ally-downed', action: VengeanceAction },
    ];
    const battle = createBattleState([killer], [doomed, sentinel]);

    const result = resolveTurn(killer, battle, noVariance);
    expect(doomed.hp).toBeLessThanOrEqual(0);
    expect(result.events).toContainEqual(expect.objectContaining({ type: 'special-action', actorId: 'sentinel', specialActionId: 'sentinel-vengeance' }));
  });
});
