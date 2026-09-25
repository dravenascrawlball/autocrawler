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
    expect(screen.queryByText(/Rooms reached/)).not.toBeInTheDocument();
  });

  it('shows the recap (rooms, gold, loot, per-character stats) once the run has completed', () => {
    const hero = createAdventurer('hero', template(), 'front');
    hero.runDamageDealt = 42;
    hero.runDamageTaken = 7;
    hero.runHealingDone = 3;
    roster.set({ adventurers: [hero], recruitedIds: [] });

    const inventory = createRunInventory();
    inventory.gold = 25;
    inventory.items.push({ id: 'ring', name: 'Lucky Ring', slot: 'trinket', modifiers: [], price: 0 });

    dungeonPlayback.set({
      runState: { party: [hero], rooms: [{ enemies: [] }, { enemies: [] }], roomIndex: 2 },
      inventory,
      outcome: 'completed',
    } as unknown as DungeonPlaybackState);

    const { container } = render(DungeonPauseView, { onContinue: () => {} });
    const recap = container.querySelector('.run-recap') as HTMLElement;

    expect(screen.getByRole('heading', { name: 'Dungeon Complete!' })).toBeInTheDocument();
    expect(recap).not.toBeNull();
    expect(recap.textContent).toContain('Rooms reached: 2 / 2');
    expect(recap.textContent).toContain('Gold gained: 25g');
    expect(recap.textContent).toContain('Loot found: Lucky Ring');
    expect(recap.querySelector('.run-recap__name')?.textContent).toBe('Hero');
    expect(recap.textContent).toContain('42 dmg dealt');
    expect(recap.textContent).toContain('7 dmg taken');
    expect(recap.textContent).toContain('3 healed');
  });

  it('omits the loot line entirely when nothing was found', () => {
    const hero = createAdventurer('hero', template(), 'front');
    roster.set({ adventurers: [hero], recruitedIds: [] });

    dungeonPlayback.set({
      runState: { party: [hero], rooms: [{ enemies: [] }], roomIndex: 1 },
      inventory: createRunInventory(),
      outcome: 'loss',
    } as unknown as DungeonPlaybackState);

    render(DungeonPauseView, { onContinue: () => {} });

    expect(screen.getByRole('heading', { name: 'Defeat...' })).toBeInTheDocument();
    expect(screen.queryByText(/Loot found/)).not.toBeInTheDocument();
  });
});
