import { describe, it, expect } from 'vitest';
import { plainFaces } from './dieFace';
import { createAdventurer, type AdventurerTemplate } from './adventurer';
import { AttackNearestAction, AttackLowestHpAction } from './actions/attack';
import { EmpowerAction } from './actions/support';
import { createBattleState } from './battle';
import { resolveRoom } from './room';
import {
  resolveUpgradeChoice,
  generateUpgradeOffers,
  xpToNextLevel,
  actionLevelPercentBonus,
  ACTION_LEVEL_PERCENT_PER_LEVEL,
} from './leveling';
import type { PassiveAbility } from './leveling';

function adventurerTemplate(overrides: Partial<AdventurerTemplate>): AdventurerTemplate {
  return {
    name: 'Adventurer',
    maxHp: 30,
    attackPower: 20,
    speed: 0,
    actions: ['attack-nearest'],
    dieFaces: plainFaces(AttackNearestAction),
    ...overrides,
  };
}

function enemyTemplate(overrides: Partial<AdventurerTemplate>): AdventurerTemplate {
  return {
    name: 'Enemy',
    maxHp: 25,
    attackPower: 10,
    speed: 0,
    actions: ['attack-lowest-hp'],
    dieFaces: plainFaces(AttackLowestHpAction),
    ...overrides,
  };
}

describe('post-room XP and leveling', () => {
  it('awards XP only to survivors, levels them up, and queues a resolvable upgrade choice', () => {

    // Tanky sluggers (high HP/damage, fastest) vs. a fragile healer-analog
    // (low HP, acts last) — the enemies target lowest HP, so they focus
    // the fragile one down before the sluggers finish them off.
    const adv1 = createAdventurer('adv1', adventurerTemplate({ speed: 30 }), 'front');
    const adv2 = createAdventurer('adv2', adventurerTemplate({ speed: 25 }), 'front');
    const fragile = createAdventurer('fragile', adventurerTemplate({ speed: 5, maxHp: 5 }), 'front');
    const enemy1 = createAdventurer('enemy1', enemyTemplate({ speed: 20, xpReward: 10 }), 'front');
    const enemy2 = createAdventurer('enemy2', enemyTemplate({ speed: 15, xpReward: 8 }), 'front');

    const battle = createBattleState([adv1, adv2, fragile], [enemy1, enemy2]);
    const result = resolveRoom(battle, () => 0.5);

    expect(result.outcome).toBe('win');
    // The fragile adventurer gets downed before the enemies die. adv1/adv2
    // take no combat damage (35 below is post-level-up max HP, not pre-XP).
    expect(fragile.hp).toBe(0);

    // Total XP = enemy1(10) + enemy2(8) = 18, split identically to both survivors,
    // crossing the level-1 threshold with some left over.
    const level1Threshold = xpToNextLevel(1);
    expect(level1Threshold).toBe(16);

    for (const survivor of [adv1, adv2]) {
      expect(survivor.level).toBe(2);
      expect(survivor.xp).toBe(18 - level1Threshold);
      expect(survivor.xpToNextLevel).toBe(xpToNextLevel(2));
      // Automatic level-up stat increase: +5 max HP, applied to current HP too.
      expect(survivor.maxHp).toBe(35);
      expect(survivor.hp).toBe(35);
      // One level crossed -> exactly one pending upgrade choice queued.
      expect(survivor.pendingUpgradeChoices).toHaveLength(1);
      expect(survivor.pendingUpgradeChoices[0].resolved).toBe(false);
      expect(survivor.pendingUpgradeChoices[0].level).toBe(2);
    }

    // The downed adventurer gets no XP and never levels up.
    expect(fragile.xp).toBe(0);
    expect(fragile.level).toBe(1);
    expect(fragile.pendingUpgradeChoices).toHaveLength(0);

    // Resolve adv1's pending choice as a player would: level up an action.
    const [choice] = adv1.pendingUpgradeChoices;
    resolveUpgradeChoice(adv1, choice, { type: 'action-level', actionId: 'attack-nearest' });

    expect(choice.resolved).toBe(true);
    expect(adv1.pendingUpgradeChoices).toHaveLength(0);
    expect(adv1.actionLevels['attack-nearest']).toBe(2);

    // adv2's choice is untouched — resolution is per-adventurer, per-choice.
    expect(adv2.pendingUpgradeChoices).toHaveLength(1);
    expect(adv2.actionLevels['attack-nearest']).toBeUndefined();

    // adv2 instead resolves their choice as a passive — its modifiers apply permanently.
    const passive: PassiveAbility = {
      id: 'vitality',
      name: 'Vitality',
      modifiers: [{ stat: 'maxHp', type: 'percent', amount: 10, source: 'passive:vitality' }],
    };
    resolveUpgradeChoice(adv2, adv2.pendingUpgradeChoices[0], { type: 'passive', passive });

    expect(adv2.pendingUpgradeChoices).toHaveLength(0);
    expect(adv2.passives).toEqual([passive]);
    expect(adv2.modifiers).toEqual(expect.arrayContaining(passive.modifiers));
  });
});

