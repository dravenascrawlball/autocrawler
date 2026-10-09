import { get } from 'svelte/store';
import { roster } from './roster';
import { townStorage } from './townStorage';
import { currentView } from './view';
import { dungeonPlayback, rollShopOffers } from './dungeonPlayback';
import { activeRun } from './activeRun';
import { runHistory, recordRun } from './runHistory';
import {
  startDungeonRun,
  resolveNextRoom,
  retreatDungeonRun,
  type RoomDefinition,
  type DungeonRunState,
  type DungeonRoomRecord,
} from '../sim/dungeonRun';
import { equipItem as simEquipItem, unequipItem as simUnequipItem } from '../sim/partyManagement';
import { resetToTemplateBaseline, grantSecondPoolSpecial, type Adventurer } from '../sim/adventurer';
import { createRunInventory, type Item, type EquipmentSlot, type ItemLookup, type RunInventory } from '../sim/items';
import { rollRoomLoot } from '../sim/loot';
import { rollRoomGold, sumGeneratedGold } from '../sim/gold';
import { levelUpAdventurer } from '../sim/leveling';
import { applyRelicToAdventurer, applyActiveRelicsToAdventurer, type Relic } from '../sim/relics';
import { calculateRunRenownBreakdown } from '../sim/renown';
import {
  newUnlocksForRun,
  lastRunReward,
  unlockedPoolEntriesFor,
  unlockedKitsFor,
  applyTrainingFromProgress,
  wearKit,
  halloweenUnlocksForRun,
} from './progression';
import type { RngSource } from '../sim/rng';
import { MAX_PARTY_SIZE } from '../sim/draft';
import { moveToCell, placeUnplaced, type GridPosition } from '../sim/formation';
import { createStarterDungeonRooms } from '../data/rooms';
import { SYNERGIES } from '../data/synergies';
import { ITEM_REGISTRY } from '../data/items';
import { CHARACTER_TEMPLATES } from '../data/characters';
import { UNIVERSAL_TRAIT_POOL } from '../data/traits';
import { refreshRecruitmentPool } from './recruitmentPool';
import { metaProgression } from './metaProgression';

function touchRoster(): void {
  roster.update((state) => ({ ...state }));
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
          activeRelics: playback.runState.activeRelics,
        }
      : null,
  );
}

/**
 * Rolls loot/gold for `record` (the just-resolved room) into `inventory`.
 * Room-clear loot/gold (rollRoomLoot/rollRoomGold, plus the room's flat
 * clearGold) only happens on a win,
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
    inventory.gold += rollRoomGold(room.enemies, rng) + (room.clearGold ?? 0);
  }
  inventory.gold += sumGeneratedGold(record.result);
}

/**
 * Starts a dungeon run for `party` (built by the player at the opening gold
 * shop — see state/openingShop.ts's embarkFromOpeningShop; the rest join
 * mid-run via recruit offers) against `rooms` (defaults to a freshly rolled
 * run — see data/rooms.ts's per-slot composition pools — using the same
 * `rng` passed here, so it can't be supplied as a plain default parameter
 * value). `seed` carries over whatever the opening shop left: leftover
 * gold, Relics already bought (so they also apply to anyone recruited from
 * here on, same convention as buyRelicOffer below), and Equipment bought
 * there (staged straight into the run's inventory, already acknowledged).
 * Resolves the first room only — resolveNextRoom/continueDungeonRun advance
 * the rest one room at a time, pausing between rooms for the player (see
 * DungeonPauseView) — then switches to the dungeon view so the Phaser layer
 * can replay it.
 */
