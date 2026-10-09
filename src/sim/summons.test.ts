import { describe, it, expect } from 'vitest';
import { createAdventurer } from './adventurer';
import { createBattleState } from './battle';
import { resolveTurn } from './turnEngine';
import { scaleEnemy, createHellcaller, EMBER_IMP_TEMPLATE } from '../data/enemies';
import { GUDRUN_TEMPLATE } from '../data/characters';

const noVariance = () => 0.5;

function setup() {
  const caller = createHellcaller('back');
  scaleEnemy(caller, 2);
  const hero = createAdventurer('hero', { ...GUDRUN_TEMPLATE, maxHp: 5000 }, 'front');
  const battle = createBattleState([hero], [caller]);
  return { caller, hero, battle };
}

describe('Hellcaller summoning', () => {
  it('calls an Imp on every 3rd turn, scaled to its room, with no drops', () => {
    const { caller, battle } = setup();
    resolveTurn(caller, battle, noVariance);
    resolveTurn(caller, battle, noVariance);
    expect(battle.enemies).toHaveLength(1);

    const result = resolveTurn(caller, battle, noVariance);
    expect(battle.enemies).toHaveLength(2);
    const imp = battle.enemies[1];
    expect(imp.name).toBe('Ember Imp');
    expect(imp.summonedBy).toBe(caller.id);
    expect(imp.maxHp).toBe(Math.round(EMBER_IMP_TEMPLATE.maxHp * 2));
    expect(imp.goldDrop).toBeUndefined();
    expect(imp.lootTable).toEqual([]);
    expect(result.events).toContainEqual(expect.objectContaining({ type: 'special-action', specialActionId: 'hellcaller-summon' }));
  });

  it('never has more than 2 of its Imps alive', () => {
    const { caller, battle } = setup();
    for (let turn = 0; turn < 12; turn++) resolveTurn(caller, battle, noVariance);
    expect(battle.enemies.filter((unit) => unit.summonedBy === caller.id && unit.hp > 0)).toHaveLength(2);
  });

  it('banishes its Imps the turn it falls', () => {
    const { caller, hero, battle } = setup();
    for (let turn = 0; turn < 3; turn++) resolveTurn(caller, battle, noVariance);
    const imp = battle.enemies.find((unit) => unit.summonedBy === caller.id)!;
    caller.hp = 1;
    hero.attackPower = 1000;
    // Hero targets the frontmost enemy; put the Hellcaller in front so the hero kills it.
    caller.position = { lane: hero.position.lane, rank: 0 };
    imp.position = { lane: (hero.position.lane + 1) % 3 as 0 | 1 | 2, rank: 1 };

    const result = resolveTurn(hero, battle, noVariance);
    expect(caller.hp).toBe(0);
    expect(imp.hp).toBe(0);
    expect(result.events).toContainEqual({ type: 'banish', unitIds: [imp.id] });
  });
});
