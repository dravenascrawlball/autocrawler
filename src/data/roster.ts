import { createAdventurer, type Adventurer } from '../sim/adventurer';
import { resolveDefaultRow } from '../sim/formation';
import { CHARACTER_TEMPLATES } from './characters';
import { UNIVERSAL_TRAIT_POOL } from './traits';

/**
 * One persistent record per unlocked character — the roguelite draft
 * rework's roster (see state/roster.ts's RosterState). Nobody starts
 * recruited; the very first Embark is a pure draft with no substitute
 * option available yet. Each character's starting row comes from
 * resolveDefaultRow (role-based, with per-character overrides — see
 * AdventurerTemplate.defaultRow), so a fresh mage/healer doesn't start
 * front-line; player-reassignable afterward via the Formation view, and
 * that choice persists across runs once made. Rolls each character's
 * universal Traits too (see data/traits.ts's UNIVERSAL_TRAIT_POOL) —
 * empty today, so this is a no-op until that pool gets real content.
 */
export function createStarterRoster(): Adventurer[] {
  return CHARACTER_TEMPLATES.filter((template) => template.unlocked ?? true).map((template) =>
    createAdventurer(template.name.toLowerCase(), template, resolveDefaultRow(template), [], [], UNIVERSAL_TRAIT_POOL),
  );
}
