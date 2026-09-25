import { describe, it, expect } from 'vitest';
import { plainFaces } from './dieFace';
import { createAdventurer, type AdventurerTemplate } from './adventurer';
import { AttackNearestAction } from './actions/attack';
import { rollGold, rollRoomGold, sumGeneratedGold } from './gold';
import { mergeRunInventoryIntoTown, createTownStorage } from './townStorage';
import { createRunInventory } from './items';
import { createSeededRng } from './rng';
import type { RoomResult } from './room';

function enemyTemplate(overrides: Partial<AdventurerTemplate> = {}): AdventurerTemplate {
  return {
    name: 'Enemy',
    maxHp: 10,
    attackPower: 2,
    speed: 5,
    actions: ['attack-nearest'],
    dieFaces: plainFaces(AttackNearestAction),
    ...overrides,
  };
}

describe('rollGold / rollRoomGold', () => {
  it('rolls within [min, max] when the drop triggers, and 0 when it does not', () => {
    // A fake RNG we fully control: first call decides "did it trigger", second decides the amount.
    const triggeringRng = (() => {
      const values = [0.1, 0.5]; // 0.1 < chance(0.5) -> triggers; amount = 10 + 0.5*(20-10) = 15
      let i = 0;
      return () => values[i++];
    })();
    expect(rollGold({ chance: 0.5, min: 10, max: 20 }, triggeringRng)).toBe(15);

    const missingRng = () => 0.9; // 0.9 >= chance(0.5) -> never triggers, amount roll never even matters
    expect(rollGold({ chance: 0.5, min: 10, max: 20 }, missingRng)).toBe(0);
  });

  it('sums gold independently across every defeated enemy with a gold-drop table', () => {
    const alive = createAdventurer('alive', enemyTemplate({ goldDrop: { chance: 1, min: 5, max: 5 } }), 'front');
    // Not defeated -> no gold, even though it has a table.

    const defeatedWithGold = createAdventurer(
      'defeated-with-gold',
      enemyTemplate({ goldDrop: { chance: 1, min: 5, max: 5 } }),
      'front',
    );
    defeatedWithGold.hp = 0;

    const defeatedNoTable = createAdventurer('defeated-no-table', enemyTemplate(), 'front');
    defeatedNoTable.hp = 0;

    const total = rollRoomGold([alive, defeatedWithGold, defeatedNoTable], () => 0);

    expect(total).toBe(5); // only the defeated one with a table (and a guaranteed-trigger rng) contributes
  });

  it('accumulates correctly end to end: rolled gold merges into town gold via mergeRunInventoryIntoTown', () => {
    const enemy1 = createAdventurer('enemy1', enemyTemplate({ goldDrop: { chance: 1, min: 5, max: 5 } }), 'front');
    enemy1.hp = 0;
    const enemy2 = createAdventurer('enemy2', enemyTemplate({ goldDrop: { chance: 1, min: 8, max: 8 } }), 'front');
    enemy2.hp = 0;

    const rng = createSeededRng(42);
    const runInventory = createRunInventory();
    runInventory.gold += rollRoomGold([enemy1], rng);
    runInventory.gold += rollRoomGold([enemy2], rng);

    expect(runInventory.gold).toBe(13); // 5 + 8, deterministic since both tables always trigger

    const townStorage = createTownStorage();
    townStorage.gold = 100; // some gold already banked from an earlier run

    mergeRunInventoryIntoTown(runInventory, townStorage);

    expect(townStorage.gold).toBe(113);
    expect(runInventory.gold).toBe(0); // drained by the merge, just like items
  });
});

describe('sumGeneratedGold (Nerissa\'s Pickpocket Strike — roadmap item 11)', () => {
  it('sums every attack-and-gold outcome\'s goldGenerated across the whole room, ignoring other outcome types', () => {
    const result: RoomResult = {
      outcome: 'win',
      rounds: [
        {
          round: 1,
          turnOrder: ['nerissa', 'enemy'],
          turns: [
            {
              unitId: 'nerissa',
              turn: {
                rolledFaceIndex: 0,
                rolledActionId: 'pickpocket-strike',
                events: [
                  { type: 'action', actionId: 'pickpocket-strike', outcome: { type: 'attack-and-gold', damage: 3, hit: true, targetId: 'enemy', goldGenerated: 2 } },
                ],
              },
            },
            {
              unitId: 'enemy',
              turn: {
                rolledFaceIndex: 0,
                rolledActionId: 'attack-nearest',
                events: [
                  { type: 'action', actionId: 'attack-nearest', outcome: { type: 'attack', damage: 4, hit: true, targetId: 'nerissa' } },
                ],
              },
            },
          ],
        },
        {
          round: 2,
          turnOrder: ['nerissa'],
          turns: [
            {
              unitId: 'nerissa',
              turn: {
                rolledFaceIndex: 0,
                rolledActionId: 'pickpocket-strike',
                // A miss (hit: false) always generates 0 gold — see PickpocketStrikeAction.
                events: [
                  { type: 'action', actionId: 'pickpocket-strike', outcome: { type: 'attack-and-gold', damage: 0, hit: false, targetId: 'enemy', goldGenerated: 0 } },
                ],
              },
            },
          ],
        },
      ],
    };

    expect(sumGeneratedGold(result)).toBe(2);
  });

  it('returns 0 when nothing in the room ever generated gold', () => {
    const result: RoomResult = {
      outcome: 'loss',
      rounds: [
        {
          round: 1,
          turnOrder: ['adv'],
          turns: [
            {
              unitId: 'adv',
              turn: {
                rolledFaceIndex: 0,
                rolledActionId: 'attack-nearest',
                events: [{ type: 'action', actionId: 'attack-nearest', outcome: { type: 'attack', damage: 1, hit: true, targetId: 'enemy' } }],
              },
            },
          ],
        },
      ],
    };

    expect(sumGeneratedGold(result)).toBe(0);
  });
});
