import { describe, it, expect } from 'vitest';
import { createSeededRng, type RngSource } from './rng';
import { startDungeonRun, resolveNextRoom, type DungeonOutcome, type DungeonRunState } from './dungeonRun';
import { MAX_PARTY_SIZE } from './draft';
import { createRunInventory, type Item, type RunInventory } from './items';
import { equipItem } from './partyManagement';
import { levelUpAdventurer } from './leveling';
import { applyRelicToAdventurer, applyActiveRelicsToAdventurer } from './relics';
import { rollRecruitOffers, rollRelicOffers, rollEquipmentOffers, DEFAULT_RECRUIT_PRICE, type ShopOffers } from './shopOffers';
import { rollRoomGold, sumGeneratedGold } from './gold';
import { rollRoomLoot } from './loot';
import { createStarterRoster } from '../data/roster';
import { createStarterDungeonRooms } from '../data/rooms';
import { CHARACTER_TEMPLATES } from '../data/characters';
import { ITEM_REGISTRY } from '../data/items';
import { RELIC_REGISTRY } from '../data/relics';
import { STARTING_SHOP_GOLD } from '../state/openingShop';
import type { Adventurer } from './adventurer';

/**
 * Not part of the regular suite — a dev tool for the balance pass (see
 * docs/roadmap.md's "Second balance pass"), skipped unless BALANCE_SIM is
 * set so it doesn't slow down or clutter `npx vitest run`. Run it directly:
 *   BALANCE_SIM=1 npx vitest run src/sim/balanceSim.test.ts --silent=false
 * Reruns after changing any placeholder number (enemy stats, room
 * compositions, gold income, prices, etc.) to see the effect on win rate.
 *
 * The simulated player mirrors the real game's shops (state/openingShop.ts
 * and the between-room pause, state/dungeonOrchestrator.ts): one rolled set
 * of offers per shop visit, bought greedily — see shopGreedily.
 */
const RUNS = Number(process.env.BALANCE_SIM_RUNS ?? 2000);
const ROOM_COUNT = 5;
/** Characters whose kit generates gold (Nerissa's Pickpocket Strike) — runs fielding one are left out of the per-pause economy stats, which measure a party with no econ build. */
const ECON_ARCHETYPES = new Set(['Nerissa']);

function average(values: number[]): number {
  return values.length ? values.reduce((sum, v) => sum + v, 0) / values.length : 0;
}

function pct(n: number, total: number): string {
  return total ? `${((100 * n) / total).toFixed(1)}%` : '-';
}

function recruitCostFor(adventurer: Adventurer): number {
  return CHARACTER_TEMPLATES.find((t) => t.name === adventurer.name)?.recruitCost ?? DEFAULT_RECRUIT_PRICE;
}

function lookupItem(itemId: string): Item {
  return ITEM_REGISTRY[itemId];
}

function rollOffers(roster: Adventurer[], party: Adventurer[], activeRelics: DungeonRunState['activeRelics'], rng: RngSource): ShopOffers {
  return {
    recruits: rollRecruitOffers(roster, party, recruitCostFor, rng),
    relics: rollRelicOffers(RELIC_REGISTRY, activeRelics, rng),
    equipment: rollEquipmentOffers(Object.values(ITEM_REGISTRY), rng),
  };
}

/** Equips every unequipped item in `inventory` onto the first party member with that slot still empty — a player who never leaves gear sitting idle. */
function autoEquip(party: Adventurer[], inventory: RunInventory): void {
  for (const item of [...inventory.items]) {
    const wearer = party.find((member) => member.equipment[item.slot] === null);
    if (wearer) {
      equipItem(wearer, inventory, item, item.slot);
    }
  }
}

/**
 * One shop visit, bought greedily in priority order: new recruits (cheapest
 * first, while the party has room), then level-ups (a recruit offer for
 * someone already in the party), then relics, then equipment — the order a
 * player trying to field the strongest board would plausibly spend in.
 * Mirrors buyRecruitOffer/buyRelicOffer/buyEquipmentOffer's effects.
 */
function shopGreedily(
  offers: ShopOffers,
  party: Adventurer[],
  activeRelics: DungeonRunState['activeRelics'],
  inventory: RunInventory,
): number {
  let recruitSizedBuys = 0;
  const byPrice = <T extends { price: number }>(list: T[]) => [...list].sort((a, b) => a.price - b.price);

  for (const offer of byPrice(offers.recruits.filter((o) => !o.alreadyInParty))) {
    if (party.length < MAX_PARTY_SIZE && inventory.gold >= offer.price) {
      inventory.gold -= offer.price;
      applyActiveRelicsToAdventurer(offer.adventurer, activeRelics);
      party.push(offer.adventurer);
      recruitSizedBuys += 1;
    }
  }
  for (const offer of byPrice(offers.recruits.filter((o) => o.alreadyInParty))) {
    if (inventory.gold >= offer.price) {
      inventory.gold -= offer.price;
      levelUpAdventurer(offer.adventurer);
      recruitSizedBuys += 1;
    }
  }
  for (const offer of byPrice(offers.relics)) {
    if (inventory.gold >= offer.price) {
      inventory.gold -= offer.price;
      for (const member of party) applyRelicToAdventurer(member, offer.relic);
      activeRelics.push(offer.relic);
    }
  }
  for (const offer of byPrice(offers.equipment)) {
    if (inventory.gold >= offer.price) {
      inventory.gold -= offer.price;
      inventory.items.push({ ...offer.item, promptDismissed: true });
    }
  }
  autoEquip(party, inventory);
  return recruitSizedBuys;
}

