import type { Action, ActionContext, ActionId, ActionOutcome, TargetingContext } from '../action';
import { selectLowestHpAlly } from './targeting';
import { getEffectiveStat } from '../stats';
import { actionLevelPercentBonus } from '../leveling';
import { getHealEnergy } from '../battle';

const HEAL_THRESHOLD_FRACTION = 0.5;

/**
 * Heals the lowest-HP living ally (including self), unconditionally — no
 * 50%-HP gate, unlike SelfHealAction below. Previously required the target
 * be below HEAL_THRESHOLD_FRACTION, which made this stall (no valid
 * target, a wasted turn) far more often than intended for a kit built
 * around it — see the balance pass's balanceSim.test.ts output for Mira
 * (roadmap item 3), whose 2 Heal faces landed a real heal only ~30% of
 * the times they were rolled. Dropped the gate rather than adding a
 * second, Mira-only action, since nothing else needed the gated version
 * to stay this way. The Shaman enemy also uses this action (data/
 * enemies.ts) — its healing is correspondingly now more reliable too; see
 * that template's own doc comment for the sustain-loop risk this
 * reintroduces, and re-run the balance sim after any Shaman number change
 * meant to offset it.
 */
export const HealAction: Action = {
  id: 'heal',
  name: 'Heal',
  reach: 'ranged', // unused — Heal targets an ally, never the opposing roster
  selectTarget(context: TargetingContext) {
    return selectLowestHpAlly(context);
  },
  resolve(context: ActionContext): ActionOutcome {
    return resolveHeal(context, 'heal');
  },
};

function resolveHeal(context: ActionContext, actionId: ActionId): ActionOutcome {
  const base = getEffectiveStat(context.actor.healPower, 'healPower', context.actor.modifiers);
  const levelBonusPercent = actionLevelPercentBonus(context.actor, actionId);
  const amount = Math.round(base * (1 + levelBonusPercent / 100));
  const effectiveMaxHp = getEffectiveStat(context.target.maxHp, 'maxHp', context.target.modifiers);
  context.target.hp = Math.min(effectiveMaxHp, context.target.hp + amount);
  return { type: 'heal', amount, targetId: context.target.id };
}

/**
 * Bodil's signature small self-heal (roadmap item 11) — only ever targets
 * herself, and only once she's actually hurt, gated on
 * HEAL_THRESHOLD_FRACTION. Deliberately still gated even though plain
 * HealAction above no longer is (roadmap item 5's balance pass) — a rare
 * backup face on an otherwise-melee Fighter is meant to stay a
 * conditional "only when it matters" safety net, unlike Mira's kit, which
 * leans on reliable healing as its own selling point.
 */
export const SelfHealAction: Action = {
  id: 'self-heal',
  name: 'Self-Heal',
  reach: 'melee', // unused — always targets the actor itself
  selectTarget(context: TargetingContext) {
    const { actor } = context;
    const effectiveMaxHp = getEffectiveStat(actor.maxHp, 'maxHp', actor.modifiers);
    return actor.hp > 0 && actor.hp / effectiveMaxHp < HEAL_THRESHOLD_FRACTION ? actor : null;
  },
  resolve(context: ActionContext): ActionOutcome {
    return resolveHeal(context, 'self-heal');
  },
};

/** Mending Charge energy gained per roll, regardless of whether it actually heals anyone — placeholder pending the balance pass. */
export const MENDING_CHARGE_ENERGY_PER_ROLL = 1;

/**
 * Dawneth's signature mechanic (roadmap item 11): unlike plain Heal, this
 * always resolves — selectTarget picks the lowest-HP living ally
 * unconditionally (never null just because nobody's hurt), so the face is
 * never an idle roll. Actual healing only happens if that ally is below
 * HEAL_THRESHOLD_FRACTION (amount is 0 otherwise); Mending Charge energy
 * is granted every time regardless — see battle.ts's healEnergyByUnitId.
 */
export const MendingChargeAction: Action = {
  id: 'mending-charge',
  name: 'Mending Charge',
  reach: 'ranged', // unused — targets an ally, never the opposing roster
  selectTarget(context: TargetingContext) {
    return selectLowestHpAlly(context);
  },
  resolve(context: ActionContext): ActionOutcome {
    const effectiveMaxHp = getEffectiveStat(context.target.maxHp, 'maxHp', context.target.modifiers);
    const needsHealing = context.target.hp / effectiveMaxHp < HEAL_THRESHOLD_FRACTION;
    let amount = 0;
    if (needsHealing) {
      const heal = resolveHeal(context, 'mending-charge');
      amount = heal.type === 'heal' ? heal.amount : 0;
    }

    const totalEnergy = getHealEnergy(context.battle, context.actor.id) + MENDING_CHARGE_ENERGY_PER_ROLL;
    context.battle.healEnergyByUnitId[context.actor.id] = totalEnergy;

    return {
      type: 'heal-and-charge',
      amount,
      targetId: context.target.id,
      energyGained: MENDING_CHARGE_ENERGY_PER_ROLL,
      totalEnergy,
    };
  },
};
