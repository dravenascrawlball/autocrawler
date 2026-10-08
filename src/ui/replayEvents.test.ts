import { describe, it, expect } from 'vitest';
import { outcomeToReplayEvents } from './replayEvents';

const names: Record<string, string> = { mira: 'Mira', gudrun: 'Gudrun', glint: 'Glint', grunt: 'Grunt' };
const nameOf = (id: string, fallback: string) => names[id] ?? fallback;

describe('outcomeToReplayEvents', () => {
  it('maps a plain attack to one attack event credited to the actor', () => {
    expect(
      outcomeToReplayEvents({ type: 'attack', damage: 5, hit: true, targetId: 'grunt' }, 'gudrun', 'Attack', nameOf),
    ).toEqual([{ type: 'attack', actorId: 'gudrun', targetId: 'grunt', damage: 5, hit: true }]);
  });

  it('announces a support buff under the given action name (e.g. a Special such as Potion Toss)', () => {
    const events = outcomeToReplayEvents(
      { type: 'support-buff', targetId: 'gudrun', stat: 'attackPower', amount: 20, durationTurns: 3 },
      'mira',
      'Potion Toss (Ally)',
      nameOf,
    );
    expect(events).toEqual([
      expect.objectContaining({ type: 'announce', actorId: 'gudrun', text: 'Potion Toss (Ally)! Gudrun +20% ATK (3t)' }),
    ]);
  });

  it('announces a shield under the given action name', () => {
    const events = outcomeToReplayEvents(
      { type: 'support-shield', targetId: 'gudrun', amount: 6, durationTurns: 2 },
      'glint',
      'Shield Wall',
      nameOf,
    );
    expect(events).toEqual([expect.objectContaining({ type: 'announce', text: expect.stringContaining('Shield Wall! Gudrun') })]);
  });

  it('plays a heal plus one pulse per splash (Splash Heal), skipping zero-amount splashes', () => {
    const events = outcomeToReplayEvents(
      {
        type: 'heal',
        amount: 8,
        targetId: 'gudrun',
        splashes: [
          { targetId: 'glint', amount: 4 },
          { targetId: 'grunt', amount: 0 },
        ],
      },
      'mira',
      'Splash Heal',
      nameOf,
    );
    expect(events).toEqual([
      { type: 'heal', actorId: 'mira', targetId: 'gudrun', amount: 8 },
      { type: 'heal', actorId: 'mira', targetId: 'glint', amount: 4 },
    ]);
  });

  it('announces a revive', () => {
    expect(outcomeToReplayEvents({ type: 'revive', targetId: 'gudrun', amount: 6 }, 'mira', 'Revive', nameOf)).toEqual([
      expect.objectContaining({ type: 'announce', actorId: 'gudrun', text: 'Revive! +6 HP' }),
    ]);
  });
});
