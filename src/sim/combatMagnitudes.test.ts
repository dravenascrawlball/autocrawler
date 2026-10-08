import { describe, it, expect } from 'vitest';
import { KOBOLD_SKIRMISHER_TEMPLATE, GRUNT_TEMPLATE, BRUTE_TEMPLATE, SHAMAN_TEMPLATE } from '../data/enemies';
import { MIN_DAMAGE_AFTER_ARMOR } from './actions/attack';

/**
 * Not part of the regular suite — a dev tool for the balance pass (roadmap
 * item 6), skipped unless BALANCE_SIM is set. Analytical (no RNG/simulation
 * needed — armor mitigation is a plain formula), unlike balanceSim.test.ts
 * which measures whole-run outcomes. Run directly:
 *   BALANCE_SIM=1 npx vitest run src/sim/combatMagnitudes.test.ts --reporter=verbose
 *
 * Used to also report hit chance for every archetype/enemy pairing —
 * removed along with Accuracy/Evasion as baseline stats (the "pure
 * auto-battler" pass, see docs/roadmap.md); every attack always connects
 * now, so there's nothing left to report there.
 */
const ENEMIES = [KOBOLD_SKIRMISHER_TEMPLATE, GRUNT_TEMPLATE, BRUTE_TEMPLATE, SHAMAN_TEMPLATE];

describe.skipIf(!process.env.BALANCE_SIM)('combat RNG magnitudes (analytical)', () => {
  it("reports armor's damage mitigation as a % of each enemy's average landed hit", () => {
    console.log("\n--- Armor mitigation vs each enemy's average hit damage (variance averages out to base) ---");
    for (const enemy of ENEMIES) {
      const avgHit = enemy.attackPower!;
      const row = [0, 1, 2, 3, 4].map((armor) => {
        const mitigated = Math.max(MIN_DAMAGE_AFTER_ARMOR, Math.round(avgHit - armor));
        const pct = (100 * (1 - mitigated / avgHit)).toFixed(0);
        return `armor ${armor}: ${mitigated} dmg (-${pct}%)`;
      });
      console.log(`  ${enemy.name} (avg ${avgHit} dmg/hit): ${row.join(', ')}`);
    }

    expect(true).toBe(true);
  });
});
