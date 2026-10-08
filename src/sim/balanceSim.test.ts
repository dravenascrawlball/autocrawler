import { describe, it, expect } from 'vitest';
import { createSeededRng } from './rng';
import { startDungeonRun, resolveNextRoom } from './dungeonRun';
import { MAX_PARTY_SIZE } from './draft';
import { createStarterRoster } from '../data/roster';
import { createStarterDungeonRooms } from '../data/rooms';
import { CHARACTER_TEMPLATES } from '../data/characters';
import { rollRecruitOffers, DEFAULT_RECRUIT_PRICE } from './shopOffers';
import { rollRoomGold } from './gold';
import type { Adventurer } from './adventurer';

/**
 * Not part of the regular suite — a dev tool for the balance pass (see
 * docs/roadmap.md's Renown section), skipped unless BALANCE_SIM is set so
 * it doesn't slow down or clutter `npx vitest run`. Run it directly:
 *   BALANCE_SIM=1 npx vitest run src/sim/balanceSim.test.ts
 * Reruns after changing any placeholder number (gold income, recruit
 * prices, damage, etc.) to see the effect on win rate / attrition.
 */
const RUNS = 500;
const STARTING_SHOP_GOLD = 200;

function average(values: number[]): number {
  return values.reduce((sum, v) => sum + v, 0) / values.length;
}

function recruitCostFor(adventurer: Adventurer): number {
  return CHARACTER_TEMPLATES.find((t) => t.name === adventurer.name)?.recruitCost ?? DEFAULT_RECRUIT_PRICE;
}

/**
 * Greedily spends `gold` on the cheapest roster members first, modeling a
 * cost-conscious player at the opening shop (see state/openingShop.ts) —
 * maximizes starting party size for a given gold grant, rather than a
 * random sample.
 */
function buildStartingParty(roster: Adventurer[], gold: number): { party: Adventurer[]; goldLeft: number } {
  const byPrice = [...roster].sort((a, b) => recruitCostFor(a) - recruitCostFor(b));
  const party: Adventurer[] = [];
  let remaining = gold;
  for (const candidate of byPrice) {
    const cost = recruitCostFor(candidate);
    if (remaining >= cost && party.length < MAX_PARTY_SIZE) {
      party.push(candidate);
      remaining -= cost;
    }
  }
  return { party, goldLeft: remaining };
}

