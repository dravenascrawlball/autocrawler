import { describe, it, expect } from 'vitest';
import type { Kit } from './kits';
import { buyKit } from './shop';

const FURY_KIT: Kit = {
  id: 'fury-kit',
  name: 'Fury',
  description: 'test kit',
  modifiers: [],
  artKey: 'fury',
};

describe('buyKit', () => {
  it('deducts the price and records the unlock when affordable', () => {
    const wallet = { renown: 50 };
    const unlockedKitIds: Record<string, string[]> = {};

    const succeeded = buyKit('Gudrun', FURY_KIT, 40, wallet, unlockedKitIds);

    expect(succeeded).toBe(true);
    expect(wallet.renown).toBe(10);
    expect(unlockedKitIds.Gudrun).toEqual(['fury-kit']);
  });

  it('fails cleanly with no side effects when Renown is insufficient', () => {
    const wallet = { renown: 10 };
    const unlockedKitIds: Record<string, string[]> = {};

    const succeeded = buyKit('Gudrun', FURY_KIT, 40, wallet, unlockedKitIds);

    expect(succeeded).toBe(false);
    expect(wallet.renown).toBe(10);
    expect(unlockedKitIds.Gudrun).toBeUndefined();
  });

  it('fails cleanly when the character already owns this Kit, without double-charging', () => {
    const wallet = { renown: 100 };
    const unlockedKitIds: Record<string, string[]> = { Gudrun: ['fury-kit'] };

    const succeeded = buyKit('Gudrun', FURY_KIT, 40, wallet, unlockedKitIds);

    expect(succeeded).toBe(false);
    expect(wallet.renown).toBe(100);
    expect(unlockedKitIds.Gudrun).toEqual(['fury-kit']);
  });

  it('keeps each character\'s unlocked list independent', () => {
    const wallet = { renown: 100 };
    const unlockedKitIds: Record<string, string[]> = { Gudrun: ['fury-kit'] };

    buyKit('Nerissa', FURY_KIT, 40, wallet, unlockedKitIds);

    expect(unlockedKitIds.Gudrun).toEqual(['fury-kit']);
    expect(unlockedKitIds.Nerissa).toEqual(['fury-kit']);
  });
});
