import { describe, it, expect } from 'vitest';
import { plainFaces } from './dieFace';
import { createAdventurer, type AdventurerTemplate } from './adventurer';
import { AttackLowestHpAction } from './actions/attack';
import { rollRoomLoot, ROOM_LOOT_DROP_CHANCE } from './loot';
import { createSeededRng } from './rng';
import type { Item, ItemLookup } from './items';

const SWORD: Item = { id: 'sword', name: 'Sword', slot: 'weapon', modifiers: [], price: 0 };
const RING: Item = { id: 'ring', name: 'Ring', slot: 'trinket', modifiers: [], price: 0 };
const SHIELD: Item = { id: 'shield', name: 'Shield', slot: 'armor', modifiers: [], price: 0 };

const ITEMS: Record<string, Item> = { sword: SWORD, ring: RING, shield: SHIELD };
const lookupItem: ItemLookup = (itemId) => ITEMS[itemId];

function enemyTemplate(overrides: Partial<AdventurerTemplate>): AdventurerTemplate {
  return {
    name: 'Enemy',
    maxHp: 10,
    attackPower: 1,
    speed: 1,
    actions: ['attack-lowest-hp'],
    dieFaces: plainFaces(AttackLowestHpAction),
    ...overrides,
  };
}

function defeatedEnemy(overrides: Partial<AdventurerTemplate>): ReturnType<typeof createAdventurer> {
  const enemy = createAdventurer(`enemy-${Math.random()}`, enemyTemplate(overrides), 'front');
  enemy.hp = 0;
  return enemy;
}

describe('rollRoomLoot', () => {
  it('rolls at most one item for the whole room, gated by ROOM_LOOT_DROP_CHANCE', () => {
    const enemies = [
      defeatedEnemy({ lootTable: [{ itemId: 'sword', dropChance: 1 }] }),
      defeatedEnemy({ lootTable: [{ itemId: 'ring', dropChance: 1 }] }),
      defeatedEnemy({ lootTable: [{ itemId: 'shield', dropChance: 1 }] }),
    ];

    // Try a spread of seeds: whenever a room drops anything, it's exactly one item.
    for (let seed = 1; seed <= 30; seed++) {
      const drops = rollRoomLoot(enemies, lookupItem, createSeededRng(seed));
      expect(drops.length).toBeLessThanOrEqual(1);
    }
  });

  it('is deterministic for a given seed', () => {
    const enemies = [defeatedEnemy({ lootTable: [{ itemId: 'sword', dropChance: 1 }] })];

    const first = rollRoomLoot(enemies, lookupItem, createSeededRng(42));
    const second = rollRoomLoot(enemies, lookupItem, createSeededRng(42));
    expect(second).toEqual(first);
  });

  it('drops nothing when the room-level roll misses, regardless of enemy count', () => {
    const enemies = [
      defeatedEnemy({ lootTable: [{ itemId: 'sword', dropChance: 1 }] }),
      defeatedEnemy({ lootTable: [{ itemId: 'ring', dropChance: 1 }] }),
    ];
    // Fixed rng always at-or-above the drop-chance threshold -> the room roll always misses.
    const missRng = () => ROOM_LOOT_DROP_CHANCE;

    expect(rollRoomLoot(enemies, lookupItem, missRng)).toEqual([]);
  });

  it('picks the dropped item weighted by its enemy table\'s relative dropChances', () => {
    const enemy = defeatedEnemy({
      lootTable: [
        { itemId: 'sword', dropChance: 3 },
        { itemId: 'ring', dropChance: 1 },
      ],
    });
    // Room roll hits (0 < ROOM_LOOT_DROP_CHANCE), enemy pick has only one candidate, then the
    // weighted item pick uses the third rng() call: 3/4 of the [0, totalWeight) range is sword.
    const hitsSword = rollRoomLoot([enemy], lookupItem, sequence([0, 0, 0.5]));
    expect(hitsSword).toEqual([SWORD]);

    const hitsRing = rollRoomLoot([enemy], lookupItem, sequence([0, 0, 0.9]));
    expect(hitsRing).toEqual([RING]);
  });

  it('rolls nothing when no enemy in the room has a loot table, or none were defeated', () => {
    const lootless = defeatedEnemy({});
    const survivor = createAdventurer('survivor', enemyTemplate({ lootTable: [{ itemId: 'sword', dropChance: 1 }] }), 'front');
    expect(survivor.hp).toBeGreaterThan(0); // still alive -> not "defeated", excluded regardless of roll

    const drops = rollRoomLoot([lootless, survivor], lookupItem, createSeededRng(1));
    expect(drops).toEqual([]);
  });
});

/** A deterministic RngSource that returns each value in `values` in order, then repeats the last one. */
function sequence(values: number[]) {
  let i = 0;
  return () => values[Math.min(i++, values.length - 1)];
}
