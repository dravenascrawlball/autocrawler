import { describe, it, expect } from 'vitest';
import { rollItemInstance, type Item } from './items';
import { PowerAttackAction } from './actions/attack';

const PLAIN_ITEM: Item = { id: 'sword', name: 'Sword', slot: 'weapon', modifiers: [], price: 0 };
const MAGIC_ITEM: Item = {
  id: 'tome-of-power',
  name: 'Tome of Power',
  slot: 'trinket',
  modifiers: [],
  price: 0,
  faceEffect: { faceIndex: 0, effect: { kind: 'replace-action', action: PowerAttackAction } },
};

describe('rollItemInstance', () => {
  it('is a no-op passthrough for an item without a faceEffect', () => {
    const rolled = rollItemInstance(PLAIN_ITEM, () => 0.5);
    expect(rolled).toBe(PLAIN_ITEM);
  });

  it('returns a fresh copy with a freshly rolled faceIndex for an item with a faceEffect', () => {
    const rolled = rollItemInstance(MAGIC_ITEM, () => 0.99);

    expect(rolled).not.toBe(MAGIC_ITEM); // a distinct instance, not the shared definition
    expect(rolled.faceEffect).not.toBe(MAGIC_ITEM.faceEffect);
    expect(rolled.faceEffect?.faceIndex).toBe(5); // floor(0.99 * 6)
    expect(rolled.faceEffect?.effect).toEqual(MAGIC_ITEM.faceEffect?.effect);
  });

  it('rolls a faceIndex in [0, 6) across the rng range', () => {
    for (const rngValue of [0, 0.1, 0.5, 0.9, 0.999999]) {
      const rolled = rollItemInstance(MAGIC_ITEM, () => rngValue);
      expect(rolled.faceEffect?.faceIndex).toBeGreaterThanOrEqual(0);
      expect(rolled.faceEffect?.faceIndex).toBeLessThan(6);
    }
  });

  it('does not mutate the original item', () => {
    rollItemInstance(MAGIC_ITEM, () => 0.99);
    expect(MAGIC_ITEM.faceEffect?.faceIndex).toBe(0);
  });
});
