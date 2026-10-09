import type { Adventurer } from './adventurer';
import type { ActionOutcome } from './action';
import type { BattleState, RoomOutcome } from './battle';
import { checkRoomOutcome } from './battle';
import { resolveTurn, type TurnResult } from './turnEngine';
import { getEffectiveStat } from './stats';
import type { RngSource } from './rng';
import { tickAuras } from './auras';

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
    damageDone: target.runDamageDealt,
    damageTaken: target.runDamageTaken,
    healed: target.runHealingDone,
    acknowledged: false,
  };
}

/** Credits `killer` (a party member) with felling `target` (an enemy), once per enemy — see Adventurer.runKills. */
function creditKillIfNeeded(battle: BattleState, killer: Adventurer, target: Adventurer): void {
  if (target.hp > 0 || target.killedBy || !battle.enemies.includes(target) || !battle.adventurers.includes(killer)) return;
  target.killedBy = killer.id;
  killer.runKills = (killer.runKills ?? 0) + 1;
}

/**
 * A commanded bonus attack (Command, Battle Orders) — credited to the
 * commanded ally, not whoever issued the order: she didn't land the hit,
 * they did.
 */
function applyCommandStats(
  battle: BattleState,
  commandedAllyId: string,
  attackOutcome: { damage: number; hit: boolean; targetId: string } | null,
  roomIndex: number,
): void {
  if (!attackOutcome) return;
  const commandedAlly = findUnitById(battle, commandedAllyId);
  const target = findUnitById(battle, attackOutcome.targetId);
  if (commandedAlly) {
    commandedAlly.runDamageDealt += attackOutcome.damage;
  }
  if (target) {
    target.runDamageTaken += attackOutcome.damage;
    if (attackOutcome.hit && commandedAlly) {
      recordDownIfNeeded(battle, target, commandedAlly.archetype, roomIndex);
      creditKillIfNeeded(battle, commandedAlly, target);
    }
  }
}

/** The 'action'/'special-action' outcome-handling body shared by both event types — see applyTurnStats. */
function applyOutcomeStats(unit: Adventurer, outcome: ActionOutcome, battle: BattleState, roomIndex: number): void {
  if (
    outcome.type === 'attack' ||
    outcome.type === 'attack-and-buff' ||
    outcome.type === 'attack-and-gold' ||
    outcome.type === 'attack-and-debuff' ||
    outcome.type === 'attack-and-status' ||
    outcome.type === 'attack-and-pull'
  ) {
    const target = findUnitById(battle, outcome.targetId);
    unit.runDamageDealt += outcome.damage;
    if (target) {
      target.runDamageTaken += outcome.damage;
      if (outcome.hit) {
        recordDownIfNeeded(battle, target, unit.archetype, roomIndex);
        creditKillIfNeeded(battle, unit, target);
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
          creditKillIfNeeded(battle, unit, target);
        }
      }
    }
  } else if (outcome.type === 'heal' || outcome.type === 'heal-and-charge') {
    unit.runHealingDone += outcome.amount;
    if (outcome.type === 'heal') {
      for (const splash of outcome.splashes ?? []) unit.runHealingDone += splash.amount;
    }
  } else if (outcome.type === 'command') {
    applyCommandStats(battle, outcome.commandedAllyId, outcome.attackOutcome, roomIndex);
  } else if (outcome.type === 'command-multi') {
    for (const command of outcome.commands) {
      applyCommandStats(battle, command.commandedAllyId, command.attackOutcome, roomIndex);
    }
  }
}

/**
 * Updates run-scoped damage/healing counters (Adventurer.runDamageDealt etc.
 * — see adventurer.ts) from one unit's turn, and captures a DownedSummary
 * the moment a party member's hp first hits 0 this run (attributing the
 * kill to whichever enemy's attack landed it, or null for a status-tick
 * kill like Burn, which has no single attacker to credit). A
 * 'special-action' event is credited to whoever the Special Action actually
 * belongs to (event.actorId) — not necessarily `unit`, since e.g. an
 * on-hit-taken special fires on the unit that got hit, during the attacker's
 * own turn (see turnEngine.ts) — and skipped entirely if its outcome is null
 * (no valid target).
 */
function applyTurnStats(unit: Adventurer, battle: BattleState, turn: TurnResult, roomIndex: number): void {
  for (const event of turn.events) {
    if (event.type === 'status-tick') {
      unit.runDamageTaken += event.damage;
      recordDownIfNeeded(battle, unit, null, roomIndex);
    } else if (event.type === 'special-action') {
      if (event.outcome) {
        applyOutcomeStats(findUnitById(battle, event.actorId) ?? unit, event.outcome, battle, roomIndex);
      }
    } else if (event.type === 'banish') {
      // Summons vanishing with their summoner (sim/summons.ts) — no damage or healing to record.
    } else if (event.type === 'trait-effect') {
      // Vampiric heals count as healing done; a Second Wind revive is neither dealt nor healed.
      if (event.kind === 'heal') {
        const healer = findUnitById(battle, event.unitId);
        if (healer) healer.runHealingDone += event.amount;
      }
    } else if (event.type === 'intercept') {
      // A Bodyguard took part of a hit: the attacker dealt it, the guardian took it.
      const attacker = findUnitById(battle, event.attackerId);
      const guardian = findUnitById(battle, event.guardianId);
      if (attacker) attacker.runDamageDealt += event.damage;
      if (guardian) {
        guardian.runDamageTaken += event.damage;
        recordDownIfNeeded(battle, guardian, attacker?.archetype ?? null, roomIndex);
      }
    } else {
      applyOutcomeStats(unit, event.outcome, battle, roomIndex);
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

  // Auras normally refresh at the start of each unit's own turn (turnEngine.ts); apply them once up
  // front too, so a Shield Bearer's protection covers the very first hits of the fight.
  for (const unit of [...battle.adventurers, ...battle.enemies]) tickAuras(unit, battle);

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

  return { rounds, outcome: outcome ?? 'retreat' };
}