describe('resolveUpgradeChoice: new-face', () => {
  it('grants one more owned copy of the chosen action and immediately swaps it onto faceIndex', () => {
    const adv = createAdventurer('adv', adventurerTemplate({}), 'front');
    adv.pendingUpgradeChoices.push({ id: 'upgrade-test', level: 2, resolved: false });
    const [choice] = adv.pendingUpgradeChoices;

    resolveUpgradeChoice(adv, choice, { type: 'new-face', action: AttackLowestHpAction, faceIndex: 2 });

    expect(choice.resolved).toBe(true);
    expect(adv.ownedFaces).toContain(AttackLowestHpAction);
    expect(adv.ownedFaces.filter((a) => a === AttackLowestHpAction)).toHaveLength(1);
    expect(adv.dieFaces[2].action).toBe(AttackLowestHpAction);
  });

  it('clears any enchantment previously on the overwritten slot (a fresh face token)', () => {
    const adv = createAdventurer('adv', adventurerTemplate({}), 'front');
    adv.dieFaces[2] = { action: AttackNearestAction, enchantmentId: 'burning' };
    adv.pendingUpgradeChoices.push({ id: 'upgrade-test', level: 2, resolved: false });
    const [choice] = adv.pendingUpgradeChoices;

    resolveUpgradeChoice(adv, choice, { type: 'new-face', action: AttackLowestHpAction, faceIndex: 2 });

    expect(adv.dieFaces[2]).toEqual({ action: AttackLowestHpAction });
  });
});

describe('actionLevelPercentBonus', () => {
  it('is 0 at level 1 (the default) and scales by ACTION_LEVEL_PERCENT_PER_LEVEL per level beyond that', () => {
    const adv = createAdventurer('adv', adventurerTemplate({}), 'front');

    expect(actionLevelPercentBonus(adv, 'attack-nearest')).toBe(0);

    adv.actionLevels['attack-nearest'] = 3;
    expect(actionLevelPercentBonus(adv, 'attack-nearest')).toBe(2 * ACTION_LEVEL_PERCENT_PER_LEVEL);

    // A different action's level is independent.
    expect(actionLevelPercentBonus(adv, 'heal')).toBe(0);
  });
});

