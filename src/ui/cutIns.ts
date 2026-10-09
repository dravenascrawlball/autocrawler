import type { ReplayEvent, ReplayUnit } from '../game/RoomReplayScene';
import type { CutInSetting } from '../state/cutInSetting';

/**
 * Portrait cut-ins (the cutaways feature): a portrait banner that slides over
 * the replay at dramatic moments without pausing it. This file decides
 * *when*; ui/CutInOverlay.svelte draws them.
 *
 * Key moments are derived from the replay's own HP changes, tracked the same
 * way RoomReplayScene's applyHpDelta does:
 * - a hero lands a killing blow (their attack portrait),
 * - a hero falls (their downed portrait),
 * - a hero is saved: revived from 0 HP (Second Wind, Revive), or healed from
 *   under SAVE_HP_FRACTION by at least SAVE_HEAL_FRACTION of their max.
 * Bodyguard saves and Special cut-ins are added inline by the replay builder
 * (DungeonPhaseView), which knows about intercepts and Specials.
 */

export type CutInEvent = Extract<ReplayEvent, { type: 'cut-in' }>;
export type CutInKind = CutInEvent['kind'];
export type CutInArt = CutInEvent['art'];

/** A hero below this share of max HP… */
export const SAVE_HP_FRACTION = 0.25;
/** …healed by at least this share of max HP counts as a save. */
export const SAVE_HEAL_FRACTION = 0.2;

/** Whether cut-ins of `kind` show under `setting`. */
export function cutInEnabled(setting: CutInSetting, kind: CutInKind): boolean {
  if (setting === 'off') return false;
  return kind !== 'special' || setting === 'all';
}

/**
 * Returns `events` with key-moment cut-ins inserted just before the event
 * that causes each one (so the portrait lands with the blow). Leaves
 * existing cut-in events alone and inserts nothing under 'off'.
 */
export function withKeyMomentCutIns(events: ReplayEvent[], units: ReplayUnit[], setting: CutInSetting): ReplayEvent[] {
  if (setting === 'off') return events;
  const byId = new Map(units.map((unit) => [unit.id, unit]));
  const hp = new Map(units.map((unit) => [unit.id, unit.hp]));
  const out: ReplayEvent[] = [];

  for (const event of events) {
    if (event.type === 'attack' || event.type === 'status-tick') {
      const target = byId.get(event.targetId);
      const before = hp.get(event.targetId) ?? 0;
      const after = Math.max(0, before - event.damage);
      hp.set(event.targetId, after);
      if (target && before > 0 && after === 0) {
        if (target.side === 'party') {
          out.push(cutIn(target.id, 'fall', 'downed', `${target.name} falls!`));
        } else if (event.type === 'attack' && byId.get(event.actorId)?.side === 'party') {
          const killer = byId.get(event.actorId)!;
          out.push(cutIn(killer.id, 'kill', 'attack', `${killer.name} takes down ${target.name}!`));
        }
      }
    } else if (event.type === 'heal') {
      const target = byId.get(event.targetId);
      const before = hp.get(event.targetId) ?? 0;
      const max = target?.maxHp ?? 0;
      hp.set(event.targetId, Math.min(max, before + event.amount));
      if (target && target.side === 'party') {
        if (before <= 0) {
          out.push(cutIn(target.id, 'save', 'healed', `${target.name} is back on their feet!`));
        } else if (before < max * SAVE_HP_FRACTION && event.amount >= max * SAVE_HEAL_FRACTION && event.actorId !== target.id) {
          const healer = byId.get(event.actorId);
          out.push(cutIn(target.id, 'save', 'healed', healer ? `Saved by ${healer.name}!` : `${target.name} is saved!`));
        }
      }
    }
    out.push(event);
  }
  return out;
}

export function cutIn(unitId: string, kind: CutInKind, art: CutInArt, text: string): CutInEvent {
  return { type: 'cut-in', unitId, kind, art, text };
}
