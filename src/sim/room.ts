import type { Adventurer } from './adventurer';
import type { BattleState, RoomOutcome } from './battle';
import { checkRoomOutcome } from './battle';
import { resolveTurn, type TurnResult } from './turnEngine';
import { awardRoomXp } from './leveling';
import { getEffectiveStat } from './stats';
import type { RngSource } from './rng';

function findUnitById(battle: BattleState, id: string): Adventurer | undefined {
  return battle.adventurers.find((unit) => unit.id === id) ?? battle.enemies.find((unit) => unit.id === id);
}

/** Records `target`'s DownedSummary the first time its hp hits 0 this run — a no-op for enemies, or if already recorded. */
function recordDownIfNeeded(
  battle: BattleState,
  target: Adventurer,
  killerArchetype: string | null,
  roomIndex: number,
): void {
  if (target.hp > 0 || !battle.adventurers.includes(target) || target.downedSummary) {
    return;
  }

  target.downedSummary = {
    roomIndex,
    killerArchetype,
    // Every party member starts a run at xp 0 now (resetToTemplateBaseline runs at the *end* of
    // the previous run), so current xp already IS this run's delta — no separate start snapshot needed.
    xpGained: target.xp,
    damageDone: target.runDamageDealt,
    damageTaken: target.runDamageTaken,
    healed: target.runHealingDone,
    acknowledged: false,
  };
}

/**
 * Updates run-scoped damage/healing counters (Adventurer.runDamageDealt etc.
 * — see adventurer.ts) from one unit's turn, and captures a DownedSummary
 * the moment a party member's hp first hits 0 this run (attributing the
 * kill to whichever enemy's attack landed it, or null for a status-tick
 * kill like Burn, which has no single attacker to credit).
 */
function applyTurnStats(unit: Adventurer, battle: BattleState, turn: TurnResult, roomIndex: number): void {
  for (const event of turn.events) {
    if (event.type === 'status-tick') {
      unit.runDamageTaken += event.damage;
      recordDownIfNeeded(battle, unit, null, roomIndex);
      continue;
    }

    const outcome = event.outcome;
    if (
      outcome.type === 'attack' ||
      outcome.type === 'attack-and-buff' ||
      outcome.type === 'attack-and-gold' ||
      outcome.type === 'attack-and-debuff'
    ) {
      const target = findUnitById(battle, outcome.targetId);
      unit.runDamageDealt += outcome.damage;
      if (target) {
        target.runDamageTaken += outcome.damage;
        if (outcome.hit) {
          recordDownIfNeeded(battle, target, unit.archetype, roomIndex);
        }
      }
    } else if (outcome.type === 'attack-multi') {
      for (const hit of outcome.hits) {
        const target = findUnitById(battle, hit.targetId);
        unit.runDamageDealt += hit.damage;
        if (target) {
          target.runDamageTaken += hit.damage;
          if (hit.hit) {
            recordDownIfNeeded(battle, target, unit.archetype, roomIndex);
          }
        }
      }
    } else if (outcome.type === 'heal' || outcome.type === 'heal-and-charge') {
      unit.runHealingDone += outcome.amount;
    } else if (outcome.type === 'command' && outcome.attackOutcome) {
      // Credited to the commanded ally, not `unit` (Fallacy) — she didn't land the hit, they did.
      const commandedAlly = findUnitById(battle, outcome.commandedAllyId);
      const target = findUnitById(battle, outcome.attackOutcome.targetId);
      if (commandedAlly) {
        commandedAlly.runDamageDealt += outcome.attackOutcome.damage;
      }
      if (target) {
        target.runDamageTaken += outcome.attackOutcome.damage;
        if (outcome.attackOutcome.hit && commandedAlly) {
          recordDownIfNeeded(battle, target, commandedAlly.archetype, roomIndex);
        }
      }
    }
  }
}

export interface RoundTurn {
  unitId: string;
  turn: TurnResult;
}

export interface RoundResult {
  round: number;
  turnOrder: string[];
  turns: RoundTurn[];
}

export interface RoomResult {
  rounds: RoundResult[];
  outcome: RoomOutcome;
}

function getTurnOrder(battle: BattleState): Adventurer[] {
  const combined = [...battle.adventurers, ...battle.enemies].filter((unit) => unit.hp > 0);

  return combined
    .map((unit, index) => ({ unit, index, speed: getEffectiveStat(unit.speed, 'speed', unit.modifiers) }))
    .sort((a, b) => b.speed - a.speed || a.index - b.index)
    .map((entry) => entry.unit);
}

/**
 * Resolves rounds until a room outcome (win/loss/retreat) is reached.
 * Adventurers and enemies are merged into a single turn-order pool each
 * round, sorted by speed fresh every time (never cached), ties broken by
 * position in the combined [...adventurers, ...enemies] roster. Every
 * living unit takes one full turn in that order against the shared battle
 * state; a unit that died earlier in the same round is skipped. Room state
 * is checked after every unit's turn, and resolution stops immediately once
 * an outcome is reached — no further units or rounds are resolved. On a
 * win, every adventurer with HP > 0 is awarded the enemies' summed XP.
 *
 * If neither side is wiped by the time `maxRounds` is reached (a stalemate —
 * e.g. two sustain-heavy healers outlasting a weak attacker), the room is
 * forced to a 'retreat' outcome rather than left undecided: the fight isn't
 * going anywhere, so the party disengages rather than the run crashing or
 * hanging. No loot/XP is awarded for a forced retreat, same as a
 * player-chosen one.
 */
export function resolveRoom(battle: BattleState, rng: RngSource, maxRounds = 100, roomIndex = 0): RoomResult {
  const rounds: RoundResult[] = [];
  let outcome = checkRoomOutcome(battle);
  let round = 0;

  while (outcome === null && round < maxRounds) {
    round += 1;
    const order = getTurnOrder(battle);
    const turns: RoundTurn[] = [];

    for (const unit of order) {
      if (unit.hp <= 0) continue;

      const turn = resolveTurn(unit, battle, rng);
      turns.push({ unitId: unit.id, turn });
      applyTurnStats(unit, battle, turn, roomIndex);

      outcome = checkRoomOutcome(battle);
      if (outcome !== null) break;
    }

    rounds.push({ round, turnOrder: turns.map((t) => t.unitId), turns });
  }

  if (outcome === 'win') {
    const totalXp = battle.enemies.reduce((sum, enemy) => sum + (enemy.xpReward ?? 0), 0);
    awardRoomXp(battle.adventurers, totalXp);
  }

  return { rounds, outcome: outcome ?? 'retreat' };
}
