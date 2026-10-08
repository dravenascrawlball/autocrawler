import type { Adventurer } from '../sim/adventurer';
import type { ActionId } from '../sim/action';
import type { DieFace } from '../sim/dieFace';
import type { EnchantmentId } from '../sim/enchantments';
import { ACTION_REGISTRY } from '../data/actions';
import { SPECIAL_ACTION_REGISTRY, RETIRED_SPECIAL_REPLACEMENTS } from '../data/specialActions';
import { CHARACTER_TEMPLATES } from '../data/characters';
import type { RoomDefinition } from '../sim/dungeonRun';
import type { TownStorage } from '../sim/townStorage';
import type { RecruitCandidate } from '../sim/recruitment';
import type { EquipmentSlots, Item, RunInventory } from '../sim/items';
import { ITEM_REGISTRY } from '../data/items';
import type { RosterState } from './roster';
import type { ActiveDungeonRunState } from './activeRun';
import type { RunHistoryState } from './runHistory';
import type { MetaProgressionState } from './metaProgression';

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
 * v15: Adventurer gained `basicAction`/`activeSpecialActions` (the
 * deterministic-combat overhaul's Basic Action + Special Action system —
 * see sim/turnEngine.ts/sim/specialActions.ts), narrowed to ids the same
 * way dieFaces/ownedFaces already were.
 * v16: Item (wherever it appears — Adventurer.equipment, a RunInventory,
 * TownStorage) is now narrowed to its id (+ promptDismissed) and resolved
 * back through ITEM_REGISTRY on load, the same treatment dieFaces/
 * basicAction/etc. already got — items could carry a `grantedSpecialAction`
 * since v15 (see sim/items.ts), another function-bearing value JSON can't
 * carry, and townStorage/activeRun.inventory were previously persisted as
 * raw, unnarrowed Item objects (a latent gap predating this version: a
 * faceEffect item's nested Action was equally unserializable, it just had
 * no save-reload test covering it).
 * v17: added `metaProgression` (Renown + Shop Kit unlocks — see
 * state/metaProgression.ts, Town Storage Cleanup's meta-progression
 * follow-up, docs/roadmap.md). Plain data throughout (a number and a
 * Record<string, string[]>), so it rides along with no custom
 * serialize/deserialize treatment, same as RunHistoryState.
 */
const CURRENT_SAVE_VERSION = 17;

export interface GameState {
  roster: RosterState;
  /** Includes town gold (townStorage.gold) alongside items — see sim/townStorage.ts. Nothing deposits into either anymore (Town Storage Cleanup, then the Shop's move to selling Kits for Renown instead of Items) — kept in the save shape for now rather than ripped out. */
  townStorage: TownStorage;
  dayCount: number;
  /** null when no dungeon run is currently in progress. */
  activeRun: ActiveDungeonRunState | null;
  recruitmentPool: RecruitCandidate[];
  runHistory: RunHistoryState;
  metaProgression: MetaProgressionState;
}

/** A DieFace with its action narrowed to a plain id — see SerializedAdventurer. */
type SerializedDieFace = { actionId: ActionId; enchantmentId?: EnchantmentId };

/** An Item narrowed to its id — every other field (modifiers, price, grantedSpecialAction, ...) is resolved back through ITEM_REGISTRY, since nothing varies per-instance anymore except promptDismissed. */
type SerializedItem = { itemId: string; promptDismissed?: boolean };

/** EquipmentSlots with each Item narrowed the same way — see SerializedItem. */
type SerializedEquipmentSlots = { weapon: SerializedItem | null; armor: SerializedItem | null; trinket: SerializedItem | null };

/** A RunInventory/TownStorage shape (both are just `{ items, gold }`) with its items narrowed — see SerializedItem. */
type SerializedItemBag = { items: SerializedItem[]; gold: number };

