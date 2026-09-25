import { get } from 'svelte/store';
import { roster } from './roster';
import { dungeonPlayback } from './dungeonPlayback';
import { currentLevelUpOffers } from './levelUpOffers';
import {
  resolveUpgradeChoice as simResolveUpgradeChoice,
  generateUpgradeOffers,
  type UpgradeChoice,
  type UpgradeSelection,
  type UpgradeOffer,
} from '../sim/leveling';
import { ALL_PASSIVES } from '../data/passives';

function touchRoster(): void {
  roster.update((state) => ({ ...state }));
}

/**
 * Touches dungeonPlayback too, if a run is in progress: the Adventurer
 * objects a run's party holds are the exact same references as in
 * roster.adventurers (see dungeonOrchestrator.startDungeon), so this is
 * purely to force reactivity for anything bound to $dungeonPlayback (e.g.
 * DungeonPauseView's Level Up section) — the underlying data is already
 * correct either way.
 */
function touchDungeonPlayback(): void {
  dungeonPlayback.update((state) => (state ? { ...state } : state));
}

/**
 * Resolves `adventurerId`'s pending `choice` the way a player's selection
 * would (see sim/leveling.ts's resolveUpgradeChoice) — always reached from
 * the between-room pause screen's LevelUpModal queue now (see
 * DungeonPauseView.svelte's nextLevelUpId gating), which guarantees every
 * pending choice is resolved before a run can end. No-ops (returns false)
 * if the adventurer is gone or the choice isn't actually pending for them.
 */
export function resolvePendingUpgrade(adventurerId: string, choice: UpgradeChoice, selection: UpgradeSelection): boolean {
  const adventurer = get(roster).adventurers.find((a) => a.id === adventurerId);
  if (!adventurer) {
    return false;
  }

  try {
    simResolveUpgradeChoice(adventurer, choice, selection);
  } catch {
    return false;
  }

  touchRoster();
  touchDungeonPlayback();
  return true;
}

/**
 * Rolls (or returns the already-cached) 3 concrete offers for `choice` —
 * see sim/leveling.ts's generateUpgradeOffers and state/levelUpOffers.ts's
 * doc comment for why the roll is cached per-choiceId rather than redone on
 * every call. Returns null if the adventurer is gone.
 */
export function rollOffersForChoice(
  adventurerId: string,
  choice: UpgradeChoice,
  rng: () => number = Math.random,
): UpgradeOffer[] | null {
  const cached = get(currentLevelUpOffers);
  if (cached && cached.choiceId === choice.id) {
    return cached.offers;
  }

  const adventurer = get(roster).adventurers.find((a) => a.id === adventurerId);
  if (!adventurer) {
    return null;
  }

  const offers = generateUpgradeOffers(adventurer, ALL_PASSIVES, rng);
  currentLevelUpOffers.set({ choiceId: choice.id, offers });
  return offers;
}

/**
 * Resolves `choice` with `offer` — the state-layer counterpart to
 * `resolvePendingUpgrade`, but taking a rolled `UpgradeOffer` (from
 * `rollOffersForChoice`) instead of a raw `UpgradeSelection`. `faceIndex`
 * is required only for a `'new-face'` offer (see sim/leveling.ts's
 * UpgradeSelection — a new Face auto-applies onto that slot when picked).
 * Clears the cached offers for `choice` on success, so the next pending
 * choice rolls fresh ones.
 */
export function resolveOffer(adventurerId: string, choice: UpgradeChoice, offer: UpgradeOffer, faceIndex?: number): boolean {
  let selection: UpgradeSelection;
  if (offer.type === 'action-level') {
    selection = { type: 'action-level', actionId: offer.action.id };
  } else if (offer.type === 'new-face') {
    if (faceIndex === undefined) {
      return false;
    }
    selection = { type: 'new-face', action: offer.action, faceIndex };
  } else {
    selection = { type: 'passive', passive: offer.passive };
  }

  const succeeded = resolvePendingUpgrade(adventurerId, choice, selection);
  if (succeeded) {
    currentLevelUpOffers.set(null);
  }
  return succeeded;
}
