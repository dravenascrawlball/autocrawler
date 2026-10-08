export type StatModifierType = 'flat' | 'percent';

export interface StatModifier {
  stat: string;
  type: StatModifierType;
  amount: number;
  source: string;
}

/**
 * Applies all flat modifiers to `base` first, then applies the sum of all
 * percent modifiers as a single final multiplier (amount is percentage
 * points, e.g. 20 means +20%).
 */
export function getEffectiveStat(base: number, stat: string, modifiers: StatModifier[]): number {
  const relevant = modifiers.filter((m) => m.stat === stat);

  const flatSum = relevant
    .filter((m) => m.type === 'flat')
    .reduce((sum, m) => sum + m.amount, 0);

  const percentSum = relevant
    .filter((m) => m.type === 'percent')
    .reduce((sum, m) => sum + m.amount, 0);

  const value = (base + flatSum) * (1 + percentSum / 100);
  // HP is always a whole number — an unrounded percent maxHp modifier (e.g. a +15% relic on 25 base)
  // used to leak fractions into HP via heal caps, showing up as "27.500000000000004/25".
  return stat === 'maxHp' ? Math.round(value) : value;
}
