// @vitest-environment jsdom
import { plainFaces } from '../sim/dieFace';
import { describe, it, expect, beforeEach } from 'vitest';
import { get } from 'svelte/store';
import { render, screen, fireEvent } from '@testing-library/svelte';
import LootModal from './LootModal.svelte';
import { roster } from '../state/roster';
import { dungeonPlayback, type DungeonPlaybackState } from '../state/dungeonPlayback';
import { createAdventurer, type AdventurerTemplate } from '../sim/adventurer';
import { AttackNearestAction, PowerAttackAction } from '../sim/actions/attack';
import { createRunInventory, type Item } from '../sim/items';

function template(overrides: Partial<AdventurerTemplate> = {}): AdventurerTemplate {
  return {
    name: 'Hero',
    maxHp: 20,
    attackPower: 5,
    speed: 5,
    actions: ['attack-nearest'],
    dieFaces: plainFaces(AttackNearestAction),
    ...overrides,
  };
}

const PLAIN_ITEM: Item = {
  id: 'ring',
  name: 'Lucky Ring',
  slot: 'trinket',
  modifiers: [{ stat: 'speed', type: 'flat', amount: 1, source: 'item:ring' }],
  price: 0,
};
const MAGIC_ITEM: Item = {
  id: 'tome',
  name: 'Tome of Power',
  slot: 'trinket',
  modifiers: [],
  price: 0,
  faceEffect: { faceIndex: 0, effect: { kind: 'replace-action', action: PowerAttackAction } },
};

function setUpPlayback(hero: ReturnType<typeof createAdventurer>, item: Item) {
  const inventory = createRunInventory();
  inventory.items.push(item);
  const playback = {
    runState: { party: [hero] },
    inventory,
  } as unknown as DungeonPlaybackState;
  dungeonPlayback.set(playback);
}

describe('LootModal', () => {
  beforeEach(() => {
    roster.set({ adventurers: [], recruitedIds: [] });
    dungeonPlayback.set(null);
  });

  it('renders nothing when item is null', () => {
    render(LootModal, { item: null });
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('renders the item name, modifiers, faceEffect description, and party members', () => {
    const hero = createAdventurer('hero', template(), 'front');
    roster.set({ adventurers: [hero], recruitedIds: [] });
    setUpPlayback(hero, MAGIC_ITEM);

    render(LootModal, { item: MAGIC_ITEM });

    expect(screen.getByText(/You found Tome of Power/)).toBeInTheDocument();
    expect(screen.getByText(`Replaces a die face with ${PowerAttackAction.name}.`)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Hero' })).toBeInTheDocument();
  });

  it('renders a plain modifier list for an item with no faceEffect', () => {
    const hero = createAdventurer('hero', template(), 'front');
    roster.set({ adventurers: [hero], recruitedIds: [] });
    setUpPlayback(hero, PLAIN_ITEM);

    render(LootModal, { item: PLAIN_ITEM });

    expect(screen.getByText('+1 speed')).toBeInTheDocument();
  });

  it('clicking a party member equips the item on them and removes it from the run inventory', async () => {
    const hero = createAdventurer('hero', template(), 'front');
    roster.set({ adventurers: [hero], recruitedIds: [] });
    setUpPlayback(hero, PLAIN_ITEM);

    render(LootModal, { item: PLAIN_ITEM });
    await fireEvent.click(screen.getByRole('button', { name: 'Hero' }));

    expect(get(roster).adventurers[0].equipment.trinket).toBe(PLAIN_ITEM);
    expect(get(dungeonPlayback)!.inventory.items).not.toContain(PLAIN_ITEM);
  });

  it('clicking Skip for now dismisses the prompt without equipping', async () => {
    const hero = createAdventurer('hero', template(), 'front');
    roster.set({ adventurers: [hero], recruitedIds: [] });
    setUpPlayback(hero, PLAIN_ITEM);

    render(LootModal, { item: PLAIN_ITEM });
    await fireEvent.click(screen.getByRole('button', { name: 'Skip for now' }));

    expect(PLAIN_ITEM.promptDismissed).toBe(true);
    expect(get(roster).adventurers[0].equipment.trinket).toBeNull();
  });
});
