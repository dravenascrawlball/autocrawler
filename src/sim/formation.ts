/**
 * Which line a combatant fights from. Replaces the old grid-position/
 * movement system entirely (roadmap item 7's follow-up): melee actions can
 * only reach the front row (falling through to back once front has no
 * living members — see actions/targeting.ts), ranged actions can reach
 * either row directly. Symmetric for both party and enemies.
 */
export type Row = 'front' | 'back';

/** Roles that default to the back row (ranged/support-leaning archetypes) when a character template doesn't set its own `defaultRow` override — see resolveDefaultRow. Front is the fallback for everyone else (Fighter, Rogue, and anything unlisted). */
const BACK_ROW_DEFAULT_ROLES = new Set(['Healer', 'Mage', 'Tactician', 'Ranger']);

/** Minimal shape resolveDefaultRow needs — matches AdventurerTemplate's `role`/`defaultRow` fields without importing sim/adventurer.ts (which already imports this module). */
export interface RowDefaultSource {
  role?: string;
  defaultRow?: Row;
}

/**
 * A character's starting formation row before the player ever touches
 * Formation: `template.defaultRow` if set (an explicit per-character
 * exception — e.g. Isilwen, a Rogue who plays fully ranged despite Rogue
 * otherwise defaulting front), otherwise a role-based fallback. Once the
 * player reassigns a recruited character's row, that choice persists
 * across runs (see adventurer.ts's resetToTemplateBaseline) — this only
 * decides the very first row a character ever gets.
 */
export function resolveDefaultRow(template: RowDefaultSource): Row {
  return template.defaultRow ?? (template.role && BACK_ROW_DEFAULT_ROLES.has(template.role) ? 'back' : 'front');
}
