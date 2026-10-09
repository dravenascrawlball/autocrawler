import { writable } from 'svelte/store';
import type { Adventurer } from '../sim/adventurer';
import type { DungeonOutcome } from '../sim/dungeonRun';
import { ROOMS_PER_FLOOR, floorOf } from '../sim/dungeonRun';
import { calculateRunRenownBreakdown, type RunRenownBreakdown } from '../sim/renown';
import { evaluateSynergies } from '../sim/synergies';
import { displayTitle } from '../sim/kits';
import { SYNERGIES } from '../data/synergies';
import type { DungeonPlaybackState } from './dungeonPlayback';
import { INITIAL_SAVE } from './persistence';

/**
 * Run summaries (the run summary screen and the run log on Progress): a
 * plain-data snapshot of a finished run, built before the party resets
 * (dungeonOrchestrator.ts's finishDungeonRun) so it survives everything a
 * reset wipes — level, Traits earned, Kit worn, run stats. Plain data so it
 * persists as-is (persistence.ts's runLog).
 */

export interface HeroSummary {
  id: string;
  name: string;
  archetype: string;
  kitArtKey?: string;
  title: string;
  level: number;
  /** Traits picked up during the run: floor-boss rewards and Quirks. */
  traitsEarned: { name: string; kind: 'milestone' | 'boon' | 'flaw' }[];
  damageDealt: number;
  damageTaken: number;
  healingDone: number;
  kills: number;
  /** Whether they ended the run downed. */
  downed: boolean;
}

export interface MvpAward {
  award: string;
  heroName: string;
  value: number;
  unit: string;
}

export interface RunSummary {
  id: string;
  endedAt: number;
  outcome: DungeonOutcome;
  roomsTotal: number;
  roomsWon: number;
  /** Floor the run ended on (1-based). */
  floorReached: number;
  bossesBeaten: string[];
  /** On a loss, the enemies of the room that ended it (unique names). */
  endedBy: string[];
  heroes: HeroSummary[];
  mvps: MvpAward[];
  renown: RunRenownBreakdown;
  goldEarned: number;
  goldSpent: number;
  relics: string[];
  /** Active synergies at the end of the run, e.g. "Vanguard (3)". */
  synergies: string[];
}

/** How many past runs the log keeps. */
export const RUN_LOG_LIMIT = 10;

function heroSummary(member: Adventurer): HeroSummary {
  return {
    id: member.id,
    name: member.name,
    archetype: member.archetype,
    kitArtKey: member.activeKit?.artKey,
    title: displayTitle(member),
    level: member.level,
    traitsEarned: member.traits
      .filter((trait) => trait.milestone || trait.quirk)
      .map((trait) => ({ name: trait.name, kind: trait.milestone ? 'milestone' : trait.quirk === 'good' ? 'boon' : 'flaw' })),
    damageDealt: Math.round(member.runDamageDealt),
    damageTaken: Math.round(member.runDamageTaken),
    healingDone: Math.round(member.runHealingDone),
    kills: member.runKills ?? 0,
    downed: member.hp <= 0,
  };
}

function topBy(heroes: HeroSummary[], award: string, unit: string, value: (hero: HeroSummary) => number): MvpAward | null {
  const best = heroes.reduce<HeroSummary | null>((top, hero) => (!top || value(hero) > value(top) ? hero : top), null);
  return best && value(best) > 0 ? { award, heroName: best.name, value: value(best), unit } : null;
}

/** The biggest enemy (by max HP) of a room — its boss, for a floor's last room. */
function bossName(enemies: Adventurer[]): string | null {
  const boss = enemies.reduce<Adventurer | null>((top, enemy) => (!top || enemy.maxHp > top.maxHp ? enemy : top), null);
  return boss?.name ?? null;
}

/**
 * Builds the summary of `playback`'s run as it stands (call once it has
 * ended, before the party resets). A run with no `outcome` yet is treated
 * as a retreat — that's the only way finishDungeonRun is reached early.
 */
export function buildRunSummary(playback: DungeonPlaybackState, now: number = Date.now()): RunSummary {
  const { runState } = playback;
  const outcome: DungeonOutcome = playback.outcome ?? 'retreat';
  const roomsTotal = runState.rooms.length;
  // roomIndex counts rooms resolved; a loss's last room wasn't won. (Derived from roomIndex rather
  // than roomRecords, which a resumed run doesn't fully have.)
  const roomsWon = outcome === 'completed' ? roomsTotal : outcome === 'loss' ? Math.max(0, runState.roomIndex - 1) : runState.roomIndex;
  const bossesBeaten: string[] = [];
  for (let index = ROOMS_PER_FLOOR - 1; index < roomsWon; index += ROOMS_PER_FLOOR) {
    const name = bossName(runState.rooms[index].enemies);
    if (name) bossesBeaten.push(name);
  }
  const finalRoom = runState.rooms[Math.max(0, runState.roomIndex - 1)];
  const endedBy =
    outcome === 'loss' && finalRoom ? [...new Set(finalRoom.enemies.filter((enemy) => !enemy.summonedBy).map((enemy) => enemy.name))] : [];

  const heroes = runState.party.map(heroSummary);
  const mvps = [
    topBy(heroes, 'Top Damage', 'damage', (hero) => hero.damageDealt),
    topBy(heroes, 'Top Healer', 'healing', (hero) => hero.healingDone),
    topBy(heroes, 'Iron Wall', 'damage taken', (hero) => hero.damageTaken),
    topBy(heroes, 'Slayer', 'kills', (hero) => hero.kills),
  ].filter((award): award is MvpAward => award !== null);

  return {
    id: `run-${now}`,
    endedAt: now,
    outcome,
    roomsTotal,
    roomsWon,
    floorReached: floorOf(Math.min(Math.max(0, runState.roomIndex - 1), roomsTotal - 1)),
    bossesBeaten,
    endedBy,
    heroes,
    mvps,
    renown: calculateRunRenownBreakdown(runState.roomRecords, playback.outcome),
    goldEarned: playback.runTotals.goldEarned,
    goldSpent: playback.runTotals.goldSpent,
    relics: [...playback.runTotals.relicsBought],
    synergies: evaluateSynergies(runState.party, SYNERGIES)
      .filter((entry) => entry.tier !== null)
      .map((entry) => `${entry.synergy.name} (${entry.count})`),
  };
}

/** The last RUN_LOG_LIMIT run summaries, newest first — shown on Progress. Persisted. */
export const runLog = writable<RunSummary[]>(INITIAL_SAVE?.runLog ?? []);

/** Adds `summary` to the front of the run log, keeping at most RUN_LOG_LIMIT. */
export function recordRunSummary(log: RunSummary[], summary: RunSummary): RunSummary[] {
  return [summary, ...log].slice(0, RUN_LOG_LIMIT);
}