export function startDungeon(
  party: Adventurer[],
  rooms?: RoomDefinition[],
  rng: RngSource = () => Math.random(),
  lookupItem: ItemLookup = (id) => ITEM_REGISTRY[id],
  seed?: { partyGold?: number; activeRelics?: Relic[]; items?: Item[] },
): void {
  if (party.length === 0) {
    return; // shouldn't happen given the opening shop's own enforcement; guard defensively
  }

  const actualRooms = rooms ?? createStarterDungeonRooms(rng);
  const partyGold = seed?.partyGold ?? get(townStorage).gold;
  const runState = startDungeonRun(party, actualRooms, partyGold, SYNERGIES);
  if (seed?.activeRelics) {
    runState.activeRelics = seed.activeRelics;
  }
  // Embarking consumes the day — the recruitment pool refreshes on that trigger (Resting no longer
  // exists to also trigger it from).
  refreshRecruitmentPool();

  const inventory = createRunInventory();
  if (seed?.items) {
    inventory.items.push(...seed.items);
  }
  const outcome = resolveNextRoom(runState, rng);
  const record = runState.roomRecords.at(-1)!;
  rollLootForRoom(runState, record, inventory, rng, lookupItem);
  const shopOffers = outcome === null ? rollShopOffers(runState, rng) : { recruits: [], relics: [], equipment: [] };

  dungeonPlayback.set({ runState, inventory, currentRecord: record, outcome, shopOffers, unplacedIds: [] });
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

  // Anyone still in the placement tray gets auto-placed before the fight — see formation.ts's placeUnplaced.
  placeUnplaced(playback.runState.party, playback.unplacedIds);
  const outcome = resolveNextRoom(playback.runState, rng);
  const record = playback.runState.roomRecords.at(-1)!;
  rollLootForRoom(playback.runState, record, playback.inventory, rng, lookupItem);
  const shopOffers =
    outcome === null ? rollShopOffers(playback.runState, rng) : { recruits: [], relics: [], equipment: [] };

  touchRoster();
  dungeonPlayback.set({ ...playback, currentRecord: record, outcome, shopOffers, unplacedIds: [] });
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

/**
 * Buys `adventurerId` from the current pause's Recruit shop offer, spending
 * gold from the run's own inventory (see sim/items.ts's RunInventory.gold —
 * this is the in-run currency, distinct from town gold/future meta-progression
 * Renown). If the offer landed on someone already in the party
 * (offer.alreadyInParty), this levels them up instead of adding a
 * duplicate — see sim/leveling.ts's levelUpAdventurer. Otherwise adds them
 * to the party (capped at MAX_PARTY_SIZE) and grants every currently active
 * Relic, same as anyone already in the party already has. No-ops if there's
 * no run in progress, the run has already ended, the offer isn't actually
 * current, there isn't enough gold, or (for a new recruit) the party is
 * already full.
 */
export function buyRecruitOffer(adventurerId: string, rng: RngSource = () => Math.random()): void {
  const playback = get(dungeonPlayback);
  if (!playback || playback.outcome !== null) {
    return;
  }

  const offer = playback.shopOffers.recruits.find((candidate) => candidate.adventurer.id === adventurerId);
  if (!offer || playback.inventory.gold < offer.price) {
    return;
  }

  if (offer.alreadyInParty) {
    const member = playback.runState.party.find((candidate) => candidate.id === adventurerId);
    if (!member) {
      return;
    }
    levelUpAdventurer(member);
    // Duplicate stars: reaching 2★ also draws a second Special from their pool — see sim/adventurer.ts.
    const template = CHARACTER_TEMPLATES.find((candidate) => candidate.name === member.name);
    if (member.level === 2 && template) {
      const pool = [
        ...(template.specialActionPool ?? []),
        ...unlockedPoolEntriesFor(template.name, member.id, get(runHistory)),
      ];
      grantSecondPoolSpecial(member, pool, rng);
    }
  } else {
    if (playback.runState.party.length >= MAX_PARTY_SIZE) {
      return;
    }
    applyActiveRelicsToAdventurer(offer.adventurer, playback.runState.activeRelics);
    playback.runState.party.push(offer.adventurer);
    // New recruits start in the placement tray — see DungeonPlaybackState.unplacedIds.
    playback.unplacedIds = [...playback.unplacedIds, offer.adventurer.id];
  }

  playback.inventory.gold -= offer.price;
  playback.shopOffers.recruits = playback.shopOffers.recruits.filter((candidate) => candidate !== offer);
  touchRoster();
  dungeonPlayback.set({ ...playback });
  touchActiveRun();
}

/**
 * Drag-and-drop placement during a between-room pause: moves party member
 * `adventurerId` (from the grid or the tray) into `cell`, swapping rather
 * than stacking — see sim/formation.ts's moveToCell. No-ops outside a pause.
 */
export function placePartyMemberDuringRun(adventurerId: string, cell: GridPosition): void {
  const playback = get(dungeonPlayback);
  if (!playback || playback.outcome !== null || !playback.runState.party.some((m) => m.id === adventurerId)) {
    return;
  }

  const unplacedIds = moveToCell(playback.runState.party, playback.unplacedIds, adventurerId, cell);
  touchRoster();
  dungeonPlayback.set({ ...playback, unplacedIds });
  touchActiveRun();
}

/** Free between-room outfit swap (owned Kits only, or the base outfit with `kitId` null) — see progression.ts's wearKit. No-ops outside a pause. */
export function changeKitDuringRun(adventurerId: string, kitId: string | null): void {
  const playback = get(dungeonPlayback);
  const member = playback?.runState.party.find((candidate) => candidate.id === adventurerId);
  if (!playback || playback.outcome !== null || !member) {
    return;
  }

  if (wearKit(member, kitId)) {
    touchRoster();
    dungeonPlayback.set({ ...playback });
    touchActiveRun();
  }
}

/** Drags party member `adventurerId` off the grid and back into the placement tray. No-ops outside a pause. */
export function returnPartyMemberToTrayDuringRun(adventurerId: string): void {
  const playback = get(dungeonPlayback);
  if (
    !playback ||
    playback.outcome !== null ||
    !playback.runState.party.some((m) => m.id === adventurerId) ||
    playback.unplacedIds.includes(adventurerId)
  ) {
    return;
  }

  dungeonPlayback.set({ ...playback, unplacedIds: [...playback.unplacedIds, adventurerId] });
}

/**
 * Buys `relicId` from the current pause's Relics shop offer: grants its
 * modifiers to every current party member and records it on
 * `runState.activeRelics` so it also applies to anyone who joins
 * afterward (see buyRecruitOffer) — for the rest of the run, same as
 * every other relic. No-ops the same way as buyRecruitOffer.
 */
export function buyRelicOffer(relicId: string): void {
  const playback = get(dungeonPlayback);
  if (!playback || playback.outcome !== null) {
    return;
  }

  const offer = playback.shopOffers.relics.find((candidate) => candidate.relic.id === relicId);
  if (!offer || playback.inventory.gold < offer.price) {
    return;
  }

  for (const adventurer of playback.runState.party) {
    applyRelicToAdventurer(adventurer, offer.relic);
  }
  playback.runState.activeRelics = [...playback.runState.activeRelics, offer.relic];
  playback.inventory.gold -= offer.price;
  playback.shopOffers.relics = playback.shopOffers.relics.filter((candidate) => candidate !== offer);
  touchRoster();
  dungeonPlayback.set({ ...playback });
  touchActiveRun();
}

/**
 * Buys `itemId` from the current pause's Equipment shop offer: adds it
 * straight to the run's inventory, already acknowledged (promptDismissed)
 * since the player just deliberately chose it — no LootModal popup, just
 * available to equip from the existing Run Inventory list. No-ops the same
 * way as buyRecruitOffer.
 */
export function buyEquipmentOffer(itemId: string): void {
  const playback = get(dungeonPlayback);
  if (!playback || playback.outcome !== null) {
    return;
  }

  const offer = playback.shopOffers.equipment.find((candidate) => candidate.item.id === itemId);
  if (!offer || playback.inventory.gold < offer.price) {
    return;
  }

  playback.inventory.gold -= offer.price;
  playback.inventory.items.push({ ...offer.item, promptDismissed: true });
  playback.shopOffers.equipment = playback.shopOffers.equipment.filter((candidate) => candidate !== offer);
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
 * future achievements/branching paths, not surfaced anywhere yet), awards
 * Renown for the run (see sim/renown.ts's calculateRunRenown — the
 * meta-progression currency Recruit/the Shop spend, state/
 * metaProgression.ts), resets every party member back to their template
 * baseline — level and equipment both clear, see sim/adventurer.ts's
 * resetToTemplateBaseline, folding in any Kits bought from the Shop —
 * discards the run's inventory (gold/items are purely run-scoped now,
 * Town Storage Cleanup, see docs/roadmap.md), refreshes the roster store
 * to reflect it all, and returns to town.
 */
