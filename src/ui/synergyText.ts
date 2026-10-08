import type { Adventurer } from '../sim/adventurer';
import { evaluateSynergies, type ActiveSynergy, type SynergyTier } from '../sim/synergies';
import { SYNERGIES } from '../data/synergies';

const STAT_LABELS: Record<string, string> = {
  maxHp: 'max HP',
  attackPower: 'attack',
  healPower: 'healing',
  critChance: 'crit chance',
};

/** e.g. "+10% max HP (members)" / "+10 crit chance" / "+8% attack (whole party)". */
export function tierText(tier: SynergyTier): string {
  const amount = tier.type === 'percent' ? `+${tier.amount}%` : `+${tier.amount}`;
  const who = tier.target === 'party' ? ' (whole party)' : '';
  return `${amount} ${STAT_LABELS[tier.stat] ?? tier.stat}${who}`;
}

/** Synergies `party` contributes to, for the synergy panel (ui/SynergyPanel.svelte). */
export function partySynergies(party: Adventurer[]): ActiveSynergy[] {
  return evaluateSynergies(party, SYNERGIES);
}

/** One tooltip line saying which synergy recruiting `candidate` would add to, and what it would reach — empty if none. */
export function recruitSynergyLine(candidate: Adventurer, party: Adventurer[]): string {
  if (party.some((member) => member.id === candidate.id)) return '';
  const synergy = SYNERGIES.find((entry) => entry.roles.includes(candidate.role));
  if (!synergy) return '';
  const before = party.filter((member) => synergy.roles.includes(member.role)).length;
  const after = before + 1;
  const reached = synergy.tiers.filter((tier) => after >= tier.count).at(-1);
  const newlyReached = reached && before < reached.count;
  return newlyReached
    ? `${synergy.name} ${after}/${reached.count}: activates ${tierText(reached)}`
    : `${synergy.name}: ${after} in party`;
}
