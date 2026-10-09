/**
 * Seasonal event switches. Flip a flag to false to end the event: its
 * free unlock condition stops working, and its Kits move into the Kit shop
 * for Renown instead (see data/kitShop.ts). Kits already unlocked are kept
 * and stay wearable either way.
 */

/** Halloween: reaching Floor 2 with a character unlocks their Halloween Kit (state/dungeonOrchestrator.ts's finishDungeonRun). */
export const HALLOWEEN_EVENT_ACTIVE = true;
