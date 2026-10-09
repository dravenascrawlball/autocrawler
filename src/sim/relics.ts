import type { Adventurer } from './adventurer';
import type { StatModifier } from './stats';
import type { TagId } from './tags';
import { hasTag } from './tags';

/**
 * A whole-party buff bought from the between-room shop's Relics section —
 * distinct from an Item (per-character equipment, see items.ts): a Relic
 * applies to every current and future party member for the rest of the
 * run, never to just one. Lasts until the run ends (resetToTemplateBaseline
 * clears the granted modifiers along with everything else mid-run-only).
 */
export interface Relic {
  id: string;
  name: string;
  description: string;
  /** Applied to every party member while this relic is active — source should read `relic:<relicId>`. */
  modifiers: StatModifier[];
  /** Gold cost in the between-room shop. */
  price: number;
  /**
   * A relic that grows over the run (roadmap item 6, in-run snowballing):
   * every party member gets `percentPerUnit`% of `stat` per room cleared so
   * far, or per current party member. Recomputed at each room start (see
   * applyRelicScaling) rather than granted once on purchase.
   */
  scaling?: {
    stat: string;
    percentPerUnit: number;
    /** 'flat' = a fixed bonus (percentPerUnit once), recomputed each room — useful with requiresTag. */
    per: 'room-cleared' | 'party-member' | 'flat';
    /** Only party members carrying this tag get the bonus (e.g. the Jack-o'-Lantern's 'spooky'). Rechecked every room, so swapping a Kit mid-run is reflected. */
    requiresTag?: TagId;
  };
}

/** Grants `relic`'s modifiers to `adventurer` — called once per party member when a relic is bought, and again for anyone who joins the party afterward (see dungeonOrchestrator.ts's buyRelicOffer/buyRecruitOffer). */
export function applyRelicToAdventurer(adventurer: Adventurer, relic: Relic): void {
  adventurer.modifiers = [...adventurer.modifiers, ...relic.modifiers];
}

/** Grants every relic in `activeRelics` to `adventurer` — used when a new party member joins mid-run, so relics bought before they arrived still apply to them. */
export function applyActiveRelicsToAdventurer(adventurer: Adventurer, activeRelics: Relic[]): void {
  for (const relic of activeRelics) {
    applyRelicToAdventurer(adventurer, relic);
  }
}

const RELIC_SCALING_SOURCE_PREFIX = 'relic-scaling:';

/**
 * Re-applies every scaling relic's current bonus to the whole party (see
 * Relic.scaling) — called at each room start (dungeonRun.ts's
 * resolveNextRoom) with the number of rooms cleared so far, so the bonus
 * keeps growing as the run goes on and covers anyone recruited since.
 */
export function applyRelicScaling(party: Adventurer[], activeRelics: Relic[], roomsCleared: number): void {
  const scaling = activeRelics.filter((relic) => relic.scaling);
  for (const member of party) {
    const earned = scaling
      .filter((relic) => !relic.scaling!.requiresTag || hasTag(member, relic.scaling!.requiresTag))
      .map((relic) => {
        const { stat, percentPerUnit, per } = relic.scaling!;
        const units = per === 'room-cleared' ? roomsCleared : per === 'party-member' ? party.length : 1;
        return { stat, type: 'percent' as const, amount: units * percentPerUnit, source: `${RELIC_SCALING_SOURCE_PREFIX}${relic.id}` };
      });
    member.modifiers = [
      ...member.modifiers.filter((modifier) => !modifier.source.startsWith(RELIC_SCALING_SOURCE_PREFIX)),
      ...earned,
    ];
  }
}

