import type { Action, ActionContext, ActionOutcome, TargetingContext } from './action';
import type { Adventurer } from './adventurer';
import type { BattleState } from './battle';
import { getOwnRoster } from './battle';
import { findFreeCell } from './formation';

/**
 * Summoning (the Hellcaller — data/enemies.ts): a Special Action that calls
 * a new unit into the fight on its own side. The creature itself comes from
 * an injected factory (sim/ never imports data/), which also scales it to
 * the summoner's room (Adventurer.statScale). Summons carry `summonedBy`,
 * give no gold or loot, and are banished when their summoner falls
 * (banishOrphanedSummons, called from turnEngine.ts).
 */
export interface SummonRules {
  /** Fires on every Nth turn the summoner starts (3 = turns 3, 6, 9…). */
  everyNthTurn: number;
  /** Most summons from this summoner alive at once. */
  maxAlive: number;
  /** Builds the summoned unit (unplaced; this action positions it). */
  create: (summoner: Adventurer) => Adventurer;
}

function aliveSummonsOf(battle: BattleState, summoner: Adventurer): Adventurer[] {
  return getOwnRoster(battle, summoner).filter((unit) => unit.summonedBy === summoner.id && unit.hp > 0);
}

/** Builds a summoning Action with `rules` — see SummonRules. The outcome is 'summon' (null target when it isn't time, the cap is reached, or the grid is full). */
export function createSummonAction(id: Action['id'], name: string, rules: SummonRules): Action {
  return {
    id,
    name,
    reach: 'ranged', // unused — summons onto its own side
    selectTarget(context: TargetingContext) {
      const { actor, battle } = context;
      const turns = battle.turnsTakenByUnitId[actor.id] ?? 0;
      if (actor.hp <= 0 || turns === 0 || turns % rules.everyNthTurn !== 0) return null;
      if (aliveSummonsOf(battle, actor).length >= rules.maxAlive) return null;
      const occupied = getOwnRoster(battle, actor).filter((unit) => unit.hp > 0).map((unit) => unit.position);
      return findFreeCell(occupied, 0) ? actor : null;
    },
    resolve(context: ActionContext): ActionOutcome {
      const { actor, battle } = context;
      const summoned = rules.create(actor);
      const occupied = getOwnRoster(battle, actor).filter((unit) => unit.hp > 0).map((unit) => unit.position);
      summoned.position = findFreeCell(occupied, 0) ?? summoned.position;
      summoned.summonedBy = actor.id;
      summoned.goldDrop = undefined;
      summoned.lootTable = [];
      getOwnRoster(battle, actor).push(summoned);
      return { type: 'summon', summonedId: summoned.id, position: { ...summoned.position } };
    },
  };
}

/** Banishes (sets to 0 HP) every living summon whose summoner has fallen. Returns the banished units' ids. */
export function banishOrphanedSummons(battle: BattleState): string[] {
  const all = [...battle.adventurers, ...battle.enemies];
  const banished: string[] = [];
  for (const unit of all) {
    if (!unit.summonedBy || unit.hp <= 0) continue;
    const summoner = all.find((candidate) => candidate.id === unit.summonedBy);
    if (!summoner || summoner.hp <= 0) {
      unit.hp = 0;
      banished.push(unit.id);
    }
  }
  return banished;
}