describe('generateUpgradeOffers', () => {
  const vitalityPassive: PassiveAbility = {
    id: 'vitality',
    name: 'Vitality',
    modifiers: [{ stat: 'maxHp', type: 'percent', amount: 10, source: 'passive:vitality' }],
  };
  const secondWindPassive: PassiveAbility = {
    id: 'second-wind',
    name: 'Second Wind',
    modifiers: [{ stat: 'interRoomHeal', type: 'flat', amount: 3, source: 'passive:second-wind' }],
  };

  it('draws from a unified pool: action-level (excluding unlevelable actions), new-Face, and passive candidates', () => {
    const adv = createAdventurer(
      'adv',
      adventurerTemplate({ bonusFaces: [EmpowerAction] }), // dieFaces: 6x AttackNearestAction; owns Empower too, unslotted
      'front',
    );

    const offers = generateUpgradeOffers(adv, [vitalityPassive], () => 0.5, 10);

    // AttackNearestAction: action-level + new-face. EmpowerAction: new-face only (excluded from
    // action-level, see ACTIONS_WITHOUT_LEVEL_SCALING). Plus the one passive. 4 total.
    expect(offers).toHaveLength(4);
    expect(offers.some((o) => o.type === 'action-level' && o.action === AttackNearestAction)).toBe(true);
    expect(offers.some((o) => o.type === 'new-face' && o.action === AttackNearestAction)).toBe(true);
    expect(offers.some((o) => o.type === 'new-face' && o.action === EmpowerAction)).toBe(true);
    expect(offers.some((o) => o.type === 'action-level' && o.action === EmpowerAction)).toBe(false);
    expect(offers.some((o) => o.type === 'passive' && o.passive === vitalityPassive)).toBe(true);
  });

  it('shrinks gracefully when the combined pool has fewer than `count` candidates', () => {
    const adv = createAdventurer('adv', adventurerTemplate({}), 'front'); // one owned action, no passives offered

    const offers = generateUpgradeOffers(adv, [], () => 0.5, 10);

    expect(offers).toHaveLength(2); // AttackNearestAction: action-level + new-face
  });

  it('offers a passive again even if the adventurer already has it (stacking allowed)', () => {
    const adv = createAdventurer('adv', adventurerTemplate({}), 'front');
    adv.passives.push(vitalityPassive);
    adv.modifiers = [...vitalityPassive.modifiers];

    const offers = generateUpgradeOffers(adv, [vitalityPassive], () => 0.5, 10);

    expect(offers.some((o) => o.type === 'passive' && o.passive === vitalityPassive)).toBe(true);
  });

  it('previews an action-level offer as a flat percentage, not an exact number (RNG/crit makes exact dishonest)', () => {
    const adv = createAdventurer('adv', adventurerTemplate({}), 'front');

    const [offer] = generateUpgradeOffers(adv, [], () => 0.5, 10).filter((o) => o.type === 'action-level');

    expect(offer.preview).toEqual({ label: AttackNearestAction.name, beforeAfter: `+${ACTION_LEVEL_PERCENT_PER_LEVEL}% damage` });
  });

  it('previews a new-Face offer as an exact owned-copy count before/after', () => {
    // AttackLowestHpAction is owned once (a bonus Face, never slotted) — distinct from
    // AttackNearestAction's 6 slotted copies, so "1 owned" is unambiguous here.
    const adv = createAdventurer('adv', adventurerTemplate({ bonusFaces: [AttackLowestHpAction] }), 'front');

    const [offer] = generateUpgradeOffers(adv, [], () => 0.5, 10).filter(
      (o) => o.type === 'new-face' && o.action === AttackLowestHpAction,
    );

    expect(offer.preview.beforeAfter).toBe('1 owned -> 2 owned');
  });

  it('previews a passive targeting a readable stat as an exact before/after number', () => {
    const adv = createAdventurer('adv', adventurerTemplate({ maxHp: 30 }), 'front');

    const [offer] = generateUpgradeOffers(adv, [vitalityPassive], () => 0.5, 10).filter((o) => o.type === 'passive');

    expect(offer.preview).toEqual({ label: 'Vitality', beforeAfter: 'maxHp: 30 -> 33' });
  });

  it('falls back to a plain delta for a passive targeting a stat with no readable base on Adventurer', () => {
    const adv = createAdventurer('adv', adventurerTemplate({}), 'front');

    const [offer] = generateUpgradeOffers(adv, [secondWindPassive], () => 0.5, 10).filter((o) => o.type === 'passive');

    expect(offer.preview).toEqual({ label: 'Second Wind', beforeAfter: 'interRoomHeal: +3' });
  });
});
