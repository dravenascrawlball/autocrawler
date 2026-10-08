// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest';
import { get } from 'svelte/store';
import { render, screen, fireEvent, within } from '@testing-library/svelte';
import ShopView from './ShopView.svelte';
import { metaProgression } from '../state/metaProgression';
import { KIT_SHOP_CATALOG } from '../data/kitShop';

describe('ShopView', () => {
  beforeEach(() => {
    metaProgression.set({ renown: 0, unlockedKitIds: {} });
  });

  it('lists every Kit in the catalog, disabling Buy when Renown is insufficient', () => {
    const [entry] = KIT_SHOP_CATALOG;
    metaProgression.set({ renown: entry.price - 1, unlockedKitIds: {} });

    render(ShopView);

    const row = screen.getByText(entry.kit.name).closest('li')!;
    expect(within(row).getByRole('button', { name: /Buy/ })).toBeDisabled();
  });

  it('buying a Kit deducts Renown and marks it Owned', async () => {
    const [entry] = KIT_SHOP_CATALOG;
    metaProgression.set({ renown: entry.price, unlockedKitIds: {} });

    render(ShopView);

    const row = screen.getByText(entry.kit.name).closest('li')!;
    await fireEvent.click(within(row).getByRole('button', { name: /Buy/ }));

    expect(get(metaProgression).renown).toBe(0);
    expect(get(metaProgression).unlockedKitIds[entry.characterName]).toEqual([entry.kit.id]);
    expect(screen.getByText(entry.kit.name).closest('li')!.textContent).toContain('Owned');
  });
});
