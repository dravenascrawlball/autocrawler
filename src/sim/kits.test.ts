import { describe, it, expect } from 'vitest';
import { plainFaces } from './dieFace';
import { createAdventurer, resetToTemplateBaseline, type AdventurerTemplate } from './adventurer';
import { AttackNearestAction } from './actions/attack';
import { getEffectiveStat } from './stats';
import type { Kit } from './kits';
import { pickKit, applyKit, displayTitle, artKeyFor } from './kits';

function template(overrides: Partial<AdventurerTemplate> = {}): AdventurerTemplate {
  return {
    name: 'Unit',
    role: 'Fighter',
    maxHp: 20,
    attackPower: 5,
    speed: 5,
    actions: ['attack-nearest'],
    dieFaces: plainFaces(AttackNearestAction),
    ...overrides,
  };
}

const WARREN_SCOUT: Kit = {
  id: 'warren-scout',
  name: 'Warren Scout',
  description: 'A bunny-themed alternate costume.',
  modifiers: [{ stat: 'speed', type: 'flat', amount: 2, source: 'kit:warren-scout' }],
  tags: ['bunny'],
  artKey: 'unit-warren-scout',
  synergyRole: 'Scout',
};

describe('pickKit', () => {
  it('returns null for an empty pool', () => {
    expect(pickKit([], () => 0.5)).toBeNull();
  });

  it('always resolves to the only entry in a single-Kit pool regardless of rng', () => {
    expect(pickKit([WARREN_SCOUT], () => 0)).toBe(WARREN_SCOUT);
    expect(pickKit([WARREN_SCOUT], () => 0.999)).toBe(WARREN_SCOUT);
  });
});

describe('createAdventurer with a kitPool', () => {
  it('has no activeKit and is unaffected when kitPool is omitted', () => {
    const unit = createAdventurer('unit', template(), 'front');
    expect(unit.activeKit).toBeUndefined();
    expect(unit.role).toBe('Fighter');
    expect(unit.tags).toEqual([]);
  });

  it('applies the drawn Kit\'s modifiers, tags, and role override', () => {
    const unit = createAdventurer('unit', template({ kitPool: [WARREN_SCOUT] }), 'front');

    expect(unit.activeKit).toBe(WARREN_SCOUT);
    expect(unit.role).toBe('Scout');
    expect(unit.tags).toEqual(['bunny']);
    expect(getEffectiveStat(unit.speed, 'speed', unit.modifiers)).toBe(unit.speed + 2);
  });

  it('is additive with the template\'s own innate tags, not a replacement', () => {
    const unit = createAdventurer('unit', template({ kitPool: [WARREN_SCOUT], tags: ['elf'] }), 'front');
    expect(unit.tags).toEqual(['elf', 'bunny']);
  });

  it('rerolls on resetToTemplateBaseline, same lifecycle as Special Action', () => {
    const tpl = template({ kitPool: [WARREN_SCOUT] });
    const unit = createAdventurer('unit', tpl, 'front');
    unit.activeKit = undefined;
    unit.tags = [];
    unit.role = 'Fighter';

    resetToTemplateBaseline(unit, tpl);

    expect(unit.activeKit).toBe(WARREN_SCOUT);
    expect(unit.role).toBe('Scout');
    expect(unit.tags).toEqual(['bunny']);
  });
});

const PACK_BRAWLER: Kit = {
  id: 'pack-brawler',
  name: 'Pack Brawler',
  description: 'A scrappier alternate costume.',
  modifiers: [{ stat: 'attackPower', type: 'flat', amount: 3, source: 'kit:pack-brawler' }],
  tags: ['tank'],
  artKey: 'unit-pack-brawler',
};

describe('applyKit', () => {
  it('applies a Kit onto an adventurer with no previous Kit', () => {
    const tpl = template();
    const unit = createAdventurer('unit', tpl, 'front');

    applyKit(unit, tpl, WARREN_SCOUT);

    expect(unit.activeKit).toBe(WARREN_SCOUT);
    expect(unit.role).toBe('Scout');
    expect(unit.tags).toEqual(['bunny']);
    expect(getEffectiveStat(unit.speed, 'speed', unit.modifiers)).toBe(unit.speed + 2);
  });

  it('swaps cleanly from one Kit to another, leaving no trace of the previous one', () => {
    const tpl = template({ kitPool: [WARREN_SCOUT] });
    const unit = createAdventurer('unit', tpl, 'front'); // starts on WARREN_SCOUT (only pool entry)

    applyKit(unit, tpl, PACK_BRAWLER);

    expect(unit.activeKit).toBe(PACK_BRAWLER);
    expect(unit.tags).toEqual(['tank']);
    expect(getEffectiveStat(unit.speed, 'speed', unit.modifiers)).toBe(unit.speed); // Warren Scout's +2 is gone
    expect(getEffectiveStat(unit.attackPower, 'attackPower', unit.modifiers)).toBe(unit.attackPower + 3);
  });

  it("falls back to the template's own role when the new Kit doesn't override one", () => {
    const tpl = template({ role: 'Fighter', kitPool: [WARREN_SCOUT] });
    const unit = createAdventurer('unit', tpl, 'front'); // starts on Scout

    const noRoleKit: Kit = { ...PACK_BRAWLER, synergyRole: undefined };
    applyKit(unit, tpl, noRoleKit);

    expect(unit.role).toBe('Fighter');
  });
});

describe('Kit title vs synergy role', () => {
  it("a title-only Kit changes the displayed title but keeps the character's role for synergies", () => {
    const tpl = template({ role: 'Fighter' });
    const unit = createAdventurer('unit', tpl, 'front');
    applyKit(unit, tpl, { id: 'fur', name: 'Fur & Fury', description: '', modifiers: [], artKey: 'unit-fur', title: 'Barbarian' });

    expect(unit.role).toBe('Fighter');
    expect(displayTitle(unit)).toBe('Barbarian');
    expect(artKeyFor(unit)).toBe('unit-fur');
  });
});

