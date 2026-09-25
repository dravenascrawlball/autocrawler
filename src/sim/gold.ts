import type { Adventurer } from './adventurer';
import type { RngSource } from './rng';
import type { RoomResult } from './room';

export interface GoldDropTable {
  /** Independent drop probability in [0, 1]. */
  chance: number;
  min: number;
  max: number;
}

/** Rolls one gold-drop table using the injected RNG (never Math.random directly); 0 if it doesn't trigger. */
export function rollGold(table: GoldDropTable, rng: RngSource): number {
  if (rng() >= table.chance) {
    return 0;
  }
  return Math.round(table.min + rng() * (table.max - table.min));
}

/**
 * Sums gold rolled independently for every defeated enemy's gold-drop
 * table. Intended to run once, right after a room ends in Win. Unlike
 * rollRoomLoot (one item roll for the whole room), gold intentionally still
 * scales with kill count — it's meant to track room difficulty, not be a
 * rare bonus.
 */
export function rollRoomGold(enemies: Adventurer[], rng: RngSource): number {
  let total = 0;

  for (const enemy of enemies) {
    if (enemy.hp <= 0 && enemy.goldDrop) {
      total += rollGold(enemy.goldDrop, rng);
    }
  }

  return total;
}

/**
 * Sums every 'attack-and-gold' outcome's already-rolled `goldGenerated`
 * across a room's turn log — Nerissa's Pickpocket Strike (roadmap item 11).
 * Unlike rollRoomGold/rollRoomLoot, this isn't gated on the room outcome:
 * a strike that lands still nets gold even if the room is ultimately lost
 * or retreated from, since it's a per-hit combat effect, not a room-clear
 * reward. The amount was already decided during combat (via the same
 * injected rng resolveRoom used) — this just tallies it, it never rolls
 * anything itself.
 */
export function sumGeneratedGold(result: RoomResult): number {
  let total = 0;

  for (const round of result.rounds) {
    for (const roundTurn of round.turns) {
      for (const event of roundTurn.turn.events) {
        if (event.type === 'action' && event.outcome.type === 'attack-and-gold') {
          total += event.outcome.goldGenerated;
        }
      }
    }
  }

  return total;
}
