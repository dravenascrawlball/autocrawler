import type { Action, ActionOutcome, TargetingContext } from '../action';
import { getOwnRoster } from '../battle';
import { getEffectiveStat } from '../stats';
import type { Adventurer } from '../adventurer';

/**
 * Below this fraction, the acting adventurer's own party (self included) is
 * considered to be in enough trouble to bail. Placeholder pending the
 * balance pass (roadmap item 6) — the roadmap also calls out other trigger
 * shapes (e.g. "N party members downed") as worth adding as alternatives
 * later, not replacements.
 */
export const RETREAT_PARTY_HP_THRESHOLD_FRACTION = 0.3;

/** Average HP ratio (current/max) across `party`, including downed members (hp 0 counts against the average). */
function averageHpRatio(party: Adventurer[]): number {
  const ratios = party.map((member) => {
    const effectiveMaxHp = getEffectiveStat(member.maxHp, 'maxHp', member.modifiers);
    return member.hp / effectiveMaxHp;
  });
  return ratios.reduce((sum, ratio) => sum + ratio, 0) / ratios.length;
}

/**
 * Party-wide safety valve: valid only once the acting adventurer's own
 * party's average HP ratio drops below RETREAT_PARTY_HP_THRESHOLD_FRACTION.
 * Targets the actor itself (no ally/enemy needed) — resolving it ends the
 * room for the whole party via the 'retreat' ActionOutcome, not just the
 * actor (see turnEngine.ts / battle.ts's triggerRetreat).
 */
export const RetreatAction: Action = {
  id: 'retreat',
  name: 'Retreat',
  reach: 'ranged', // unused — Retreat targets the actor itself, never the opposing roster
  selectTarget(context: TargetingContext) {
    const ownParty = getOwnRoster(context.battle, context.actor);
    return averageHpRatio(ownParty) < RETREAT_PARTY_HP_THRESHOLD_FRACTION ? context.actor : null;
  },
  resolve(): ActionOutcome {
    return { type: 'retreat' };
  },
};
