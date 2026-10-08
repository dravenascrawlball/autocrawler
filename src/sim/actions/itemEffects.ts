import type { Action, ActionContext, ActionOutcome, TargetingContext } from '../action';
import { selectFirstEnemy } from './targeting';
import { applyBurn } from '../statusEffects';

/** Placeholder magnitudes pending the balance pass — same convention as every other combat number. */
export const EMBER_BURN_DAMAGE_PER_TICK = 2;
export const EMBER_BURN_TICKS = 3;

/**
 * Ring of Embers' granted Special Action (see data/items.ts) — the dice-era
 * per-face Burning enchantment's replacement now that per-face enchantments
 * are retired (step 2 of the combat overhaul). Burns whichever living enemy
 * its own targeting picks (melee-eligible: front row, or back once front is
 * empty) — not necessarily the exact unit the equipping character's own
 * Basic Action just hit; an accepted simplification rather than threading
 * the triggering hit's target through the trigger-resolution engine (see
 * specialActions.ts).
 */
export const EmberBurnAction: Action = {
  id: 'ember-burn',
  name: 'Ember Burn',
  reach: 'melee',
  selectTarget(context: TargetingContext) {
    return selectFirstEnemy(context, true);
  },
  resolve(context: ActionContext): ActionOutcome {
    applyBurn(context.target, EMBER_BURN_DAMAGE_PER_TICK, EMBER_BURN_TICKS);
    return { type: 'inflict-status', targetId: context.target.id, effectId: 'burn' };
  },
};
