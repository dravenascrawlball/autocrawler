import type { Adventurer } from '../sim/adventurer';
import type { ActionId } from '../sim/action';
import type { DieFace } from '../sim/dieFace';
import type { EnchantmentId } from '../sim/enchantments';
import { ACTION_REGISTRY } from '../data/actions';
import type { RoomDefinition } from '../sim/dungeonRun';
import type { TownStorage } from '../sim/townStorage';
import type { RecruitCandidate } from '../sim/recruitment';
import type { RosterState } from './roster';
import type { ActiveDungeonRunState } from './activeRun';
import type { RunHistoryState } from './runHistory';

const STORAGE_KEY = 'autocrawler:save';

/**
 * Bumped whenever SerializedGameState's shape changes. Lives on the
 * serialized form, not the in-memory GameState — versioning is a save-format
 * concern, not something the rest of the app should carry around.
 *
 * This version is the roguelite draft/recruitment rework's baseline — the
 * whole prior migration chain (v1 through v11, preserved in git history if
 * ever needed) was deleted rather than extended: the rework drops concepts
 * (Tired/Injured/Lost status, a standing active-party selection) that have
 * no equivalent to migrate a pre-rework save's data *into*. Any save below
 * this version is simply treated as incompatible (see loadGame) — a
 * deliberate call for this solo dev/test project, not an oversight.
 *
 * v13: ActiveDungeonRunState gained `partyGold`/`outcome` (run-resume
 * support — see state/dungeonPlayback.ts's resumeFromSave).
 * v14: added `runHistory` (per-character "cleared a run" tracking — see
 * state/runHistory.ts, a foundation for future achievements/branching
 * paths).
 */
const CURRENT_SAVE_VERSION = 14;

export interface GameState {
  roster: RosterState;
  /** Includes town gold (townStorage.gold) alongside items — see sim/townStorage.ts. */
  townStorage: TownStorage;
  dayCount: number;
  /** null when no dungeon run is currently in progress. */
  activeRun: ActiveDungeonRunState | null;
  recruitmentPool: RecruitCandidate[];
  runHistory: RunHistoryState;
}

/** A DieFace with its action narrowed to a plain id — see SerializedAdventurer. */
type SerializedDieFace = { actionId: ActionId; enchantmentId?: EnchantmentId };

/**
 * An Adventurer with `dieFaces`/`ownedFaces` narrowed to plain ids — JSON
 * can't carry function values (selectTarget/resolve on an Action), so
 * they're resolved back through ACTION_REGISTRY on load instead of being
 * serialized.
 */
type SerializedAdventurer = Omit<Adventurer, 'dieFaces' | 'ownedFaces'> & {
  dieFaces: SerializedDieFace[];
  ownedFaces: ActionId[];
};

interface SerializedRoomDefinition extends Omit<RoomDefinition, 'enemies'> {
  enemies: SerializedAdventurer[];
}

interface SerializedActiveRun extends Omit<ActiveDungeonRunState, 'rooms'> {
  rooms: SerializedRoomDefinition[];
}

interface SerializedRecruitCandidate extends Omit<RecruitCandidate, 'adventurer'> {
  adventurer: SerializedAdventurer;
}

interface SerializedGameState {
  version: number;
  roster: { adventurers: SerializedAdventurer[]; recruitedIds: string[] };
  townStorage: TownStorage;
  dayCount: number;
  activeRun: SerializedActiveRun | null;
  recruitmentPool: SerializedRecruitCandidate[];
  runHistory: RunHistoryState;
}

function serializeDieFace(face: DieFace): SerializedDieFace {
  return face.enchantmentId ? { actionId: face.action.id, enchantmentId: face.enchantmentId } : { actionId: face.action.id };
}

function deserializeDieFace(serialized: SerializedDieFace): DieFace {
  const action = ACTION_REGISTRY[serialized.actionId];
  return serialized.enchantmentId ? { action, enchantmentId: serialized.enchantmentId } : { action };
}

function serializeAdventurer(adventurer: Adventurer): SerializedAdventurer {
  const { dieFaces, ownedFaces, ...rest } = adventurer;
  return {
    ...rest,
    dieFaces: dieFaces.map(serializeDieFace),
    ownedFaces: ownedFaces.map((action) => action.id),
  };
}

function deserializeAdventurer(serialized: SerializedAdventurer): Adventurer {
  const { dieFaces, ownedFaces, ...rest } = serialized;
  return {
    ...rest,
    dieFaces: dieFaces.map(deserializeDieFace),
    ownedFaces: ownedFaces.map((id) => ACTION_REGISTRY[id]),
  };
}

