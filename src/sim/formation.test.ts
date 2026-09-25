import { describe, it, expect } from 'vitest';
import { resolveDefaultRow } from './formation';

describe('resolveDefaultRow', () => {
  it('defaults Fighter (and any unlisted/missing role) to front', () => {
    expect(resolveDefaultRow({ role: 'Fighter' })).toBe('front');
    expect(resolveDefaultRow({ role: 'Rogue' })).toBe('front');
    expect(resolveDefaultRow({})).toBe('front');
  });

  it('defaults Healer, Mage, Tactician, and Ranger to back', () => {
    expect(resolveDefaultRow({ role: 'Healer' })).toBe('back');
    expect(resolveDefaultRow({ role: 'Mage' })).toBe('back');
    expect(resolveDefaultRow({ role: 'Tactician' })).toBe('back');
    expect(resolveDefaultRow({ role: 'Ranger' })).toBe('back');
  });

  it('an explicit defaultRow overrides the role-based fallback', () => {
    expect(resolveDefaultRow({ role: 'Rogue', defaultRow: 'back' })).toBe('back');
    expect(resolveDefaultRow({ role: 'Healer', defaultRow: 'front' })).toBe('front');
  });
});
