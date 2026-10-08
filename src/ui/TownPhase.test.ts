// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/svelte';
import TownPhase from './TownPhase.svelte';

describe('TownPhase', () => {
  it('renders the Hub by default, with no section content mounted', () => {
    render(TownPhase);

    expect(screen.getByRole('button', { name: /Roster/ })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Bench' })).not.toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Shop' })).not.toBeInTheDocument();
  });

  it('navigates into each section from its Hub card, and back via Back to Town', async () => {
    render(TownPhase);

    await fireEvent.click(screen.getByRole('button', { name: /Roster/ }));
    expect(screen.getByRole('heading', { name: 'Bench' })).toBeInTheDocument();

    await fireEvent.click(screen.getByRole('button', { name: '← Back to Town' }));
    expect(screen.queryByRole('heading', { name: 'Bench' })).not.toBeInTheDocument();

    await fireEvent.click(screen.getByRole('button', { name: /Recruit/ }));
    expect(screen.getByRole('heading', { name: /^Recruitment/ })).toBeInTheDocument();

    await fireEvent.click(screen.getByRole('button', { name: '← Back to Town' }));
    await fireEvent.click(screen.getByRole('button', { name: /Embark/ }));
    expect(screen.getByRole('heading', { name: /^Build Your Party/ })).toBeInTheDocument();
  });

  it('navigates into the Meta Progression (Shop) card', async () => {
    render(TownPhase);

    expect(screen.getByRole('button', { name: /Meta Progression/ })).not.toBeDisabled();

    await fireEvent.click(screen.getByRole('button', { name: /Meta Progression/ }));
    expect(screen.getByRole('heading', { name: /^Shop/ })).toBeInTheDocument();
  });

  it('moves New Game into a separate Settings card, not shown on the Hub', async () => {
    render(TownPhase);

    expect(screen.queryByRole('button', { name: 'New Game' })).not.toBeInTheDocument();

    await fireEvent.click(screen.getByRole('button', { name: /Settings/ }));
    expect(screen.getByRole('heading', { name: 'Settings' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'New Game' })).toBeInTheDocument();
  });
});
