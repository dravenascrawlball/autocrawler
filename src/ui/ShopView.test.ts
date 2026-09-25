// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest';
import { get } from 'svelte/store';
import { render, screen, fireEvent, within } from '@testing-library/svelte';
import ShopView from './ShopView.svelte';
import { townStorage } from '../state/townStorage';
import { roster } from '../state/roster';
import { createTownStorage } from '../sim/townStorage';
import { RUSTY_DAGGER_ITEM } from '../data/items';

describe('ShopView', () => {
  beforeEach(() => {
    roster.set({ adventurers: [], recruitedIds: [] });
  });

  it('disables every Buy button when gold is insufficient, enabling only affordable ones', () => {
    const storage = createTownStorage();
    storage.gold = RUSTY_DAGGER_ITEM.price; // affords only the cheapest tier
    townStorage.set(storage);

    render(ShopView);

    const daggerRow = screen.getByText(new RegExp(RUSTY_DAGGER_ITEM.name)).closest('li')!;
    expect(within(daggerRow).getByRole('button', { name: 'Buy' })).not.toBeDisabled();

    const expensiveRow = screen.getByText(/Sage's Charm/).closest('li')!;
    expect(within(expensiveRow).getByRole('button', { name: 'Buy' })).toBeDisabled();
  });

  it('buying an item deducts gold and moves it into town storage', async () => {
    const storage = createTownStorage();
    storage.gold = 100;
    townStorage.set(storage);

    render(ShopView);

    const daggerRow = screen.getByText(new RegExp(RUSTY_DAGGER_ITEM.name)).closest('li')!;
    await fireEvent.click(within(daggerRow).getByRole('button', { name: 'Buy' }));

    expect(get(townStorage).gold).toBe(100 - RUSTY_DAGGER_ITEM.price);
    expect(get(townStorage).items).toEqual([RUSTY_DAGGER_ITEM]);
  });
});
