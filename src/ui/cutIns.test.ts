import { describe, it, expect } from 'vitest';
import type { ReplayEvent, ReplayUnit } from '../game/RoomReplayScene';
import { cutInEnabled, withKeyMomentCutIns } from './cutIns';

const unit = (id: string, side: 'party' | 'enemy', hp: number, maxHp = 100): ReplayUnit => ({
  id,
  name: id.toUpperCase(),
  archetype: id,
  hp,
  maxHp,
  side,
  position: { lane: 0, rank: 0 },
});

const cutInsOf = (events: ReplayEvent[]) => events.filter((event) => event.type === 'cut-in');

describe('cutInEnabled', () => {
  it('shows nothing when off, key moments under key, and Specials only under all', () => {
    expect(cutInEnabled('off', 'kill')).toBe(false);
    expect(cutInEnabled('off', 'boss')).toBe(false);
    expect(cutInEnabled('key', 'kill')).toBe(true);
    expect(cutInEnabled('key', 'boss')).toBe(true);
    expect(cutInEnabled('key', 'special')).toBe(false);
    expect(cutInEnabled('all', 'special')).toBe(true);
  });
});

describe('withKeyMomentCutIns', () => {
  const units = [unit('hero', 'party', 30), unit('ally', 'party', 10), unit('goblin', 'enemy', 20)];

  it("inserts a hero's killing blow just before the lethal hit", () => {
    const events: ReplayEvent[] = [
      { type: 'attack', actorId: 'hero', targetId: 'goblin', damage: 12, hit: true },
      { type: 'attack', actorId: 'hero', targetId: 'goblin', damage: 12, hit: true },
    ];
    const out = withKeyMomentCutIns(events, units, 'key');
    expect(out).toHaveLength(3);
    expect(out[1]).toMatchObject({ type: 'cut-in', unitId: 'hero', kind: 'kill', art: 'attack' });
    expect(out[2]).toBe(events[1]);
  });

  it('shows a fallen hero, including from a status tick', () => {
    const out = withKeyMomentCutIns([{ type: 'status-tick', targetId: 'ally', damage: 15, effectId: 'burn' }], units, 'key');
    expect(cutInsOf(out)).toEqual([expect.objectContaining({ unitId: 'ally', kind: 'fall', art: 'downed' })]);
  });

  it('does not cut in for an enemy kill by another enemy or a hit that is not lethal', () => {
    const out = withKeyMomentCutIns(
      [
        { type: 'attack', actorId: 'goblin', targetId: 'hero', damage: 5, hit: true },
        { type: 'status-tick', targetId: 'goblin', damage: 50, effectId: 'poison' },
      ],
      units,
      'key',
    );
    expect(cutInsOf(out)).toEqual([]);
  });

  it('counts a revive from 0 HP and a big heal on a nearly-dead hero as saves, but not a top-up', () => {
    const out = withKeyMomentCutIns(
      [
        { type: 'attack', actorId: 'goblin', targetId: 'ally', damage: 10, hit: true }, // ally falls
        { type: 'heal', actorId: 'hero', targetId: 'ally', amount: 30 }, // revived
        { type: 'attack', actorId: 'goblin', targetId: 'hero', damage: 10, hit: true }, // hero 30 -> 20 (20%)
        { type: 'heal', actorId: 'ally', targetId: 'hero', amount: 25 }, // big heal on a nearly-dead hero
        { type: 'heal', actorId: 'ally', targetId: 'hero', amount: 25 }, // top-up — not a save
      ],
      units,
      'key',
    );
    expect(cutInsOf(out).map((event) => event.type === 'cut-in' && `${event.kind}:${event.unitId}`)).toEqual([
      'fall:ally',
      'save:ally',
      'save:hero',
    ]);
  });

  it('inserts nothing when cut-ins are off', () => {
    const events: ReplayEvent[] = [{ type: 'attack', actorId: 'hero', targetId: 'goblin', damage: 99, hit: true }];
    expect(withKeyMomentCutIns(events, units, 'off')).toBe(events);
  });
});
