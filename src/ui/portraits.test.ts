import { describe, it, expect } from 'vitest';
import { portraitCandidates, bodySpriteCandidates, downedArtCandidates } from './portraits';

describe('Kit-aware art candidates', () => {
  const base = { archetype: 'Bodil' };
  const kitted = { archetype: 'Bodil', activeKit: { artKey: 'bodil-fur-and-fury' } };

  it('tries the Kit portrait first, then falls back to the base portrait', () => {
    expect(portraitCandidates(kitted, 'town')).toEqual([
      '/portraits/bodil-fur-and-fury-town.png',
      '/portraits/bodil-fur-and-fury-idle.png',
      '/portraits/bodil-town.png',
      '/portraits/bodil-idle.png',
    ]);
    expect(portraitCandidates(base, 'town')).toEqual(['/portraits/bodil-town.png', '/portraits/bodil-idle.png']);
  });

  it('tries the Kit body sprite, then the base sprite, then the generic stand-in', () => {
    expect(bodySpriteCandidates(kitted, 'party')).toEqual([
      '/sprites/adventurers/bodil-fur-and-fury.png',
      '/sprites/adventurers/bodil.png',
      '/sprites/adventurers/default_adventurer.png',
    ]);
  });

  it('ends the downed-art chain on the base idle portrait', () => {
    expect(downedArtCandidates(kitted, null).at(-1)).toBe('/portraits/bodil-idle.png');
  });
});
