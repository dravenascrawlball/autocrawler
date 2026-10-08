import type { Adventurer } from './adventurer';
import type { StatModifier } from './stats';

/**
 * Role synergies (roadmap item 6, in-run snowballing): having enough party
 * members of the listed roles grants a bonus that grows with the count —
 * recruiting toward one becomes a strategy as the party grows. Definitions
 * live in data/synergies.ts; this module only evaluates and applies them.
 * Recomputed at the start of every room (dungeonRun.ts's resolveNextRoom),
 * so mid-run recruits count immediately.
 */
export interface SynergyTier {
  /** Members of the synergy's roles needed for this tier. */
  count: number;
  stat: string;
  /** 'percent' for most stats; 'flat' for critChance, which is already a percentage. */
  type: 'percent' | 'flat';
  /** Bonus at this tier (replaces, not stacks with, lower tiers). */
  amount: number;
  /** Who gets it: only the synergy's own members, or the whole party. */
  target: 'members' | 'party';
}

export interface Synergy {
  id: string;
  name: string;
  roles: string[];
  /** Ascending by count. */
  tiers: SynergyTier[];
  /** Player-facing summary, e.g. "Fighters gain max HP". */
  description: string;
}

export interface ActiveSynergy {
  synergy: Synergy;
  /** How many party members currently fill its roles. */
  count: number;
  /** The highest tier reached, or null if below the first threshold. */
  tier: SynergyTier | null;
}

/** Every synergy any party member contributes to, with its member count and the tier reached (null if not yet active). */
export function evaluateSynergies(party: Adventurer[], synergies: Synergy[]): ActiveSynergy[] {
  return synergies
    .map((synergy) => {
      const count = party.filter((member) => synergy.roles.includes(member.role)).length;
      const reached = synergy.tiers.filter((tier) => count >= tier.count);
      return { synergy, count, tier: reached.at(-1) ?? null };
    })
    .filter((active) => active.count > 0);
}

const SYNERGY_SOURCE_PREFIX = 'synergy:';

/** Replaces every party member's synergy modifiers with the ones the party's current makeup earns. */
export function applySynergies(party: Adventurer[], synergies: Synergy[]): void {
  const active = evaluateSynergies(party, synergies).filter((entry) => entry.tier !== null);
  for (const member of party) {
    const earned: StatModifier[] = active
      .filter(({ synergy, tier }) => tier!.target === 'party' || synergy.roles.includes(member.role))
      .map(({ synergy, tier }) => ({
        stat: tier!.stat,
        type: tier!.type,
        amount: tier!.amount,
        source: `${SYNERGY_SOURCE_PREFIX}${synergy.id}`,
      }));
    member.modifiers = [...member.modifiers.filter((m) => !m.source.startsWith(SYNERGY_SOURCE_PREFIX)), ...earned];
  }
}
