import { describe, it, expect } from 'vitest';
import type { DungeonRoomRecord } from './dungeonRun';
import { calculateRunRenown, ROOM_CLEAR_RENOWN, RUN_COMPLETION_BONUS_RENOWN } from './renown';

function roomRecord(outcome: 'win' | 'loss' | 'retreat', roomIndex = 0): DungeonRoomRecord {
  return {
    roomIndex,
    partyAtRoomStart: [],
    result: { rounds: [], outcome },
  };
}

describe('calculateRunRenown', () => {
  it('awards ROOM_CLEAR_RENOWN per won room and no bonus for a null (retreat) outcome', () => {
    const records = [roomRecord('win', 0), roomRecord('win', 1)];
    expect(calculateRunRenown(records, null)).toBe(2 * ROOM_CLEAR_RENOWN);
  });

  it('only counts actually-won rooms, not every room record', () => {
    const records = [roomRecord('win', 0), roomRecord('loss', 1)];
    expect(calculateRunRenown(records, 'loss')).toBe(1 * ROOM_CLEAR_RENOWN);
  });

  it('adds RUN_COMPLETION_BONUS_RENOWN only when the outcome is completed', () => {
    const records = [roomRecord('win', 0), roomRecord('win', 1)];
    expect(calculateRunRenown(records, 'completed')).toBe(2 * ROOM_CLEAR_RENOWN + RUN_COMPLETION_BONUS_RENOWN);
  });

  it('awards zero for a run with no rooms won at all', () => {
    expect(calculateRunRenown([], null)).toBe(0);
    expect(calculateRunRenown([roomRecord('loss', 0)], 'loss')).toBe(0);
  });
});
