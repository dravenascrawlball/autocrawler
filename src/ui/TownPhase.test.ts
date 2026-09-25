// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/svelte';
import TownPhase from './TownPhase.svelte';

describe('TownPhase', () => {
  it('renders the Roster tab by default, with the other tabs\' content not mounted', () => {
    render(TownPhase);

    expect(screen.getByRole('heading', { name: 'Bench' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Shop' })).not.toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Recruitment' })).not.toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: /^Draft \(/ })).not.toBeInTheDocument();
  });

  it('switches to each tab\'s content without throwing, hiding the previous tab\'s', async () => {
    render(TownPhase);

    await fireEvent.click(screen.getByRole('button', { name: 'Shop' }));
    expect(screen.getByRole('heading', { name: 'Shop' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Bench' })).not.toBeInTheDocument();

    await fireEvent.click(screen.getByRole('button', { name: 'Recruit' }));
    expect(screen.getByRole('heading', { name: 'Recruitment' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Shop' })).not.toBeInTheDocument();

    await fireEvent.click(screen.getByRole('button', { name: 'Embark' }));
    expect(screen.getByRole('heading', { name: /^Draft \(/ })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Recruitment' })).not.toBeInTheDocument();

    await fireEvent.click(screen.getByRole('button', { name: 'Roster' }));
    expect(screen.getByRole('heading', { name: 'Bench' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: /^Draft \(/ })).not.toBeInTheDocument();
  });

  it('moves New Game into a separate Settings tab, not shown alongside other tabs', async () => {
    render(TownPhase);

    expect(screen.queryByRole('button', { name: 'New Game' })).not.toBeInTheDocument();

    await fireEvent.click(screen.getByRole('button', { name: 'Settings' }));
    expect(screen.getByRole('heading', { name: 'Settings' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'New Game' })).toBeInTheDocument();
  });
});
