import { get } from 'svelte/store';
import { roster } from './roster';
import { townStorage } from './townStorage';
import { currentView } from './view';
import { dungeonPlayback } from './dungeonPlayback';
import { activeRun } from './activeRun';
import { runHistory } from './runHistory';
import {
  startDungeonRun,
  resolveNextRoom,
  retreatDungeonRun,
  type RoomDefinition,
  type DungeonRunState,
  type DungeonRoomRecord,
} from '../sim/dungeonRun';
import { equipItem as simEquipItem, unequipItem as simUnequipItem } from '../sim/partyManagement';
import { resetToTemplateBaseline, type Adventurer } from '../sim/adventurer';
import { createRunInventory, type Item, type EquipmentSlot, type ItemLookup, type RunInventory } from '../sim/items';
import { rollRoomLoot } from '../sim/loot';
import { rollRoomGold, sumGeneratedGold } from '../sim/gold';
import { mergeRunInventoryIntoTown } from '../sim/townStorage';
import type { RngSource } from '../sim/rng';
import { createStarterDungeonRooms } from '../data/rooms';
import { ITEM_REGISTRY } from '../data/items';
import { CHARACTER_TEMPLATES } from '../data/characters';
import { refreshRecruitmentPool } from './recruitmentPool';

function touchRoster(): void {
  roster.update((state) => ({ ...state }));
}

function touchTownStorage(): void {
  townStorage.update((state) => ({ ...state }));
}

/**
 * Re-derives the persisted resume snapshot (see state/activeRun.ts) from
 * the live dungeonPlayback — called after every dungeonPlayback mutation so
 * closing/reloading mid-run can pick back up via
 * state/dungeonPlayback.ts's resumeFromSave. Setting `activeRun` to null
 * (once dungeonPlayback itself goes null, e.g. finishDungeonRun) is what
 * actually clears the save's resumable run.
 */
function touchActiveRun(): void {
  const playback = get(dungeonPlayback);
  activeRun.set(
    playback
      ? {
          rooms: playback.runState.rooms,
          currentRoomIndex: playback.runState.roomIndex,
          partyIds: playback.runState.party.map((adventurer) => adventurer.id),
          partyGold: playback.runState.partyGold,
          inventory: playback.inventory,
          outcome: playback.outcome,
        }
      : null,
  );
}

/**
 * Rolls loot/gold for `record` (the just-resolved room) into `inventory`.
 * Room-clear loot/gold (rollRoomLoot/rollRoomGold) only happens on a win,
 * same as always; Nerissa's Pickpocket Strike gold (sumGeneratedGold) is
 * added regardless of outcome — see its own doc comment for why. Takes the
 * record directly rather than indexing `runState.roomRecords` by room index
 * — a resumed run starts that array fresh/empty (see
 * state/dungeonPlayback.ts's resumeFromSave), so it can't be assumed to
 * hold every prior room by position.
 */
function rollLootForRoom(
  runState: DungeonRunState,
  record: DungeonRoomRecord,
  inventory: RunInventory,
  rng: RngSource,
  lookupItem: ItemLookup,
): void {
  if (record.result.outcome === 'win') {
    const room = runState.rooms[record.roomIndex];
    inventory.items.push(...rollRoomLoot(room.enemies, lookupItem, rng));
    inventory.gold += rollRoomGold(room.enemies, rng);
  }
  inventory.gold += sumGeneratedGold(record.result);
}

/**
 * Starts a dungeon run for `party` (the drafted 4 — see state/draft.ts's
 * DraftState) against `rooms` (defaults to a freshly rolled run — see
 * data/rooms.ts's per-slot composition pools — using the same `rng` passed
 * here, so it can't be supplied as a plain default parameter value).
 * Resolves the first room only — resolveNextRoom/continueDungeonRun
 * advance the rest one room at a time, pausing between rooms for the
 * player (see DungeonPauseView) — then switches to the dungeon view so the
 * Phaser layer can replay it.
 */
export function startDungeon(
  party: Adventurer[],
  rooms?: RoomDefinition[],
  rng: RngSource = () => Math.random(),
  lookupItem: ItemLookup = (id) => ITEM_REGISTRY[id],
): void {
  if (party.length === 0) {
    return; // shouldn't happen given the draft's own enforcement; guard defensively
  }

  const actualRooms = rooms ?? createStarterDungeonRooms(rng);
  const partyGold = get(townStorage).gold;
  const runState = startDungeonRun(party, actualRooms, partyGold);
  // Embarking consumes the day — the recruitment pool refreshes on that trigger (Resting no longer
  // exists to also trigger it from).
  refreshRecruitmentPool();

  const inventory = createRunInventory();
  const outcome = resolveNextRoom(runState, rng);
  const record = runState.roomRecords.at(-1)!;
  rollLootForRoom(runState, record, inventory, rng, lookupItem);

  dungeonPlayback.set({ runState, inventory, currentRecord: record, outcome });
  touchActiveRun();
  currentView.set('dungeon');
}

