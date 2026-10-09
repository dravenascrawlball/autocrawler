/**
 * Closed registry (see docs/kit-trait-tag-framework.md) — every Tag a
 * Kit/Trait/template grants must be a case here, so two characters can
 * never accidentally use near-synonym strings ('bunny' vs 'rabbit') for
 * what was meant to be the same synergy. Add a case whenever a new
 * character/Kit/Trait needs a new tag; this seed set is illustrative
 * (drawn from the framework doc's own examples), not real content yet —
 * no current character/Kit/Trait grants any of these.
 */
export type TagId =
  | 'bunny'
  | 'elf'
  | 'tank'
  | 'fire'
  | 'redhead'
  | 'long-legs'
  | 'goblin-hater'
  // Creature tags (Quirks pass) — what targeting Quirks like Goblin Hater/Demonbane hunt.
  | 'goblin'
  | 'kobold'
  | 'demon'
  | 'undead'
  | 'brute'
  | 'beast';

export type TagCategory = 'species' | 'archetype' | 'element' | 'physical' | 'personality' | 'other';

/**
 * Display metadata only — `category` groups tags for the character sheet
 * (see docs/kit-trait-tag-framework.md's Display section) and has no
 * effect on tag matching or Aura evaluation. A tag can be pure flavor
 * today (e.g. 'redhead') and pick up a mechanical hook later (an Aura or
 * ability that checks for it) without changing shape.
 */
export interface Tag {
  id: TagId;
  name: string;
  category: TagCategory;
}

export const TAG_REGISTRY: Record<TagId, Tag> = {
  bunny: { id: 'bunny', name: 'Bunny', category: 'species' },
  elf: { id: 'elf', name: 'Elf', category: 'species' },
  tank: { id: 'tank', name: 'Tank', category: 'archetype' },
  fire: { id: 'fire', name: 'Fire', category: 'element' },
  redhead: { id: 'redhead', name: 'Redhead', category: 'physical' },
  'long-legs': { id: 'long-legs', name: 'Long Legs', category: 'physical' },
  'goblin-hater': { id: 'goblin-hater', name: 'Goblin Hater', category: 'personality' },
  goblin: { id: 'goblin', name: 'Goblin', category: 'species' },
  kobold: { id: 'kobold', name: 'Kobold', category: 'species' },
  demon: { id: 'demon', name: 'Demon', category: 'species' },
  undead: { id: 'undead', name: 'Undead', category: 'species' },
  brute: { id: 'brute', name: 'Brute', category: 'species' },
  beast: { id: 'beast', name: 'Beast', category: 'species' },
};

/** Whether `unit.tags` includes `tagId` — the standard check an ability/Aura uses instead of reading `.tags` directly. */
export function hasTag(unit: { tags: TagId[] }, tagId: TagId): boolean {
  return unit.tags.includes(tagId);
}
