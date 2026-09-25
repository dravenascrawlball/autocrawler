import { describe, it, expect, beforeEach } from 'vitest';
import { plainFaces } from '../sim/dieFace';
import { get } from 'svelte/store';
import { roster } from './roster';
import { dungeonPlayback, type DungeonPlaybackState } from './dungeonPlayback';
import { currentLevelUpOffers } from './levelUpOffers';
import { resolvePendingUpgrade, rollOffersForChoice, resolveOffer } from './leveling';
import { createAdventurer, type AdventurerTemplate } from '../sim/adventurer';
import { AttackNearestAction, AttackLowestHpAction } from '../sim/actions/attack';
import type { PassiveAbility, UpgradeChoice, UpgradeOffer } from '../sim/leveling';

function template(overrides: Partial<AdventurerTemplate> = {}): AdventurerTemplate {
  return {
    name: 'Adventurer',
    maxHp: 20,
    attackPower: 5,
    speed: 5,
    actions: ['attack-nearest'],
    dieFaces: plainFaces(AttackNearestAction),
    ...overrides,
  };
}

function pendingChoice(level = 2): UpgradeChoice {
  return { id: `upgrade-${level}`, level, resolved: false };
}

describe('resolvePendingUpgrade', () => {
  beforeEach(() => {
    roster.set({ adventurers: [], recruitedIds: [] });
    dungeonPlayback.set(null);
  });

  it('resolves an action-level choice and touches the roster store', () => {
    const hero = createAdventurer('hero', template(), 'front');
    hero.pendingUpgradeChoices.push(pendingChoice());
    roster.set({ adventurers: [hero], recruitedIds: [] });

    const [choice] = hero.pendingUpgradeChoices;
    const succeeded = resolvePendingUpgrade('hero', choice, { type: 'action-level', actionId: 'attack-nearest' });

    expect(succeeded).toBe(true);
    expect(get(roster).adventurers[0].actionLevels['attack-nearest']).toBe(2);
    expect(get(roster).adventurers[0].pendingUpgradeChoices).toHaveLength(0);
  });

  it('resolves a passive choice, granting its modifiers permanently', () => {
    const hero = createAdventurer('hero', template(), 'front');
    hero.pendingUpgradeChoices.push(pendingChoice());
    roster.set({ adventurers: [hero], recruitedIds: [] });

    const passive: PassiveAbility = {
      id: 'vitality',
      name: 'Vitality',
      modifiers: [{ stat: 'maxHp', type: 'percent', amount: 10, source: 'passive:vitality' }],
    };
    const [choice] = hero.pendingUpgradeChoices;
    const succeeded = resolvePendingUpgrade('hero', choice, { type: 'passive', passive });

    expect(succeeded).toBe(true);
    expect(get(roster).adventurers[0].passives).toEqual([passive]);
    expect(get(roster).adventurers[0].modifiers).toEqual(expect.arrayContaining(passive.modifiers));
  });

  it('returns false for an unknown adventurer', () => {
    expect(resolvePendingUpgrade('nonexistent', pendingChoice(), { type: 'action-level', actionId: 'attack-nearest' })).toBe(
      false,
    );
  });

  it('returns false for a choice not actually pending on that adventurer', () => {
    const hero = createAdventurer('hero', template(), 'front');
    roster.set({ adventurers: [hero], recruitedIds: [] });

    const succeeded = resolvePendingUpgrade('hero', pendingChoice(), { type: 'action-level', actionId: 'attack-nearest' });

    expect(succeeded).toBe(false);
  });

  it('also works mid-run, since a run\'s party holds the same Adventurer references as the roster', () => {
    const hero = createAdventurer('hero', template(), 'front');
    hero.pendingUpgradeChoices.push(pendingChoice());
    roster.set({ adventurers: [hero], recruitedIds: [] });

    const playback = {
      runState: { party: [hero] },
    } as unknown as DungeonPlaybackState;
    dungeonPlayback.set(playback);

    const [choice] = hero.pendingUpgradeChoices;
    resolvePendingUpgrade('hero', choice, { type: 'action-level', actionId: 'attack-nearest' });

    expect(get(dungeonPlayback)?.runState.party[0].actionLevels['attack-nearest']).toBe(2);
  });
});