/**
 * Called once the player is done acting at a between-room pause (after
 * equipping/unequipping whatever they wanted, or deciding not to): resolves
 * the next room and advances playback to it. No-ops if the run isn't
 * actually paused (outcome already resolved, or no run in progress).
 */
export function continueDungeonRun(
  rng: RngSource = () => Math.random(),
  lookupItem: ItemLookup = (id) => ITEM_REGISTRY[id],
): void {
  const playback = get(dungeonPlayback);
  if (!playback || playback.outcome !== null) {
    return;
  }

  const outcome = resolveNextRoom(playback.runState, rng);
  const record = playback.runState.roomRecords.at(-1)!;
  rollLootForRoom(playback.runState, record, playback.inventory, rng, lookupItem);

  dungeonPlayback.set({ ...playback, currentRecord: record, outcome });
  touchActiveRun();
}

/**
 * Ends the run early from a between-room pause (the player chose Retreat).
 * There's no further room to replay, so this goes straight to
 * finishDungeonRun rather than updating currentRecord. No-ops if the run
 * isn't actually paused.
 */
export function retreatFromDungeon(): void {
  const playback = get(dungeonPlayback);
  if (!playback || playback.outcome !== null) {
    return;
  }

  retreatDungeonRun();
  finishDungeonRun();
}

/** Equips `item` (pulled from the run's inventory) onto `adventurerId` during a between-room pause. */
export function equipItemDuringRun(adventurerId: string, item: Item): void {
  const playback = get(dungeonPlayback);
  const adventurer = playback?.runState.party.find((candidate) => candidate.id === adventurerId);
  if (!playback || !adventurer) {
    return;
  }

  try {
    simEquipItem(adventurer, playback.inventory, item, item.slot);
  } catch {
    return; // e.g. item no longer in the run's inventory; leave state untouched
  }

  touchRoster();
  dungeonPlayback.set({ ...playback });
  touchActiveRun();
}

/** Unequips whatever `adventurerId` has in `slot` during a between-room pause, returning it to the run's inventory. */
export function unequipItemDuringRun(adventurerId: string, slot: EquipmentSlot): void {
  const playback = get(dungeonPlayback);
  const adventurer = playback?.runState.party.find((candidate) => candidate.id === adventurerId);
  if (!playback || !adventurer) {
    return;
  }

  simUnequipItem(adventurer, playback.inventory, slot);
  touchRoster();
  dungeonPlayback.set({ ...playback });
  touchActiveRun();
}

/** Dismisses `adventurerId`'s Downed popup at a between-room pause (see DownedModal.svelte) — no-ops if there's no run in progress or no unacknowledged DownedSummary for them. */
export function acknowledgeDowned(adventurerId: string): void {
  const playback = get(dungeonPlayback);
  const adventurer = playback?.runState.party.find((candidate) => candidate.id === adventurerId);
  if (!playback || !adventurer?.downedSummary) {
    return;
  }

  adventurer.downedSummary.acknowledged = true;
  touchRoster();
  dungeonPlayback.set({ ...playback });
  touchActiveRun();
}

/** Dismisses the loot prompt for `item` at a between-room pause (see LootModal.svelte) without equipping it — no-ops if there's no run in progress. */
export function dismissLootPrompt(item: Item): void {
  const playback = get(dungeonPlayback);
  if (!playback) {
    return;
  }

  item.promptDismissed = true;
  dungeonPlayback.set({ ...playback });
  touchActiveRun();
}

/**
 * Called once the Phaser layer finishes replaying the run's last room
 * (outcome already resolved) or after a Retreat: records a completed run
 * against every party member (see state/runHistory.ts — a foundation for
 * future achievements/branching paths, not surfaced anywhere yet), resets
 * every party member back to their template baseline (level/XP/earned
 * Faces/passives clear — only equipment survives, see sim/adventurer.ts's
 * resetToTemplateBaseline), merges the run's loot into town storage,
 * refreshes the roster store to reflect it all, and returns to town.
 */
export function finishDungeonRun(): void {
  const playback = get(dungeonPlayback);
  if (!playback) {
    return;
  }

  if (playback.outcome === 'completed') {
    const history = get(runHistory);
    const clearedWithIds = new Set(history.clearedWithIds);
    for (const adventurer of playback.runState.party) {
      clearedWithIds.add(adventurer.id);
    }
    runHistory.set({ clearedWithIds: [...clearedWithIds] });
  }

  for (const adventurer of playback.runState.party) {
    const template = CHARACTER_TEMPLATES.find((candidate) => candidate.name === adventurer.name);
    if (template) {
      resetToTemplateBaseline(adventurer, template);
    }
  }

  mergeRunInventoryIntoTown(playback.inventory, get(townStorage));
  touchTownStorage();
  touchRoster();

  dungeonPlayback.set(null);
  touchActiveRun();
  currentView.set('town');
}