describe.skipIf(!process.env.BALANCE_SIM)('balance simulation', () => {
  it(`reports outcome distribution and leveling speed across ${RUNS} seeded runs`, () => {
    const outcomeCounts = { completed: 0, loss: 0, retreat: 0 };
    const roomsClearedCounts: number[] = [];
    const levelsAtEnd: number[] = [];
    // Index 0 = levels after room 1, index 1 = after room 2, etc. (averaged across all party members, all runs).
    const levelsAfterRoom: number[][] = [[], [], [], [], []];
    let stalemateCount = 0;
    // Gold earned from room wins only (real gameplay also spends on shop/recruit, not modeled here).
    const netGoldPerRun: number[] = [];
    // Per-turn outcome for each party archetype: 'stalled' (rolled face had no valid target at
    // all) or '1' (an action fired — always exactly 0 or 1 now that dice replaced the deck scan).
    const turnCategoriesByArchetype: Record<string, string[]> = {};
    // How many times each specific actionId actually fires, per archetype — action *count* alone
    // doesn't say which action fired, and that's the actual question for a mixed-cost deck like
    // Fighter's [power-attack, attack-nearest].
    const actionIdCountsByArchetype: Record<string, Record<string, number>> = {};

    for (let seed = 0; seed < RUNS; seed++) {
      const rng = createSeededRng(seed);
      const fullRoster = createStarterRoster();
      const { party, goldLeft } = buildStartingParty(fullRoster, STARTING_SHOP_GOLD);
      const rooms = createStarterDungeonRooms(rng);

      try {
        const state = startDungeonRun(party, rooms, goldLeft);
        let outcome: ReturnType<typeof resolveNextRoom> = null;
        let roomIndex = 0;
        let goldEarned = 0;
        let gold = goldLeft;
        while (outcome === null) {
          outcome = resolveNextRoom(state, rng);
          const record = state.roomRecords[roomIndex];
          if (record.result.outcome === 'win') {
            const roomGold = rollRoomGold(state.rooms[roomIndex].enemies, rng);
            goldEarned += roomGold;
            gold += roomGold;
          }
          // Mirror a greedy between-room Shop player: if a pause follows (outcome still null) and
          // the cheapest of this pause's 3 rolled Recruit offers fits the budget, buy it.
          if (outcome === null && state.party.length < MAX_PARTY_SIZE) {
            const recruitOffers = rollRecruitOffers(fullRoster, state.party, recruitCostFor, rng);
            const cheapest = recruitOffers
              .filter((offer) => !offer.alreadyInParty)
              .sort((a, b) => a.price - b.price)[0];
            if (cheapest && gold >= cheapest.price) {
              gold -= cheapest.price;
              state.party.push(cheapest.adventurer);
            }
          }
          for (const member of party) {
            levelsAfterRoom[roomIndex].push(member.level);
          }
          roomIndex += 1;
        }

        outcomeCounts[outcome] += 1;
        roomsClearedCounts.push(state.roomRecords.filter((r) => r.result.outcome === 'win').length);
        netGoldPerRun.push(goldEarned);

        const archetypeById = new Map(party.map((member) => [member.id, member.archetype]));
        for (const record of state.roomRecords) {
          for (const round of record.result.rounds) {
            for (const roundTurn of round.turns) {
              const archetype = archetypeById.get(roundTurn.unitId);
              if (!archetype) continue; // an enemy's turn, not a party member's
              const events = roundTurn.turn.events;
              const actionCount = events.filter((e) => e.type === 'action').length;
              // A rolled face with no valid target at all (e.g. Heal with nobody hurt) is a
              // genuinely idle turn — no movement fallback exists anymore (see formation.ts).
              const category = actionCount > 0 ? String(actionCount) : 'stalled';
              (turnCategoriesByArchetype[archetype] ??= []).push(category);

              const idCounts = (actionIdCountsByArchetype[archetype] ??= {});
              for (const event of events) {
                if (event.type === 'action') {
                  idCounts[event.actionId] = (idCounts[event.actionId] ?? 0) + 1;
                }
              }
            }
          }
        }

        for (const member of party) {
          levelsAtEnd.push(member.level);
        }
      } catch {
        // A room hit its round cap without either side dying (e.g. sustain outpacing damage) — track
        // separately rather than crashing the whole batch; a high count is itself a balance signal.
        stalemateCount += 1;
      }
    }

    console.log(`\n--- Balance sim: ${RUNS} runs ---`);
    if (stalemateCount > 0) {
      console.log(`Stalemates (room hit round cap, excluded from stats below): ${stalemateCount}`);
    }
    console.log(
      `Outcome: completed ${outcomeCounts.completed} (${((100 * outcomeCounts.completed) / RUNS).toFixed(1)}%), ` +
        `loss ${outcomeCounts.loss} (${((100 * outcomeCounts.loss) / RUNS).toFixed(1)}%), ` +
        `retreat ${outcomeCounts.retreat} (${((100 * outcomeCounts.retreat) / RUNS).toFixed(1)}%)`,
    );
    console.log(`Avg rooms cleared: ${average(roomsClearedCounts).toFixed(2)} / 5`);
    console.log(`Avg party level at run end: ${average(levelsAtEnd).toFixed(2)}`);
    console.log(
      'Avg level after each room:',
      levelsAfterRoom.map((lv, i) => `room ${i + 1}: ${lv.length ? average(lv).toFixed(2) : '-'}`).join(', '),
    );
    console.log(
      `Avg net gold per run (loot only): ${average(netGoldPerRun).toFixed(1)}g ` +
        `(min ${Math.min(...netGoldPerRun)}, max ${Math.max(...netGoldPerRun)})`,
    );

    console.log('\nPer-turn outcome by party archetype:');
    for (const [archetype, categories] of Object.entries(turnCategoriesByArchetype)) {
      const counts: Record<string, number> = {};
      for (const c of categories) counts[c] = (counts[c] ?? 0) + 1;
      const pct = (n: number) => ((100 * n) / categories.length).toFixed(0);
      const parts = Object.entries(counts)
        .sort(([a], [b]) => (a === 'stalled' ? -1 : b === 'stalled' ? 1 : Number(a) - Number(b)))
        .map(([category, n]) => `${category === 'stalled' ? category : `${category} action(s)`}: ${pct(n)}%`);
      console.log(`  ${archetype}: ${parts.join(', ')}`);
    }

    console.log('\nWhich action actually fires, by archetype (share of all actions that archetype takes):');
    for (const [archetype, idCounts] of Object.entries(actionIdCountsByArchetype)) {
      const total = Object.values(idCounts).reduce((sum, n) => sum + n, 0);
      const parts = Object.entries(idCounts)
        .sort(([, a], [, b]) => b - a)
        .map(([actionId, n]) => `${actionId}: ${((100 * n) / total).toFixed(0)}% (${n})`);
      console.log(`  ${archetype}: ${parts.join(', ')}`);
    }

    expect(true).toBe(true);
  });
});
