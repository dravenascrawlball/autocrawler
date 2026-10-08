import { describe, it, expect } from 'vitest';
import { KOBOLD_SKIRMISHER_TEMPLATE, GRUNT_TEMPLATE, BRUTE_TEMPLATE, SHAMAN_TEMPLATE } from './enemies';
import { createAdventurer } from '../sim/adventurer';

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

describe('enemy kit parity (Basic Action + Special Action — roadmap step 10)', () => {
  it('Kobold Skirmisher: Attack Nearest Basic Action, Opportunist (Attack Lowest HP) Special Action', () => {
    const skirmisher = createAdventurer('test', KOBOLD_SKIRMISHER_TEMPLATE, 'front');
    expect(skirmisher.basicAction.id).toBe('attack-nearest');
    expect(skirmisher.activeSpecialActions).toEqual([
      expect.objectContaining({ id: 'kobold-skirmisher-execute', trigger: 'on-turn-start' }),
    ]);
  });

  it('Grunt: Attack Nearest Basic Action, Heavy Swing (Power Attack) Special Action', () => {
    const grunt = createAdventurer('test', GRUNT_TEMPLATE, 'front');
    expect(grunt.basicAction.id).toBe('attack-nearest');
    expect(grunt.activeSpecialActions).toEqual([expect.objectContaining({ id: 'grunt-power-attack', trigger: 'on-turn-start' })]);
  });

  it('Brute: Cleave Basic Action, no Special Action', () => {
    const brute = createAdventurer('test', BRUTE_TEMPLATE, 'front');
    expect(brute.basicAction.id).toBe('cleave');
    expect(brute.activeSpecialActions).toEqual([]);
  });

  it('Shaman: Heal Basic Action, Lash Out (Attack Nearest) Special Action', () => {
    const shaman = createAdventurer('test', SHAMAN_TEMPLATE, 'front');
    expect(shaman.basicAction.id).toBe('heal');
    expect(shaman.activeSpecialActions).toEqual([expect.objectContaining({ id: 'shaman-attack', trigger: 'on-turn-start' })]);
  });
});