/**
 * An Adventurer with `dieFaces`/`ownedFaces`/`basicAction`/
 * `activeSpecialActions`/`equipment` narrowed to plain ids — JSON can't
 * carry function values (selectTarget/resolve on an Action, which a
 * SpecialAction or an item's grantedSpecialAction both carry), so they're
 * resolved back through ACTION_REGISTRY/SPECIAL_ACTION_REGISTRY/
 * ITEM_REGISTRY on load instead of being serialized.
 */
type SerializedAdventurer = Omit<Adventurer, 'dieFaces' | 'ownedFaces' | 'basicAction' | 'activeSpecialActions' | 'equipment'> & {
  dieFaces: SerializedDieFace[];
  ownedFaces: ActionId[];
  basicActionId: ActionId;
  activeSpecialActionIds: string[];
  equipment: SerializedEquipmentSlots;
};

interface SerializedRoomDefinition extends Omit<RoomDefinition, 'enemies'> {
  enemies: SerializedAdventurer[];
}

interface SerializedActiveRun extends Omit<ActiveDungeonRunState, 'rooms' | 'inventory'> {
  rooms: SerializedRoomDefinition[];
  inventory: SerializedItemBag;
}

interface SerializedRecruitCandidate extends Omit<RecruitCandidate, 'adventurer'> {
  adventurer: SerializedAdventurer;
}

interface SerializedGameState {
  version: number;
  roster: { adventurers: SerializedAdventurer[]; recruitedIds: string[] };
  townStorage: SerializedItemBag;
  dayCount: number;
  activeRun: SerializedActiveRun | null;
  recruitmentPool: SerializedRecruitCandidate[];
  runHistory: RunHistoryState;
  metaProgression: MetaProgressionState;
}

function serializeDieFace(face: DieFace): SerializedDieFace {
  return face.enchantmentId ? { actionId: face.action.id, enchantmentId: face.enchantmentId } : { actionId: face.action.id };
}

function deserializeDieFace(serialized: SerializedDieFace): DieFace {
  const action = ACTION_REGISTRY[serialized.actionId];
  return serialized.enchantmentId ? { action, enchantmentId: serialized.enchantmentId } : { action };
}

function serializeItem(item: Item): SerializedItem {
  return item.promptDismissed ? { itemId: item.id, promptDismissed: true } : { itemId: item.id };
}

function deserializeItem(serialized: SerializedItem): Item {
  const item = ITEM_REGISTRY[serialized.itemId];
  return serialized.promptDismissed ? { ...item, promptDismissed: true } : item;
}

function serializeEquipment(equipment: EquipmentSlots): SerializedEquipmentSlots {
  return {
    weapon: equipment.weapon ? serializeItem(equipment.weapon) : null,
    armor: equipment.armor ? serializeItem(equipment.armor) : null,
    trinket: equipment.trinket ? serializeItem(equipment.trinket) : null,
  };
}

function deserializeEquipment(serialized: SerializedEquipmentSlots): EquipmentSlots {
  return {
    weapon: serialized.weapon ? deserializeItem(serialized.weapon) : null,
    armor: serialized.armor ? deserializeItem(serialized.armor) : null,
    trinket: serialized.trinket ? deserializeItem(serialized.trinket) : null,
  };
}

function serializeItemBag(bag: { items: Item[]; gold: number }): SerializedItemBag {
  return { items: bag.items.map(serializeItem), gold: bag.gold };
}

function deserializeItemBag(bag: SerializedItemBag): RunInventory {
  return { items: bag.items.map(deserializeItem), gold: bag.gold };
}

function serializeAdventurer(adventurer: Adventurer): SerializedAdventurer {
  const { dieFaces, ownedFaces, basicAction, activeSpecialActions, equipment, ...rest } = adventurer;
  return {
    ...rest,
    dieFaces: dieFaces.map(serializeDieFace),
    ownedFaces: ownedFaces.map((action) => action.id),
    basicActionId: basicAction.id,
    activeSpecialActionIds: activeSpecialActions.map((special) => special.id),
    equipment: serializeEquipment(equipment),
  };
}

