// @vitest-environment jsdom
import { plainFaces } from '../sim/dieFace';
import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/svelte';
import DungeonPauseView from './DungeonPauseView.svelte';
import { roster } from '../state/roster';
import { dungeonPlayback, type DungeonPlaybackState } from '../state/dungeonPlayback';
import { createAdventurer, type AdventurerTemplate } from '../sim/adventurer';
import { AttackNearestAction } from '../sim/actions/attack';
import { createRunInventory } from '../sim/items';

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

describe('DungeonPauseView run recap (roadmap item 6)', () => {
  beforeEach(() => {
    roster.set({ adventurers: [], recruitedIds: [] });
    dungeonPlayback.set(null);
  });

  it('shows no recap while the run is still in progress (outcome null)', () => {
    const hero = createAdventurer('hero', template(), 'front');
    roster.set({ adventurers: [hero], recruitedIds: [] });

    const inventory = createRunInventory();
    dungeonPlayback.set({
      runState: { party: [hero], rooms: [{ enemies: [] }, { enemies: [] }], roomIndex: 1 },
      inventory,
      outcome: null,
    } as unknown as DungeonPlaybackState);

    render(DungeonPauseView, { onContinue: () => {} });

    expect(screen.getByRole('heading', { name: 'Between Rooms' })).toBeInTheDocument();
    expect(screen.queryByText(/rooms cleared/)).not.toBeInTheDocument();
  });

  it('shows the run summary once the run has completed: path, hero card, totals and loot', () => {
    const hero = createAdventurer('hero', template(), 'front');
    hero.runDamageDealt = 42;
    hero.runDamageTaken = 7;
    hero.runHealingDone = 3;
    hero.runKills = 2;
    roster.set({ adventurers: [hero], recruitedIds: [] });

    const inventory = createRunInventory();
    inventory.gold = 25;
    inventory.items.push({ id: 'ring', name: 'Lucky Ring', slot: 'trinket', modifiers: [], price: 0 });

    dungeonPlayback.set({
      runState: { party: [hero], rooms: [{ enemies: [] }, { enemies: [] }], roomIndex: 2, roomRecords: [] },
      inventory,
      outcome: 'completed',
      milestoneOffers: [],
      runTotals: { goldEarned: 60, goldSpent: 35, relicsBought: ['Lucky Coin'] },
    } as unknown as DungeonPlaybackState);

    const { container } = render(DungeonPauseView, { onContinue: () => {} });

    expect(screen.getByRole('heading', { name: 'Dungeon Complete!' })).toBeInTheDocument();
    expect(container.textContent).toContain('2 / 2 rooms cleared');
    expect(container.textContent).toContain('60g earned · 35g spent');
    expect(container.textContent).toContain('Lucky Coin');
    expect(container.textContent).toContain('Loot found: Lucky Ring');
    expect(container.textContent).toContain('42 dmg · 3 healed · 7 taken · 2 kills');
    expect(container.textContent).toContain('Top Damage');
    expect(screen.getByRole('button', { name: 'Return to Town' })).toBeInTheDocument();
    // The between-rooms layout (shop, Continue) is gone.
    expect(screen.queryByRole('button', { name: /Continue to Next Room/ })).not.toBeInTheDocument();
  });

  it('omits the loot line entirely when nothing was found, and names the floor of a defeat', () => {
    const hero = createAdventurer('hero', template(), 'front');
    roster.set({ adventurers: [hero], recruitedIds: [] });

    dungeonPlayback.set({
      runState: { party: [hero], rooms: [{ enemies: [] }], roomIndex: 1, roomRecords: [] },
      inventory: createRunInventory(),
      outcome: 'loss',
      milestoneOffers: [],
      runTotals: { goldEarned: 0, goldSpent: 0, relicsBought: [] },
    } as unknown as DungeonPlaybackState);

    render(DungeonPauseView, { onContinue: () => {} });

    expect(screen.getByRole('heading', { name: 'Defeated on Floor 1' })).toBeInTheDocument();
    expect(screen.queryByText(/Loot found/)).not.toBeInTheDocument();
  });
});
