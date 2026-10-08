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

export type Lane = GridPosition['lane'];
export type Rank = GridPosition['rank'];

/** Whether `a` and `b` are the same cell. */
export function samePosition(a: GridPosition, b: GridPosition): boolean {
  return a.lane === b.lane && a.rank === b.rank;
}

/** Lane search order for auto-placement within a rank: center first, then left, then right. */
const AUTO_PLACE_LANE_ORDER: Lane[] = [1, 0, 2];

/**
 * The first free cell for auto-placing a unit that prefers `preferredRank`:
 * that rank first (center lane, then left, then right), then the other
 * ranks nearest-first (ties toward the front). Null only when all 9 cells
 * are taken.
 */
export function findFreeCell(occupied: GridPosition[], preferredRank: Rank): GridPosition | null {
  const ranks = ([0, 1, 2] as Rank[]).sort(
    (a, b) => Math.abs(a - preferredRank) - Math.abs(b - preferredRank) || a - b,
  );
  for (const rank of ranks) {
    for (const lane of AUTO_PLACE_LANE_ORDER) {
      const cell: GridPosition = { lane, rank };
      if (!occupied.some((position) => samePosition(position, cell))) return cell;
    }
  }
  return null;
}

/** Minimal shape the placement helpers below need — an Adventurer satisfies it, without this module importing adventurer.ts (which already imports this one). */
export interface Placeable {
  id: string;
  position: GridPosition;
}

/**
 * Enforces "one unit per cell" on `units` in place: the first unit in a
 * cell keeps it, and any later unit sharing it is moved to the nearest free
 * cell around its own rank (see findFreeCell). Called at the start of every
 * room (dungeonRun.ts's resolveNextRoom), so a party can never fight
 * stacked — covers saves from before positions were unique, and any recruit
 * who joined without being placed. Leaves a unit where it is only if all 9
 * cells are already taken.
 */
export function assignUniquePositions(units: Placeable[]): void {
  const taken: GridPosition[] = [];
  for (const unit of units) {
    if (taken.some((position) => samePosition(position, unit.position))) {
      const cell = findFreeCell(taken, unit.position.rank);
      if (cell) unit.position = cell;
    }
    taken.push(unit.position);
  }
}

/**
 * Drag-and-drop move: puts unit `id` into `cell`, never stacking two units.
 * `unplacedIds` is the tray (party members not on the grid yet — their
 * `position` is ignored until placed). Dropping onto an occupied cell swaps:
 * a unit dragged from the grid trades cells with the occupant; a unit
 * dragged from the tray sends the occupant back to the tray. Returns the
 * updated tray; mutates positions in place.
 */
export function moveToCell(units: Placeable[], unplacedIds: string[], id: string, cell: GridPosition): string[] {
  const unit = units.find((candidate) => candidate.id === id);
  if (!unit) return unplacedIds;

  const fromTray = unplacedIds.includes(id);
  const occupant = units.find(
    (candidate) => candidate.id !== id && !unplacedIds.includes(candidate.id) && samePosition(candidate.position, cell),
  );

  let tray = unplacedIds.filter((trayId) => trayId !== id);
  if (occupant) {
    if (fromTray) tray = [...tray, occupant.id];
    else occupant.position = unit.position;
  }
  unit.position = { ...cell };
  return tray;
}

/**
 * Auto-places every tray unit (in tray order) into the nearest free cell
 * around its current rank (its role default, or wherever it stood last
 * run) — what happens to anyone still in the tray when the player hits
 * Continue/Embark. Returns the now-empty tray.
 */
export function placeUnplaced(units: Placeable[], unplacedIds: string[]): string[] {
  const taken = units.filter((unit) => !unplacedIds.includes(unit.id)).map((unit) => unit.position);
  for (const id of unplacedIds) {
    const unit = units.find((candidate) => candidate.id === id);
    if (!unit) continue;
    const cell = findFreeCell(taken, unit.position.rank);
    if (cell) unit.position = cell;
    taken.push(unit.position);
  }
  return [];
}