describe.skipIf(!process.env.BALANCE_SIM)('balance simulation', () => {
  it(`reports outcome distribution across ${RUNS} seeded runs`, () => {
    const outcomeCounts: Record<DungeonOutcome, number> = { completed: 0, loss: 0, retreat: 0 };
    const roomsClearedCounts: number[] = [];
    const runEndedAtRoom = Array.from({ length: ROOM_COUNT }, () => 0);
    const partySizeAtRoomStart: number[][] = Array.from({ length: ROOM_COUNT }, () => []);
    const hpFractionAfterRoom: number[][] = Array.from({ length: ROOM_COUNT }, () => []);
    const openingPartySizes: number[] = [];
    const goldEarnedPerRun: number[] = [];
    const levelUpsPerRun: number[] = [];
    // Per-character: runs they were in the opening party for, and how many of those fully cleared.
    const openerStats: Record<string, { runs: number; clears: number }> = {};
    // Per-character: runs they fought in at all (opening or recruited), and how many fully cleared.
    const anyStats: Record<string, { runs: number; clears: number }> = {};
    const actionCountsByArchetype: Record<string, Record<string, number>> = {};
    // Per pause (index = room just cleared), runs with no ECON_ARCHETYPES member only.
    const goldAtPause: number[][] = Array.from({ length: ROOM_COUNT - 1 }, () => []);
    const recruitBuysAtPause: number[][] = Array.from({ length: ROOM_COUNT - 1 }, () => []);
    const minRecruitPrice = Math.min(...CHARACTER_TEMPLATES.map((t) => t.recruitCost ?? DEFAULT_RECRUIT_PRICE));
    const stalledTurnsByArchetype: Record<string, { stalled: number; total: number }> = {};

    for (let seed = 0; seed < RUNS; seed++) {
      const rng = createSeededRng(seed);
      const roster = createStarterRoster();
      const rooms = createStarterDungeonRooms(rng);
      const inventory = createRunInventory();
      inventory.gold = STARTING_SHOP_GOLD;

      // Opening shop: one rolled set of offers against an empty party (see state/openingShop.ts).
      const party: Adventurer[] = [];
      const activeRelics: DungeonRunState['activeRelics'] = [];
      shopGreedily(rollOffers(roster, party, activeRelics, rng), party, activeRelics, inventory);
      if (party.length === 0) {
        throw new Error(`seed ${seed}: opening shop couldn't afford any recruit`);
      }
      openingPartySizes.push(party.length);
      const openers = party.map((member) => member.name);

      const state = startDungeonRun(party, rooms, inventory.gold);
      state.activeRelics = activeRelics;
      let outcome: DungeonOutcome | null = null;
      let goldEarned = 0;

      while (outcome === null) {
        const roomIndex = state.roomIndex;
        partySizeAtRoomStart[roomIndex].push(state.party.length);
        outcome = resolveNextRoom(state, rng);
        const record = state.roomRecords[roomIndex];

        let roomGold = sumGeneratedGold(record.result);
        if (record.result.outcome === 'win') {
          roomGold += rollRoomGold(state.rooms[roomIndex].enemies, rng) + (state.rooms[roomIndex].clearGold ?? 0);
          inventory.items.push(...rollRoomLoot(state.rooms[roomIndex].enemies, lookupItem, rng).map((item) => ({ ...item })));
          const totalHp = state.party.reduce((sum, m) => sum + Math.max(0, m.hp), 0);
          const totalMax = state.party.reduce((sum, m) => sum + m.maxHp, 0);
          hpFractionAfterRoom[roomIndex].push(totalHp / totalMax);
        }
        inventory.gold += roomGold;
        goldEarned += roomGold;

        if (outcome === null) {
          const goldBefore = inventory.gold;
          const buys = shopGreedily(rollOffers(roster, state.party, state.activeRelics, rng), state.party, state.activeRelics, inventory);
          if (!state.party.some((member) => ECON_ARCHETYPES.has(member.name))) {
            goldAtPause[roomIndex].push(goldBefore);
            recruitBuysAtPause[roomIndex].push(buys);
          }
        } else if (outcome !== 'completed') {
          runEndedAtRoom[roomIndex] += 1;
        }
      }

      outcomeCounts[outcome] += 1;
      const cleared = state.roomRecords.filter((r) => r.result.outcome === 'win').length;
      roomsClearedCounts.push(cleared);
      goldEarnedPerRun.push(goldEarned);
      levelUpsPerRun.push(state.party.reduce((sum, m) => sum + (m.level - 1), 0));

      const won = outcome === 'completed' ? 1 : 0;
      for (const name of openers) {
        const entry = (openerStats[name] ??= { runs: 0, clears: 0 });
        entry.runs += 1;
        entry.clears += won;
      }
      for (const member of state.party) {
        const entry = (anyStats[member.name] ??= { runs: 0, clears: 0 });
        entry.runs += 1;
        entry.clears += won;
      }

      const archetypeById = new Map(state.party.map((member) => [member.id, member.archetype]));
      for (const record of state.roomRecords) {
        for (const round of record.result.rounds) {
          for (const roundTurn of round.turns) {
            const archetype = archetypeById.get(roundTurn.unitId);
            if (!archetype) continue; // an enemy's turn
            const events = roundTurn.turn.events;
            const counts = (actionCountsByArchetype[archetype] ??= {});
            let acted = false;
            for (const event of events) {
              if (event.type === 'action') {
                counts[event.actionId] = (counts[event.actionId] ?? 0) + 1;
                acted = true;
              } else if (event.type === 'special-action' && event.actorId === roundTurn.unitId) {
                const key = `special:${event.specialActionId}`;
                counts[key] = (counts[key] ?? 0) + 1;
                acted = true;
              }
            }
            const stall = (stalledTurnsByArchetype[archetype] ??= { stalled: 0, total: 0 });
            stall.total += 1;
            if (!acted) stall.stalled += 1;
          }
        }
      }
    }

    const lines: string[] = [];
    lines.push(`\n--- Balance sim: ${RUNS} runs ---`);
    lines.push(
      `Outcome: completed ${pct(outcomeCounts.completed, RUNS)}, loss ${pct(outcomeCounts.loss, RUNS)}, ` +
        `stalemate/retreat ${pct(outcomeCounts.retreat, RUNS)}`,
    );
    lines.push(`Avg rooms cleared: ${average(roomsClearedCounts).toFixed(2)} / ${ROOM_COUNT}`);
    lines.push(`Run ended (loss/stalemate) at room: ${runEndedAtRoom.map((n, i) => `${i + 1}: ${pct(n, RUNS)}`).join(', ')}`);
    lines.push(`Avg opening party size: ${average(openingPartySizes).toFixed(2)}`);
    lines.push(
      `Avg party size at room start: ${partySizeAtRoomStart.map((s, i) => `${i + 1}: ${average(s).toFixed(2)}`).join(', ')}`,
    );
    lines.push(
      `Avg party HP left after a won room: ${hpFractionAfterRoom.map((s, i) => `${i + 1}: ${(100 * average(s)).toFixed(0)}%`).join(', ')}`,
    );
    lines.push(`Avg gold earned per run: ${average(goldEarnedPerRun).toFixed(1)}g, avg level-ups bought: ${average(levelUpsPerRun).toFixed(2)}`);

    lines.push(`\nEconomy at each pause (runs with no ${[...ECON_ARCHETYPES].join('/')}; cheapest recruit ${minRecruitPrice}g):`);
    for (let i = 0; i < ROOM_COUNT - 1; i++) {
      const golds = goldAtPause[i];
      const atLeast = (n: number) => pct(golds.filter((g) => g >= n * minRecruitPrice).length, golds.length);
      lines.push(
        `  after room ${i + 1}: avg gold ${average(golds).toFixed(0)}g, ` +
          `can afford >=1 recruit ${atLeast(1)}, >=2 ${atLeast(2)}, ` +
          `recruit/level-up buys made ${average(recruitBuysAtPause[i]).toFixed(2)} (n=${golds.length})`,
      );
    }

    lines.push('\nFull-clear rate by character (opening party | fought in run at all):');
    const names = Object.keys(anyStats).sort(
      (a, b) => (openerStats[b]?.clears ?? 0) / (openerStats[b]?.runs || 1) - (openerStats[a]?.clears ?? 0) / (openerStats[a]?.runs || 1),
    );
    for (const name of names) {
      const opener = openerStats[name] ?? { runs: 0, clears: 0 };
      const any = anyStats[name];
      lines.push(
        `  ${name.padEnd(12)} ${pct(opener.clears, opener.runs).padStart(6)} (n=${opener.runs})  |  ${pct(any.clears, any.runs).padStart(6)} (n=${any.runs})`,
      );
    }

    lines.push('\nActions fired by archetype (Basic + own Special Actions), and idle-turn share:');
    for (const [archetype, counts] of Object.entries(actionCountsByArchetype)) {
      const total = Object.values(counts).reduce((sum, n) => sum + n, 0);
      const parts = Object.entries(counts)
        .sort(([, a], [, b]) => b - a)
        .map(([id, n]) => `${id} ${pct(n, total)}`);
      const stall = stalledTurnsByArchetype[archetype];
      lines.push(`  ${archetype}: idle ${pct(stall.stalled, stall.total)} | ${parts.join(', ')}`);
    }
    console.log(lines.join('\n'));

    expect(true).toBe(true);
  });
});
