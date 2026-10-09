import { describe, it, expect } from 'vitest';
import { createAdventurer } from './adventurer';
import { evaluateSynergies, applySynergies } from './synergies';
import { applyRelicScaling, type Relic } from './relics';
import { getEffectiveStat } from './stats';
import { SYNERGIES } from '../data/synergies';
import {
  GUDRUN_TEMPLATE,
  BODIL_TEMPLATE,
  GLINT_TEMPLATE,
  MIRKA_TEMPLATE,
  MIRA_TEMPLATE,
  DAWNETH_TEMPLATE,
  THARAVEL_TEMPLATE,
  CHARACTER_TEMPLATES,
} from '../data/characters';
import { THARAVEL_FIELD_MEDIC_KIT, BODIL_FUR_AND_FURY_KIT } from '../data/kits';
import { KIT_SHOP_CATALOG } from '../data/kitShop';

const fighters = () => [
  createAdventurer('gudrun', GUDRUN_TEMPLATE, 'front'),
  createAdventurer('bodil', BODIL_TEMPLATE, 'front'),
  createAdventurer('glint', GLINT_TEMPLATE, 'front'),
  createAdventurer('mirka', MIRKA_TEMPLATE, 'front'),
];

describe('role synergies', () => {
  it('reaches the highest tier its member count allows', () => {
    const party = fighters();
    const vanguard = (count: number) => evaluateSynergies(party.slice(0, count), SYNERGIES).find((s) => s.synergy.id === 'vanguard')!;
    const tiers = SYNERGIES.find((s) => s.id === 'vanguard')!.tiers;
    expect(vanguard(1).tier).toBeNull();
    expect(vanguard(2).tier).toBe(tiers[0]);
    expect(vanguard(4).tier).toBe(tiers.at(-1));
  });

  it('gives a members-only bonus to members, and re-applying replaces rather than stacks', () => {
    const party = [...fighters().slice(0, 2), createAdventurer('mira', MIRA_TEMPLATE, 'back')];
    applySynergies(party, SYNERGIES);
    applySynergies(party, SYNERGIES);

    const [gudrun, , mira] = party;
    const twoMember = SYNERGIES.find((s) => s.id === 'vanguard')!.tiers[0].amount;
    expect(getEffectiveStat(gudrun.maxHp, 'maxHp', gudrun.modifiers)).toBe(Math.round(gudrun.maxHp * (1 + twoMember / 100)));
    expect(gudrun.modifiers.filter((m) => m.source === 'synergy:vanguard')).toHaveLength(1);
    expect(mira.modifiers.some((m) => m.source.startsWith('synergy:'))).toBe(false);
  });

  it('gives a party-wide bonus to everyone', () => {
    const party = [
      createAdventurer('mira', MIRA_TEMPLATE, 'back'),
      createAdventurer('dawneth', DAWNETH_TEMPLATE, 'back'),
      createAdventurer('gudrun', GUDRUN_TEMPLATE, 'front'),
    ];
    applySynergies(party, SYNERGIES);
    expect(party[2].modifiers).toContainEqual(expect.objectContaining({ stat: 'healPower', source: 'synergy:menders' }));
  });
});

describe('scaling relics', () => {
  it('grows with rooms cleared and replaces the previous bonus', () => {
    const relic: Relic = {
      id: 'trophy',
      name: 'Trophy',
      description: '',
      modifiers: [],
      price: 0,
      scaling: { stat: 'attackPower', percentPerUnit: 3, per: 'room-cleared' },
    };
    const party = fighters().slice(0, 1);
    applyRelicScaling(party, [relic], 1);
    applyRelicScaling(party, [relic], 3);
    expect(party[0].modifiers.filter((m) => m.source === 'relic-scaling:trophy')).toEqual([
      expect.objectContaining({ amount: 9 }),
    ]);
  });
});

describe('Kits that swap synergy role', () => {
  it('Field Medic makes Tharavel count as a Healer, completing Menders with one real healer', () => {
    const tharavel = createAdventurer('tharavel', { ...THARAVEL_TEMPLATE, kitPool: [THARAVEL_FIELD_MEDIC_KIT] }, 'back');
    const mira = createAdventurer('mira', MIRA_TEMPLATE, 'back');
    expect(tharavel.role).toBe('Healer');
    const menders = evaluateSynergies([tharavel, mira], SYNERGIES).find((s) => s.synergy.id === 'menders');
    expect(menders?.tier).not.toBeNull();
  });

  it('a title-only Kit keeps the base role (Fur & Fury Bodil still counts for Vanguard)', () => {
    const bodil = createAdventurer('bodil', { ...BODIL_TEMPLATE, kitPool: [BODIL_FUR_AND_FURY_KIT] }, 'front');
    expect(bodil.role).toBe('Fighter');
    expect(bodil.activeKit?.title).toBe('Barbarian');
  });
});

describe('Kit catalog', () => {
  it('sells exactly one Kit for every character except Dee', () => {
    for (const template of CHARACTER_TEMPLATES) {
      const count = KIT_SHOP_CATALOG.filter((entry) => entry.characterName === template.name).length;
      expect(count).toBe(template.name === 'Dee' ? 0 : 1);
    }
  });
});
