import { describe, it, expect } from 'vitest';
import { plainFaces } from './dieFace';
import { createAdventurer, resetToTemplateBaseline, type AdventurerTemplate } from './adventurer';
import { AttackNearestAction, PowerAttackAction } from './actions/attack';
import type { Item } from './items';

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
  it('clears level/XP/action-levels/passives/run-scoped stats back to a fresh instance', () => {
    const adventurer = createAdventurer('hero', template(), 'front');
    adventurer.xp = 500;
    adventurer.level = 5;
    adventurer.pendingUpgradeChoices = [{ id: 'upgrade-1', level: 5, resolved: false }];
    adventurer.actionLevels = { 'attack-nearest': 3 };
    adventurer.passives = [{ id: 'some-passive', name: 'Some Passive', modifiers: [] }];
    adventurer.hp = 1;
    adventurer.runDamageDealt = 40;
    adventurer.runDamageTaken = 30;
    adventurer.runHealingDone = 10;
    adventurer.downedSummary = {
      roomIndex: 0,
      killerArchetype: 'Grunt',
      xpGained: 0,
      damageDone: 0,
      damageTaken: 5,
      healed: 0,
      acknowledged: true,
    };

    resetToTemplateBaseline(adventurer, template());

    expect(adventurer.level).toBe(1);
    expect(adventurer.xp).toBe(0);
    expect(adventurer.pendingUpgradeChoices).toEqual([]);
    expect(adventurer.actionLevels).toEqual({});
    expect(adventurer.passives).toEqual([]);
    expect(adventurer.hp).toBe(adventurer.maxHp);
    expect(adventurer.runDamageDealt).toBe(0);
    expect(adventurer.runDamageTaken).toBe(0);
    expect(adventurer.runHealingDone).toBe(0);
    expect(adventurer.downedSummary).toBeUndefined();
  });

  it('preserves equipment and re-applies its stat modifiers', () => {
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

    expect(adventurer.equipment.weapon).toBe(sword);
    expect(adventurer.modifiers).toEqual(sword.modifiers);
  });

  it('re-applies an equipped item\'s faceEffect against the fresh baseline (roadmap item 13)', () => {
    const adventurer = createAdventurer('hero', template(), 'front'); // all 6 faces start as Attack Nearest
    const tome: Item = {
      id: 'tome-of-power',
      name: 'Tome of Power',
      slot: 'trinket',
      modifiers: [],
      price: 0,
      faceEffect: { faceIndex: 2, effect: { kind: 'replace-action', action: PowerAttackAction } },
    };
    adventurer.equipment.trinket = tome;
    adventurer.dieFaces[2] = { action: PowerAttackAction }; // as if equipItem had already applied it
    tome.faceEffect!.previousFace = { action: AttackNearestAction };

    resetToTemplateBaseline(adventurer, template());

    // The rebuild put Attack Nearest back on every face, then the faceEffect re-applied Power
    // Attack on top of that fresh baseline — the snapshot reflects the rebuild, not stale state.
    expect(adventurer.dieFaces[2].action).toBe(PowerAttackAction);
    expect(adventurer.equipment.trinket?.faceEffect?.previousFace).toEqual({ action: AttackNearestAction });
  });

  it('preserves the row the player last assigned', () => {
    const adventurer = createAdventurer('hero', template(), 'back');

    resetToTemplateBaseline(adventurer, template());

    expect(adventurer.row).toBe('back');
  });
});
