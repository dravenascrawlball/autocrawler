import { describe, it, expect } from 'vitest';
import { plainFaces } from './dieFace';
import { createAdventurer, resetToTemplateBaseline, type AdventurerTemplate } from './adventurer';
import { AttackNearestAction } from './actions/attack';
import { EmpowerAction } from './actions/support';
import type { Item } from './items';
import type { SpecialAction } from './specialActions';
import type { Trait } from './traits';

function template(overrides: Partial<AdventurerTemplate> = {}): AdventurerTemplate {
  return {
    name: 'Fenwick',
    role: 'Fighter',
    maxHp: 20,
    attackPower: 5,
    speed: 5,
    actions: ['attack-nearest'],
    dieFaces: plainFaces(AttackNearestAction),
    ...overrides,
  };
}

describe('resetToTemplateBaseline', () => {
  it('clears level/action-levels/run-scoped stats back to a fresh instance', () => {
    const adventurer = createAdventurer('hero', template(), 'front');
    adventurer.level = 5;
    adventurer.actionLevels = { 'attack-nearest': 3 };
    adventurer.hp = 1;
    adventurer.runDamageDealt = 40;
    adventurer.runDamageTaken = 30;
    adventurer.runHealingDone = 10;
    adventurer.downedSummary = {
      roomIndex: 0,
      killerArchetype: 'Grunt',
      damageDone: 0,
      damageTaken: 5,
      healed: 0,
      acknowledged: true,
    };

    resetToTemplateBaseline(adventurer, template());

    expect(adventurer.level).toBe(1);
    expect(adventurer.actionLevels).toEqual({});
    expect(adventurer.hp).toBe(adventurer.maxHp);
    expect(adventurer.runDamageDealt).toBe(0);
    expect(adventurer.runDamageTaken).toBe(0);
    expect(adventurer.runHealingDone).toBe(0);
    expect(adventurer.downedSummary).toBeUndefined();
  });

  it('clears equipment and its stat modifiers (Town Storage Cleanup: equipment is run-scoped now)', () => {
    const adventurer = createAdventurer('hero', template(), 'front');
    const sword: Item = {
      id: 'sword',
      name: 'Sword',
      slot: 'weapon',
      modifiers: [{ stat: 'attackPower', type: 'flat', amount: 10, source: 'item:sword' }],
      price: 25,
    };
    adventurer.equipment.weapon = sword;
    adventurer.modifiers = [...sword.modifiers];

    resetToTemplateBaseline(adventurer, template());

    expect(adventurer.equipment.weapon).toBeNull();
    expect(adventurer.modifiers).toEqual([]);
  });

  it("clears an equipped item's grantedSpecialAction along with the equipment itself", () => {
    const adventurer = createAdventurer('hero', template(), 'front');
    const ringSpecial: SpecialAction = { id: 'test-ring-special', name: 'Test Ring Special', trigger: 'on-hit-landed', action: EmpowerAction };
    const ring: Item = {
      id: 'ring-of-embers',
      name: 'Ring of Embers',
      slot: 'trinket',
      modifiers: [],
      price: 0,
      grantedSpecialAction: ringSpecial,
    };
    adventurer.equipment.trinket = ring;
    adventurer.activeSpecialActions = [ringSpecial]; // as if equipItem had already applied it

    resetToTemplateBaseline(adventurer, template());

    expect(adventurer.activeSpecialActions).toEqual([]);
  });

  it('preserves the row the player last assigned', () => {
    const adventurer = createAdventurer('hero', template(), 'back');

    resetToTemplateBaseline(adventurer, template());

    expect(adventurer.position).toEqual({ lane: 1, rank: 2 });
  });

  it('merges unlockedPoolEntries into the template pool and can re-roll into one of them (meta-progression)', () => {
    const unlockedSpecial: SpecialAction = { id: 'unlocked-special', name: 'Unlocked Special', trigger: 'on-turn-start', action: EmpowerAction };
    const adventurer = createAdventurer('hero', template(), 'front');

    resetToTemplateBaseline(adventurer, template(), [{ kind: 'special-action', specialAction: unlockedSpecial }], [], () => 0.99);

    expect(adventurer.activeSpecialActions).toEqual([unlockedSpecial]);
  });
});

describe('createAdventurer with a universal trait pool', () => {
  const HARDY: Trait = { id: 'hardy', name: 'Hardy', description: 'test fixture' };
  const LUCKY: Trait = { id: 'lucky', name: 'Lucky', description: 'test fixture' };
  const GRIZZLED: Trait = { id: 'grizzled', name: 'Grizzled', description: 'test fixture' };
  const POOL = [HARDY, LUCKY, GRIZZLED];

  it('has no universal traits when the pool is omitted, matching prior behavior', () => {
    const adventurer = createAdventurer('hero', template(), 'front');
    expect(adventurer.traits).toEqual([]);
  });

  it('rolls up to UNIVERSAL_TRAIT_ROLL_CAP distinct traits from the pool', () => {
    const adventurer = createAdventurer('hero', template(), 'front', [], [], POOL, () => 0);
    expect(adventurer.traits).toHaveLength(2);
    expect(new Set(adventurer.traits.map((t) => t.id)).size).toBe(2);
  });

  it('is additive with the template\'s own seeded traits, not a replacement', () => {
    const seeded: Trait = { id: 'seeded', name: 'Seeded', description: 'always present' };
    const adventurer = createAdventurer('hero', template({ traits: [seeded] }), 'front', [], [], POOL, () => 0);
    expect(adventurer.traits).toContainEqual(seeded);
    expect(adventurer.traits.length).toBe(1 + 2);
  });

  it('rerolls on resetToTemplateBaseline, same lifecycle as Special Action/Kit', () => {
    const tpl = template();
    const adventurer = createAdventurer('hero', tpl, 'front', [], [], POOL, () => 0);
    adventurer.traits = [];

    resetToTemplateBaseline(adventurer, tpl, [], POOL, () => 0);

    expect(adventurer.traits).toHaveLength(2);
  });
});

describe('createAdventurer with unlockedPoolEntries', () => {
  it('draws from the template pool plus unlocked entries, picked via the injected rng', () => {
    const baseSpecial: SpecialAction = { id: 'base-special', name: 'Base Special', trigger: 'on-turn-start', action: EmpowerAction };
    const unlockedSpecial: SpecialAction = { id: 'unlocked-special', name: 'Unlocked Special', trigger: 'on-turn-start', action: EmpowerAction };
    const withPool = template({
      specialActionPool: [{ kind: 'special-action', specialAction: baseSpecial }],
    });

    const pickedBase = createAdventurer('a', withPool, 'front', [], [{ kind: 'special-action', specialAction: unlockedSpecial }], [], () => 0);
    expect(pickedBase.activeSpecialActions).toEqual([baseSpecial]);

    const pickedUnlocked = createAdventurer('b', withPool, 'front', [], [{ kind: 'special-action', specialAction: unlockedSpecial }], [], () => 0.99);
    expect(pickedUnlocked.activeSpecialActions).toEqual([unlockedSpecial]);
  });

  it('defaults to no unlocked entries, matching prior behavior', () => {
    const baseSpecial: SpecialAction = { id: 'base-special', name: 'Base Special', trigger: 'on-turn-start', action: EmpowerAction };
    const withPool = template({ specialActionPool: [{ kind: 'special-action', specialAction: baseSpecial }] });

    const adventurer = createAdventurer('a', withPool, 'front');
    expect(adventurer.activeSpecialActions).toEqual([baseSpecial]);
  });
});
