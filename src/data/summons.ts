import { createSummonAction } from '../sim/summons';
import type { Adventurer } from '../sim/adventurer';

/**
 * The Hellcaller's summon (sim/summons.ts): every 3rd turn it calls an
 * Ember Imp, scaled to its own room, while fewer than 2 of its Imps live.
 *
 * This module deliberately does NOT import data/enemies.ts: that would form
 * an import cycle (enemies → specialActions → summons → enemies) where,
 * depending on load order, the Hellcaller's Special could be read before
 * it's defined. Instead enemies.ts registers the Imp factory here when it
 * loads (registerImpSummonFactory) — always before any fight can run,
 * since the Hellcaller itself lives in enemies.ts.
 */
let createImp: ((summoner: Adventurer) => Adventurer) | null = null;

export function registerImpSummonFactory(factory: (summoner: Adventurer) => Adventurer): void {
  createImp = factory;
}

export const SummonImpAction = createSummonAction('summon-imp', 'Summon Imp', {
  everyNthTurn: 3,
  maxAlive: 2,
  create: (summoner) => {
    if (!createImp) throw new Error('Imp summon factory not registered (data/enemies.ts registers it on load)');
    return createImp(summoner);
  },
});