describe('rollOffersForChoice / resolveOffer', () => {
  beforeEach(() => {
    roster.set({ adventurers: [], recruitedIds: [] });
    dungeonPlayback.set(null);
    currentLevelUpOffers.set(null);
  });

  it('rolls 3 offers', () => {
    const hero = createAdventurer('hero', template({ bonusFaces: [AttackLowestHpAction] }), 'front');
    hero.pendingUpgradeChoices.push(pendingChoice());
    roster.set({ adventurers: [hero], recruitedIds: [] });
    const [choice] = hero.pendingUpgradeChoices;

    const offers = rollOffersForChoice('hero', choice);

    expect(offers).toHaveLength(3);
  });

  it('returns null for an unknown adventurer, without caching anything', () => {
    expect(rollOffersForChoice('nonexistent', pendingChoice())).toBeNull();
    expect(get(currentLevelUpOffers)).toBeNull();
  });

  it('caches the roll for a given choiceId instead of re-rolling on every call', () => {
    const hero = createAdventurer('hero', template({ bonusFaces: [AttackLowestHpAction] }), 'front');
    hero.pendingUpgradeChoices.push(pendingChoice());
    roster.set({ adventurers: [hero], recruitedIds: [] });
    const [choice] = hero.pendingUpgradeChoices;

    const first = rollOffersForChoice('hero', choice, () => 0.1);
    const second = rollOffersForChoice('hero', choice, () => 0.9); // different rng, same choice
    expect(second).toBe(first); // same array reference — no re-roll happened

    const otherChoice = pendingChoice(3);
    hero.pendingUpgradeChoices.push(otherChoice);
    const third = rollOffersForChoice('hero', otherChoice, () => 0.9);
    expect(third).not.toBe(first); // a different choice rolls fresh
  });

  it('resolveOffer resolves an action-level offer directly and clears the cached offers', () => {
    const hero = createAdventurer('hero', template(), 'front');
    hero.pendingUpgradeChoices.push(pendingChoice());
    roster.set({ adventurers: [hero], recruitedIds: [] });
    const [choice] = hero.pendingUpgradeChoices;
    // Construct the offer directly rather than relying on the random 3-draw to include this
    // type — the roll's own composition is already covered by sim/leveling.test.ts.
    const actionLevelOffer: UpgradeOffer = {
      type: 'action-level',
      action: AttackNearestAction,
      preview: { label: AttackNearestAction.name, beforeAfter: '+15% damage' },
    };
    currentLevelUpOffers.set({ choiceId: choice.id, offers: [actionLevelOffer] });

    const succeeded = resolveOffer('hero', choice, actionLevelOffer);

    expect(succeeded).toBe(true);
    expect(get(roster).adventurers[0].actionLevels['attack-nearest']).toBe(2);
    expect(get(currentLevelUpOffers)).toBeNull();
  });

  it('resolveOffer requires a faceIndex for a new-face offer and applies the swap when given one', () => {
    const hero = createAdventurer('hero', template(), 'front');
    hero.pendingUpgradeChoices.push(pendingChoice());
    roster.set({ adventurers: [hero], recruitedIds: [] });
    const [choice] = hero.pendingUpgradeChoices;
    const newFaceOffer: UpgradeOffer = {
      type: 'new-face',
      action: AttackLowestHpAction,
      preview: { label: AttackLowestHpAction.name, beforeAfter: '0 owned -> 1 owned' },
    };

    expect(resolveOffer('hero', choice, newFaceOffer)).toBe(false); // no faceIndex — refuses

    const succeeded = resolveOffer('hero', choice, newFaceOffer, 0);

    expect(succeeded).toBe(true);
    expect(get(roster).adventurers[0].dieFaces[0].action).toBe(AttackLowestHpAction);
  });
});