function serializeRoom(room: RoomDefinition): SerializedRoomDefinition {
  return { ...room, enemies: room.enemies.map(serializeAdventurer) };
}

function deserializeRoom(room: SerializedRoomDefinition): RoomDefinition {
  return { ...room, enemies: room.enemies.map(deserializeAdventurer) };
}

function serializeCandidate(candidate: RecruitCandidate): SerializedRecruitCandidate {
  return { ...candidate, adventurer: serializeAdventurer(candidate.adventurer) };
}

function deserializeCandidate(candidate: SerializedRecruitCandidate): RecruitCandidate {
  return { ...candidate, adventurer: deserializeAdventurer(candidate.adventurer) };
}

function serializeGameState(state: GameState): SerializedGameState {
  return {
    version: CURRENT_SAVE_VERSION,
    roster: {
      adventurers: state.roster.adventurers.map(serializeAdventurer),
      recruitedIds: [...state.roster.recruitedIds],
    },
    townStorage: state.townStorage,
    dayCount: state.dayCount,
    activeRun: state.activeRun
      ? { ...state.activeRun, rooms: state.activeRun.rooms.map(serializeRoom) }
      : null,
    recruitmentPool: state.recruitmentPool.map(serializeCandidate),
    runHistory: { clearedWithIds: [...state.runHistory.clearedWithIds] },
  };
}

function deserializeGameState(raw: SerializedGameState): GameState {
  return {
    roster: {
      adventurers: raw.roster.adventurers.map(deserializeAdventurer),
      recruitedIds: [...raw.roster.recruitedIds],
    },
    townStorage: raw.townStorage,
    dayCount: raw.dayCount,
    activeRun: raw.activeRun ? { ...raw.activeRun, rooms: raw.activeRun.rooms.map(deserializeRoom) } : null,
    recruitmentPool: raw.recruitmentPool.map(deserializeCandidate),
    runHistory: { clearedWithIds: [...raw.runHistory.clearedWithIds] },
  };
}

/** Shallow structural check — enough to treat a corrupt/foreign save as "no save" rather than crash. */
function isValidSerializedGameState(value: unknown): value is SerializedGameState {
  if (!value || typeof value !== 'object') {
    return false;
  }
  const state = value as Record<string, unknown>;

  if (typeof state.version !== 'number') return false;

  if (!state.roster || typeof state.roster !== 'object') return false;
  const roster = state.roster as Record<string, unknown>;
  if (!Array.isArray(roster.adventurers) || !Array.isArray(roster.recruitedIds)) return false;

  if (!state.townStorage || typeof state.townStorage !== 'object') return false;
  if (!Array.isArray((state.townStorage as Record<string, unknown>).items)) return false;
  if (typeof (state.townStorage as Record<string, unknown>).gold !== 'number') return false;

  if (typeof state.dayCount !== 'number') return false;
  if (state.activeRun !== null && typeof state.activeRun !== 'object') return false;
  if (!Array.isArray(state.recruitmentPool)) return false;

  if (!state.runHistory || typeof state.runHistory !== 'object') return false;
  if (!Array.isArray((state.runHistory as Record<string, unknown>).clearedWithIds)) return false;

  return true;
}

/**
 * Serializes the full game state to a single localStorage key. Best-effort:
 * localStorage can throw (private browsing, quota exceeded, disabled
 * storage), so failures are swallowed rather than crashing the caller.
 */
export function saveGame(state: GameState, storage: Storage = globalThis.localStorage): void {
  try {
    storage.setItem(STORAGE_KEY, JSON.stringify(serializeGameState(state)));
  } catch {
    // Saving is best-effort; nothing meaningful to recover to here.
  }
}

/**
 * Loads the game state saved by `saveGame`. Returns null if there's no
 * save, if localStorage is unavailable/throws, if the stored JSON fails to
 * parse or doesn't look like a valid save, or if it predates
 * CURRENT_SAVE_VERSION (see that constant's doc comment for why old saves
 * are discarded rather than migrated) — all treated the same as a fresh
 * start rather than a crash.
 */
export function loadGame(storage: Storage = globalThis.localStorage): GameState | null {
  try {
    const raw = storage.getItem(STORAGE_KEY);
    if (raw === null) {
      return null;
    }

    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') {
      return null;
    }

    const rawVersion = (parsed as Record<string, unknown>).version;
    if (typeof rawVersion !== 'number' || rawVersion < CURRENT_SAVE_VERSION) {
      return null;
    }

    if (!isValidSerializedGameState(parsed)) {
      return null;
    }

    return deserializeGameState(parsed);
  } catch {
    return null;
  }
}

/** Loaded once at startup so every store's initial value can share a single parse of the save. */
export const INITIAL_SAVE: GameState | null = loadGame();
