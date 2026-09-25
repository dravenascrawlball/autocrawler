import { writable, get } from 'svelte/store';
import type { Adventurer } from '../sim/adventurer';
import { generateDraftRound, DRAFT_ROUND_COUNT, DRAFT_OFFERS_PER_ROUND } from '../sim/draft';
import { roster } from './roster';

/**
 * An in-progress party draft (roadmap: roguelite draft rework) — Embark now
 * means "draft 4 characters, one at a time" instead of toggling a standing
 * active party. Each round offers DRAFT_OFFERS_PER_ROUND random unlocked
 * characters; the player can instead always substitute any already-
 * recruited character (see sim/recruitment.ts) not yet picked this draft.
 */
export interface DraftState {
  /** 0-based; DRAFT_ROUND_COUNT once every pick is in. */
  roundIndex: number;
  /** This round's random offers — empty once the draft is complete. */
  offers: Adventurer[];
  /** Already-chosen party members, in pick order. */
  picks: Adventurer[];
}

export const draftState = writable<DraftState | null>(null);

function rollRound(picks: Adventurer[], rng: () => number): Adventurer[] {
  const alreadyPicked = new Set(picks.map((adventurer) => adventurer.id));
  return generateDraftRound(get(roster).adventurers, alreadyPicked, rng);
}

/** Starts a fresh draft: resets to round 0 and rolls its offers. */
export function startDraft(rng: () => number = Math.random): void {
  draftState.set({ roundIndex: 0, offers: rollRound([], rng), picks: [] });
}

/**
 * Picks `adventurerId` for the current round — either one of this round's
 * offers, or (always allowed) any currently-recruited character not yet
 * picked this draft. No-ops if there's no draft in progress, the draft is
 * already complete, the id was already picked, or it's neither offered nor
 * a valid recruited substitute.
 */
export function pickDraftOffer(adventurerId: string, rng: () => number = Math.random): void {
  const current = get(draftState);
  if (!current || current.roundIndex >= DRAFT_ROUND_COUNT) {
    return;
  }

  const alreadyPicked = new Set(current.picks.map((adventurer) => adventurer.id));
  if (alreadyPicked.has(adventurerId)) {
    return;
  }

  const rosterState = get(roster);
  const isOffered = current.offers.some((adventurer) => adventurer.id === adventurerId);
  const isRecruitedSubstitute = rosterState.recruitedIds.includes(adventurerId);
  if (!isOffered && !isRecruitedSubstitute) {
    return;
  }

  const picked = rosterState.adventurers.find((adventurer) => adventurer.id === adventurerId);
  if (!picked) {
    return;
  }

  const picks = [...current.picks, picked];
  const roundIndex = current.roundIndex + 1;
  const offers = roundIndex < DRAFT_ROUND_COUNT ? rollRound(picks, rng) : [];

  draftState.set({ roundIndex, offers, picks });
}

/** True once every round has a pick. */
export function isDraftComplete(state: DraftState | null): boolean {
  return state !== null && state.picks.length >= DRAFT_ROUND_COUNT;
}

/** Clears the in-progress draft (e.g. once Embark actually starts the run with its picks). */
export function clearDraft(): void {
  draftState.set(null);
}

export { DRAFT_ROUND_COUNT, DRAFT_OFFERS_PER_ROUND };
