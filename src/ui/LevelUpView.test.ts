// @vitest-environment jsdom
import { plainFaces } from '../sim/dieFace';
import { describe, it, expect, beforeEach } from 'vitest';
import { get } from 'svelte/store';
import { render, screen, fireEvent } from '@testing-library/svelte';
import LevelUpView from './LevelUpView.svelte';
import { roster } from '../state/roster';
import { currentLevelUpOffers } from '../state/levelUpOffers';
import { createAdventurer, type AdventurerTemplate } from '../sim/adventurer';
import { AttackNearestAction, AttackLowestHpAction } from '../sim/actions/attack';
import type { UpgradeOffer } from '../sim/leveling';

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

const actionLevelOffer: UpgradeOffer = {
  type: 'action-level',
  action: AttackNearestAction,
  preview: { label: AttackNearestAction.name, beforeAfter: '+15% damage' },
};
const passiveOffer: UpgradeOffer = {
  type: 'passive',
  passive: { id: 'vitality', name: 'Vitality', modifiers: [{ stat: 'maxHp', type: 'percent', amount: 10, source: 'passive:vitality' }] },
  preview: { label: 'Vitality', beforeAfter: 'maxHp: 20 -> 22' },
};
const newFaceOffer: UpgradeOffer = {
  type: 'new-face',
  action: AttackLowestHpAction,
  preview: { label: AttackLowestHpAction.name, beforeAfter: '0 owned -> 1 owned' },
};

describe('LevelUpView', () => {
  beforeEach(() => {
    roster.set({ adventurers: [], recruitedIds: [] });
    currentLevelUpOffers.set(null);
  });

  it('renders nothing when the adventurer has no pending choice', () => {
    const hero = createAdventurer('hero', template(), 'front');
    roster.set({ adventurers: [hero], recruitedIds: [] });

    render(LevelUpView, { adventurerId: 'hero' });

    expect(screen.queryByText(/Level Up/)).not.toBeInTheDocument();
  });

  it('renders the 3 rolled offers as clickable cards', () => {
    const hero = createAdventurer('hero', template(), 'front');
    hero.pendingUpgradeChoices.push({ id: 'upgrade-1', level: 2, resolved: false });
    roster.set({ adventurers: [hero], recruitedIds: [] });
    currentLevelUpOffers.set({ choiceId: 'upgrade-1', offers: [actionLevelOffer, passiveOffer, newFaceOffer] });

    render(LevelUpView, { adventurerId: 'hero' });

    expect(screen.getByText('+15% damage')).toBeInTheDocument();
    expect(screen.getByText('maxHp: 20 -> 22')).toBeInTheDocument();
    expect(screen.getByText('0 owned -> 1 owned')).toBeInTheDocument();
  });

  it('clicking an action-level offer resolves it immediately', async () => {
    const hero = createAdventurer('hero', template(), 'front');
    hero.pendingUpgradeChoices.push({ id: 'upgrade-1', level: 2, resolved: false });
    roster.set({ adventurers: [hero], recruitedIds: [] });
    currentLevelUpOffers.set({ choiceId: 'upgrade-1', offers: [actionLevelOffer, passiveOffer, newFaceOffer] });

    render(LevelUpView, { adventurerId: 'hero' });
    await fireEvent.click(screen.getByText('+15% damage').closest('button')!);

    expect(get(roster).adventurers[0].actionLevels['attack-nearest']).toBe(2);
    expect(get(roster).adventurers[0].pendingUpgradeChoices).toHaveLength(0);
  });

  it('clicking a new-face offer shows a slot picker, and picking a slot applies the swap', async () => {
    const hero = createAdventurer('hero', template(), 'front');
    hero.pendingUpgradeChoices.push({ id: 'upgrade-1', level: 2, resolved: false });
    roster.set({ adventurers: [hero], recruitedIds: [] });
    currentLevelUpOffers.set({ choiceId: 'upgrade-1', offers: [actionLevelOffer, passiveOffer, newFaceOffer] });

    render(LevelUpView, { adventurerId: 'hero' });
    await fireEvent.click(screen.getByText('0 owned -> 1 owned').closest('button')!);

    expect(screen.getByText(`Replace which Face with ${AttackLowestHpAction.name}?`)).toBeInTheDocument();
    const slotButtons = screen.getAllByText('Face 1', { exact: false });
    await fireEvent.click(slotButtons[0].closest('button')!);

    expect(get(roster).adventurers[0].dieFaces[0].action).toBe(AttackLowestHpAction);
    expect(get(roster).adventurers[0].ownedFaces).toContain(AttackLowestHpAction);
    expect(get(roster).adventurers[0].pendingUpgradeChoices).toHaveLength(0);
  });
});
