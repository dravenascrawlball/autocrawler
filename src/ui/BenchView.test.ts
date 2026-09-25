// @vitest-environment jsdom
import { plainFaces } from '../sim/dieFace';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/svelte';
import BenchView from './BenchView.svelte';
import { roster } from '../state/roster';
import { createAdventurer, type AdventurerTemplate } from '../sim/adventurer';
import { AttackNearestAction } from '../sim/actions/attack';

function template(overrides: Partial<AdventurerTemplate> = {}): AdventurerTemplate {
  return {
    name: 'Adventurer',
    maxHp: 20,
    attackPower: 5,
    speed: 5,
    actions: ['attack-nearest'],
    dieFaces: plainFaces(AttackNearestAction),
    ...overrides,
  };
}

describe('BenchView', () => {
  beforeEach(() => {
    roster.set({ adventurers: [], recruitedIds: [] });
  });

  it('renders every roster member', () => {
    const healthy = createAdventurer('healthy', template(), 'front');
    healthy.name = 'Aldric';
    roster.set({ adventurers: [healthy], recruitedIds: [] });

    render(BenchView);

    expect(screen.getByText(/Aldric/)).toBeInTheDocument();
  });

  it('does not crash when two roster members share the same name (only ids need be unique)', () => {
    const a = createAdventurer('a', template(), 'front');
    a.name = 'Rowan';
    const b = createAdventurer('b', template(), 'front');
    b.name = 'Rowan';
    roster.set({ adventurers: [a, b], recruitedIds: [] });

    expect(() => render(BenchView)).not.toThrow();
    expect(screen.getAllByText(/Rowan/)).toHaveLength(2);
  });

  it('calls onSelect with the clicked adventurer\'s id', async () => {
    const hero = createAdventurer('hero', template(), 'front');
    hero.name = 'Aldric';
    roster.set({ adventurers: [hero], recruitedIds: [] });
    const onSelect = vi.fn();

    render(BenchView, { onSelect });

    await fireEvent.click(screen.getByRole('button', { name: 'Aldric' }));

    expect(onSelect).toHaveBeenCalledWith('hero');
  });

  it('hides combat detail (traits, HP, level) on the Town card — see CharacterCard showDetails', () => {
    const hero = createAdventurer('hero', template(), 'front');
    hero.name = 'Elara';
    hero.traits.push({ id: 'survivor', name: 'Survivor', description: 'test' });
    roster.set({ adventurers: [hero], recruitedIds: [] });

    render(BenchView);

    expect(screen.queryByText(/Traits: Survivor/)).not.toBeInTheDocument();
    expect(screen.queryByText(/HP \d/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Lv \d/)).not.toBeInTheDocument();
  });

  it('shows a Recruited tag for recruited adventurers', () => {
    const hero = createAdventurer('hero', template(), 'front');
    hero.name = 'Aldric';
    const other = createAdventurer('other', template(), 'front');
    other.name = 'Bram';
    roster.set({ adventurers: [hero, other], recruitedIds: ['hero'] });

    render(BenchView);

    expect(screen.getByText('Recruited')).toBeInTheDocument();
  });

  it('shows an empty-Bench note with a link to Recruit when nobody is recruited yet', () => {
    const hero = createAdventurer('hero', template(), 'front');
    hero.name = 'Aldric';
    roster.set({ adventurers: [hero], recruitedIds: [] });
    const onGoToRecruit = vi.fn();

    render(BenchView, { onGoToRecruit });

    expect(screen.getByText(/Recruit a character to always have them available/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Aldric' })).toBeInTheDocument();
  });

  it('clicking the empty-Bench note link navigates to Recruit', async () => {
    roster.set({ adventurers: [], recruitedIds: [] });
    const onGoToRecruit = vi.fn();

    render(BenchView, { onGoToRecruit });

    await fireEvent.click(screen.getByRole('button', { name: 'go to Recruit' }));

    expect(onGoToRecruit).toHaveBeenCalledTimes(1);
  });

  it('separates recruited (Bench) from unrecruited (Draftable) adventurers', () => {
    const hero = createAdventurer('hero', template(), 'front');
    hero.name = 'Aldric';
    const other = createAdventurer('other', template(), 'front');
    other.name = 'Bram';
    roster.set({ adventurers: [hero, other], recruitedIds: ['hero'] });

    render(BenchView);

    expect(screen.getByRole('heading', { name: 'Bench' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Draftable' })).toBeInTheDocument();
    expect(screen.queryByText(/Recruit a character to always have them available/)).not.toBeInTheDocument();
  });
});
