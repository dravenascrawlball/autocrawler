import { describe, it, expect } from 'vitest';
import { hasTag, TAG_REGISTRY } from './tags';

describe('hasTag', () => {
  it('is true when the unit carries the tag', () => {
    expect(hasTag({ tags: ['bunny'] }, 'bunny')).toBe(true);
  });

  it('is false when the unit does not carry the tag', () => {
    expect(hasTag({ tags: ['elf'] }, 'bunny')).toBe(false);
  });

  it('is false for a unit with no tags at all', () => {
    expect(hasTag({ tags: [] }, 'bunny')).toBe(false);
  });
});

describe('TAG_REGISTRY', () => {
  it('has a matching key/id for every entry', () => {
    for (const [key, tag] of Object.entries(TAG_REGISTRY)) {
      expect(tag.id).toBe(key);
    }
  });
});
