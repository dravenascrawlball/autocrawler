import type { CharacterPoolEntry } from '../sim/characterPool';
import { THARAVEL_RALLY_CRY_SPECIAL, DRIFTA_ADRENALINE_RUSH_SPECIAL } from './specialActions';

/**
 * Meta-progression: additional Special Action/Trait pool candidates a
 * character has access to once unlocked, merged into their template's own
 * pool at join/reset time (see sim/adventurer.ts's createAdventurer /
 * resetToTemplateBaseline). Keyed by character name (matches
 * AdventurerTemplate.name, not an id — a character has exactly one
 * template, so the name is a stable, human-readable key).
 *
 * Unlock condition: a character becomes eligible for their entry here once
 * state/runHistory.ts's clearedWithIds contains them (first run cleared
 * with that character in the party) — see
 * state/dungeonOrchestrator.ts's unlockedPoolEntriesFor. Proof-of-concept
 * scale (2 characters) rather than a full content pass across all 15 — see
 * data/specialActions.ts's own doc comment on these two entries.
 */
export const CHARACTER_UNLOCK_POOL: Record<string, CharacterPoolEntry[]> = {
  Tharavel: [{ kind: 'special-action', specialAction: THARAVEL_RALLY_CRY_SPECIAL }],
  Drifta: [{ kind: 'special-action', specialAction: DRIFTA_ADRENALINE_RUSH_SPECIAL }],
};
