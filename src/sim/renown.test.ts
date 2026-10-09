import { describe, it, expect } from 'vitest';
import type { DungeonRoomRecord } from './dungeonRun';
import { calculateRunRenown, calculateRunRenownBreakdown, ROOM_CLEAR_RENOWN, RUN_COMPLETION_BONUS_RENOWN, FLOOR_CLEAR_RENOWN } from './renown';

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

describe('floor Renown bonus', () => {
  it('adds FLOOR_CLEAR_RENOWN for every full floor of rooms won', () => {
    const records = Array.from({ length: 12 }, (_, i) => roomRecord(i < 11 ? 'win' : 'loss', i));
    expect(calculateRunRenownBreakdown(records, 'loss')).toEqual({
      roomsWon: 11,
      roomRenown: 11 * ROOM_CLEAR_RENOWN,
      floorsCleared: 2,
      floorBonus: 2 * FLOOR_CLEAR_RENOWN,
      completionBonus: 0,
      total: 11 * ROOM_CLEAR_RENOWN + 2 * FLOOR_CLEAR_RENOWN,
    });
  });
});
