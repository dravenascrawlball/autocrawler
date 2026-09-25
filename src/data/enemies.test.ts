import { describe, it, expect } from 'vitest';
import { KOBOLD_SKIRMISHER_TEMPLATE, GRUNT_TEMPLATE, BRUTE_TEMPLATE } from './enemies';

function countByActionId(template: { dieFaces: { action: { id: string } }[] }): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const face of template.dieFaces) {
    counts[face.action.id] = (counts[face.action.id] ?? 0) + 1;
  }
  return counts;
}

describe('single-action enemies now mix in a second action (roadmap item 4)', () => {
  it('Kobold Skirmisher: mostly Attack Nearest, a couple of Attack (Lowest HP) faces', () => {
    expect(countByActionId(KOBOLD_SKIRMISHER_TEMPLATE)).toEqual({
      'attack-nearest': 4,
      'attack-lowest-hp': 2,
    });
    expect(KOBOLD_SKIRMISHER_TEMPLATE.dieFaces).toHaveLength(6);
  });

  it('Grunt: mostly Attack Nearest, a couple of Power Attack faces', () => {
    expect(countByActionId(GRUNT_TEMPLATE)).toEqual({
      'attack-nearest': 4,
      'power-attack': 2,
    });
    expect(GRUNT_TEMPLATE.dieFaces).toHaveLength(6);
  });

  it('Brute: mostly Attack Nearest, a couple of Cleave faces', () => {
    expect(countByActionId(BRUTE_TEMPLATE)).toEqual({
      'attack-nearest': 4,
      cleave: 2,
    });
    expect(BRUTE_TEMPLATE.dieFaces).toHaveLength(6);
  });
});
