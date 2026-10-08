/**
 * A combatant's position on their own side's 3x3 grid — `lane` (0=left,
 * 1=center, 2=right) and `rank` (0=front, closest to the opposing side; 2=
 * back). Both sides (party and enemies) have their own independent 3x3
 * grid; a unit's position only matters relative to its own side's lanes
 * (for adjacency — see isAdjacent) and the opposing side's ranks (for
 * melee/ranged reach — see actions/targeting.ts).
 */
export interface GridPosition {
  lane: 0 | 1 | 2;
  rank: 0 | 1 | 2;
}

/**
 * Legacy two-row shorthand — the two-row formation this grid replaces.
 * Kept so the many existing call sites that only ever cared about "front
 * vs back" (character/enemy templates, room authoring, the row-toggle UI)
 * keep working unchanged: 'front' resolves to {lane:1, rank:0}, 'back' to
 * {lane:1, rank:2} — see resolvePosition. New code that cares about lane
 * (adjacency, a future multi-character grid layout) uses GridPosition
 * directly instead.
 */
export type Row = 'front' | 'back';

/** Either the legacy shorthand or a real grid position — see createAdventurer. */
export type RowOrPosition = Row | GridPosition;

/** Normalizes `input` to a real GridPosition — a no-op if it already is one. */
export function resolvePosition(input: RowOrPosition): GridPosition {
  if (input === 'front') return { lane: 1, rank: 0 };
  if (input === 'back') return { lane: 1, rank: 2 };
  return input;
}

/** The legacy front/back label for `position` — rank 0 is 'front', anything else is 'back'. For UI/rendering that hasn't been reworked for the full 3-rank grid yet. */
export function toRowLabel(position: GridPosition): Row {
  return position.rank === 0 ? 'front' : 'back';
}

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

/**
 * Orthogonal (4-directional — up/down/left/right, no diagonals) adjacency
 * between two positions on the SAME side's grid. Intended for Special
 * Action triggers conditioned on grid position (e.g. "an adjacent ally") —
 * no trigger actually filters on this yet (see specialActions.ts), this is
 * foundation only, same spirit as step 1's trigger engine shipping ahead of
 * any character using it.
 */
export function isAdjacent(a: GridPosition, b: GridPosition): boolean {
  return Math.abs(a.lane - b.lane) + Math.abs(a.rank - b.rank) === 1;
}