function deserializeAdventurer(serialized: SerializedAdventurer): Adventurer {
  const { dieFaces, ownedFaces, basicActionId, activeSpecialActionIds, equipment, ...rest } = serialized;
  return repairKitDrift({
    ...rest,
    dieFaces: dieFaces.map(deserializeDieFace),
    ownedFaces: ownedFaces.map((id) => ACTION_REGISTRY[id]),
    basicAction: ACTION_REGISTRY[basicActionId],
    activeSpecialActions: activeSpecialActionIds.map(
      (id) => RETIRED_SPECIAL_REPLACEMENTS[id] ?? SPECIAL_ACTION_REGISTRY[id],
    ),
    equipment: deserializeEquipment(equipment),
  });
}

/**
 * Brings a saved player character's kit up to date with its current
 * template, without discarding the save (no CURRENT_SAVE_VERSION bump):
 * the template's Basic Action wins, and any always-on Special
 * (innateSpecialActions) the save predates is added. Retired pool Specials
 * are swapped via RETIRED_SPECIAL_REPLACEMENTS above. Introduced with the
 * healer redesign (Dawneth/Mira moved their heal from Basic Action to an
 * innate Special). Enemies (no matching template here) pass through as-is.
 */
function repairKitDrift(adventurer: Adventurer): Adventurer {
  const template = CHARACTER_TEMPLATES.find((candidate) => candidate.name === adventurer.name);
  if (!template) return adventurer;
  const innate = (template.innateSpecialActions ?? []).filter(
    (special) => !adventurer.activeSpecialActions.some((active) => active.id === special.id),
  );
  return {
    ...adventurer,
    basicAction: template.basicAction ?? adventurer.basicAction,
    activeSpecialActions: [...innate, ...adventurer.activeSpecialActions],
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
    townStorage: serializeItemBag(state.townStorage),
    dayCount: state.dayCount,
    activeRun: state.activeRun
      ? { ...state.activeRun, rooms: state.activeRun.rooms.map(serializeRoom), inventory: serializeItemBag(state.activeRun.inventory) }
      : null,
    recruitmentPool: state.recruitmentPool.map(serializeCandidate),
    runHistory: { clearedWithIds: [...state.runHistory.clearedWithIds], characterStats: { ...state.runHistory.characterStats } },
    metaProgression: {
      renown: state.metaProgression.renown,
      unlockedKitIds: { ...state.metaProgression.unlockedKitIds },
    },
  };
}

function deserializeGameState(raw: SerializedGameState): GameState {
  return {
    roster: {
      adventurers: raw.roster.adventurers.map(deserializeAdventurer),
      recruitedIds: [...raw.roster.recruitedIds],
    },
    townStorage: deserializeItemBag(raw.townStorage),
    dayCount: raw.dayCount,
    activeRun: raw.activeRun
      ? { ...raw.activeRun, rooms: raw.activeRun.rooms.map(deserializeRoom), inventory: deserializeItemBag(raw.activeRun.inventory) }
      : null,
    recruitmentPool: raw.recruitmentPool.map(deserializeCandidate),
    // characterStats arrived after v17 (Progress screen) — an older save simply has none yet.
    runHistory: {
      clearedWithIds: [...raw.runHistory.clearedWithIds],
      characterStats: { ...(raw.runHistory.characterStats ?? {}) },
    },
    metaProgression: {
      renown: raw.metaProgression.renown,
      unlockedKitIds: { ...raw.metaProgression.unlockedKitIds },
    },
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

  if (!state.metaProgression || typeof state.metaProgression !== 'object') return false;
  const metaProgression = state.metaProgression as Record<string, unknown>;
  if (typeof metaProgression.renown !== 'number') return false;
  if (!metaProgression.unlockedKitIds || typeof metaProgression.unlockedKitIds !== 'object') return false;

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
