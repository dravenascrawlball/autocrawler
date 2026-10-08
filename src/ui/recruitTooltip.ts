import type { Adventurer } from '../sim/adventurer';
import { ACTION_DESCRIPTIONS } from './actionDescriptions';

/**
 * Tooltip text for a recruit offer (the unlock content pass): exactly what
 * this character brings if recruited now — every active Special Action
 * (always-on and this run's random pool draw), their Traits, and their Kit.
 * Accurate because the pool draw already happened when the offer was
 * rolled (see state/progression.ts's rerollOfferedCharacters).
 */
export function recruitTooltip(adventurer: Adventurer): string {
  const lines = adventurer.activeSpecialActions.map((special) => {
    const description = ACTION_DESCRIPTIONS[special.action.id];
    return description ? `Special: ${special.name} — ${description}` : `Special: ${special.name}`;
  });
  if (adventurer.traits.length > 0) {
    lines.push(`Traits: ${adventurer.traits.map((trait) => trait.name).join(', ')}`);
  }
  if (adventurer.activeKit) {
    lines.push(`Kit: ${adventurer.activeKit.name}`);
  }
  return lines.length > 0 ? lines.join('\n') : 'No Special Action.';
}
