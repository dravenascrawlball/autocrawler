// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/svelte';
import NewGameView from './NewGameView.svelte';
import { resetGame } from '../state/newGame';

vi.mock('../state/newGame', () => ({
  resetGame: vi.fn(),
}));

describe('NewGameView', () => {
  it('shows only the initial button, with resetGame not yet called', () => {
    render(NewGameView);

    expect(screen.getByRole('button', { name: 'New Game' })).toBeInTheDocument();
    expect(screen.queryByText('Confirm Reset')).not.toBeInTheDocument();
    expect(resetGame).not.toHaveBeenCalled();
  });

  it('clicking New Game reveals the confirm/cancel step without resetting yet', async () => {
    render(NewGameView);

    await fireEvent.click(screen.getByRole('button', { name: 'New Game' }));

    expect(screen.getByText('Confirm Reset')).toBeInTheDocument();
    expect(screen.getByText('Cancel')).toBeInTheDocument();
    expect(resetGame).not.toHaveBeenCalled();
  });

  it('Cancel returns to the initial button without ever resetting', async () => {
    render(NewGameView);

    await fireEvent.click(screen.getByRole('button', { name: 'New Game' }));
    await fireEvent.click(screen.getByText('Cancel'));

    expect(screen.getByRole('button', { name: 'New Game' })).toBeInTheDocument();
    expect(screen.queryByText('Confirm Reset')).not.toBeInTheDocument();
    expect(resetGame).not.toHaveBeenCalled();
  });

  it('Confirm Reset calls resetGame and returns to the initial button', async () => {
    render(NewGameView);

    await fireEvent.click(screen.getByRole('button', { name: 'New Game' }));
    await fireEvent.click(screen.getByText('Confirm Reset'));

    expect(resetGame).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('button', { name: 'New Game' })).toBeInTheDocument();
    expect(screen.queryByText('Confirm Reset')).not.toBeInTheDocument();
  });
});