export function finishDungeonRun(): void {
  const playback = get(dungeonPlayback);
  if (!playback) {
    return;
  }

  const party = playback.runState.party;
  const renown = calculateRunRenownBreakdown(playback.runState.roomRecords, playback.outcome);
  const historyBefore = get(runHistory);
  const historyAfter = recordRun(
    historyBefore,
    party.map((adventurer) => adventurer.id),
    renown.roomsWon,
    playback.outcome === 'completed',
  );
  runHistory.set(historyAfter);
  // Halloween event: reaching Floor 2 unlocks each party member's Halloween Kit (before the reset
  // below, so it's already in their Kit pool for it).
  const newKits = halloweenUnlocksForRun(party, renown.roomsWon, get(metaProgression).unlockedKitIds);
  metaProgression.update((state) => {
    const unlockedKitIds = { ...state.unlockedKitIds };
    for (const unlock of newKits) {
      unlockedKitIds[unlock.characterName] = [...(unlockedKitIds[unlock.characterName] ?? []), unlock.kitId];
    }
    return { ...state, renown: state.renown + renown.total, unlockedKitIds };
  });
  // Read by the town toast (ui/TownPhase.svelte) — see state/progression.ts.
  lastRunReward.set({ outcome: playback.outcome, renown, newUnlocks: newUnlocksForRun(party, historyBefore, historyAfter), newKits });

  // Resolved against the updated history, so an unlock earned this very run is already in the
  // pool for this reset, not just the next one.
  const unlockedKitIds = get(metaProgression).unlockedKitIds;
  for (const adventurer of party) {
    const template = CHARACTER_TEMPLATES.find((candidate) => candidate.name === adventurer.name);
    if (template) {
      resetToTemplateBaseline(
        adventurer,
        template,
        unlockedPoolEntriesFor(template.name, adventurer.id, historyAfter),
        UNIVERSAL_TRAIT_POOL,
        undefined,
        unlockedKitsFor(template.name, unlockedKitIds),
      );
      applyTrainingFromProgress(adventurer);
    }
  }

  // Run-scoped gold/items (sim/items.ts's RunInventory) never bank to town storage at all — see
  // Town Storage Cleanup, docs/roadmap.md: `playback.inventory` is simply discarded here. Renown
  // (above) is the only thing a run leaves behind.
  touchRoster();

  dungeonPlayback.set(null);
  touchActiveRun();
  currentView.set('town');
}
