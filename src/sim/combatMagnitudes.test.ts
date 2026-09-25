import { describe, it, expect } from 'vitest';
import { CHARACTER_TEMPLATES } from '../data/characters';
import { KOBOLD_SKIRMISHER_TEMPLATE, GRUNT_TEMPLATE, BRUTE_TEMPLATE, SHAMAN_TEMPLATE } from '../data/enemies';
import { MIN_HIT_CHANCE, MAX_HIT_CHANCE, MIN_DAMAGE_AFTER_ARMOR } from './actions/attack';

/**
 * Not part of the regular suite — a dev tool for the balance pass (roadmap
 * item 6), skipped unless BALANCE_SIM is set. Analytical (no RNG/simulation
 * needed — hit chance and armor mitigation are both plain formulas), unlike
 * balanceSim.test.ts which measures whole-run outcomes. Run directly:
 *   BALANCE_SIM=1 npx vitest run src/sim/combatMagnitudes.test.ts --reporter=verbose
 *
 * Covers the full current roster/enemy list (14 characters, all 4 enemy
 * templates) — previously hardcoded to just 4 characters and 3 enemies
 * from before roadmap items 3/4 (character differentiation, enemy
 * variety) landed, which silently left most of the cast unreported.
 */
const ARCHETYPES = CHARACTER_TEMPLATES;
const ENEMIES = [KOBOLD_SKIRMISHER_TEMPLATE, GRUNT_TEMPLATE, BRUTE_TEMPLATE, SHAMAN_TEMPLATE];

/** Mirrors sim/actions/attack.ts's private hitChance formula exactly. */
function hitChance(accuracy: number, evasion: number): number {
  return Math.min(MAX_HIT_CHANCE, Math.max(MIN_HIT_CHANCE, (accuracy - evasion) / 100));
}

describe.skipIf(!process.env.BALANCE_SIM)('combat RNG magnitudes (analytical)', () => {
  it('reports hit chance for every archetype/enemy pairing, both directions', () => {
    console.log('\n--- Hit chance: party archetype attacking enemy ---');
    for (const attacker of ARCHETYPES) {
      for (const defender of ENEMIES) {
        const chance = hitChance(attacker.accuracy!, defender.evasion!);
        console.log(`  ${attacker.name} -> ${defender.name}: ${(chance * 100).toFixed(0)}%`);
      }
    }

    console.log('\n--- Hit chance: enemy attacking party archetype ---');
    for (const attacker of ENEMIES) {
      for (const defender of ARCHETYPES) {
        const chance = hitChance(attacker.accuracy!, defender.evasion!);
        console.log(`  ${attacker.name} -> ${defender.name}: ${(chance * 100).toFixed(0)}%`);
      }
    }

    expect(true).toBe(true);
  });

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
