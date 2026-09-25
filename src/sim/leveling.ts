import type { Adventurer } from './adventurer';
import type { Action, ActionId } from './action';
import type { StatModifier } from './stats';
import { getEffectiveStat } from './stats';
import { distinctFaceActions, swapInAction } from './partyManagement';
import type { RngSource } from './rng';

export const BASE_XP_TO_NEXT_LEVEL = 16;
export const XP_TO_NEXT_LEVEL_PER_LEVEL = 12;
export const LEVEL_UP_MAX_HP_INCREASE = 5;

/** Placeholder leveling curve: XP requirement grows linearly per level. */
export function xpToNextLevel(level: number): number {
  return BASE_XP_TO_NEXT_LEVEL + (level - 1) * XP_TO_NEXT_LEVEL_PER_LEVEL;
}

/**
 * A permanent bonus picked via a passive-type upgrade choice. Modifiers are
 * granted for good (never removed, unlike an equipped Item) — see
 * resolveUpgradeChoice, and data/passives.ts for the concrete roster.
 */
export interface PassiveAbility {
  id: string;
  name: string;
  /** Stat modifiers granted permanently once picked; source should read `passive:<passiveId>`. */
  modifiers: StatModifier[];
}

export interface UpgradeChoice {
  id: string;
  /** The character level that generated this pending choice. */
  level: number;
  resolved: boolean;
}

export type UpgradeSelection =
  | { type: 'action-level'; actionId: ActionId }
  | { type: 'passive'; passive: PassiveAbility }
  /**
   * Grants one more owned copy of `action` (roadmap item 7 Phase 3) — must
   * already be an action this adventurer owns at least one Face of — and
   * immediately swaps it onto die face `faceIndex`, replacing whatever's
   * slotted there (roadmap item 12: a new Face auto-applies when picked
   * instead of sitting as an unswapped spare); see resolveUpgradeChoice.
   */
  | { type: 'new-face'; action: Action; faceIndex: number };

let nextUpgradeChoiceId = 1;

function createUpgradeChoice(level: number): UpgradeChoice {
  return { id: `upgrade-${nextUpgradeChoiceId++}`, level, resolved: false };
}

/**
 * Awards XP to one adventurer and applies every level-up it crosses (more
 * than one is possible from a single award). Each level-up bumps max HP by
 * a flat amount and queues a pending UpgradeChoice for the player to spend
 * later via `resolveUpgradeChoice`.
 */
export function awardXp(adventurer: Adventurer, amount: number): void {
  adventurer.xp += amount;

  while (adventurer.xp >= adventurer.xpToNextLevel) {
    adventurer.xp -= adventurer.xpToNextLevel;
    adventurer.level += 1;
    adventurer.xpToNextLevel = xpToNextLevel(adventurer.level);

    adventurer.maxHp += LEVEL_UP_MAX_HP_INCREASE;
    adventurer.hp += LEVEL_UP_MAX_HP_INCREASE;

    adventurer.pendingUpgradeChoices.push(createUpgradeChoice(adventurer.level));
  }
}

/** Awards XP to every living (HP > 0) member of `party`; downed members get none. */
export function awardRoomXp(party: Adventurer[], xpAmount: number): void {
  for (const adventurer of party) {
    if (adventurer.hp > 0) {
      awardXp(adventurer, xpAmount);
    }
  }
}

/**
 * Resolves a pending upgrade choice the way a player's selection would:
 * bumps the chosen action's level counter, grants a passive's modifiers
 * permanently, or grants a new owned Face and immediately swaps it onto the
 * chosen slot — then clears the choice from the pending queue. The spare
 * copy pushed onto `ownedFaces` always exists by the time `swapInAction`
 * runs, so that swap always succeeds.
 */
export function resolveUpgradeChoice(
  adventurer: Adventurer,
  choice: UpgradeChoice,
  selection: UpgradeSelection,
): void {
  const index = adventurer.pendingUpgradeChoices.indexOf(choice);
  if (index === -1) {
    throw new Error(`Upgrade choice ${choice.id} is not pending for adventurer ${adventurer.id}`);
  }

  if (selection.type === 'action-level') {
    const currentLevel = adventurer.actionLevels[selection.actionId] ?? 1;
    adventurer.actionLevels[selection.actionId] = currentLevel + 1;
  } else if (selection.type === 'new-face') {
    adventurer.ownedFaces.push(selection.action);
    swapInAction(adventurer, selection.action, selection.faceIndex);
  } else {
    adventurer.passives.push(selection.passive);
    adventurer.modifiers = [...adventurer.modifiers, ...selection.passive.modifiers];
  }

  choice.resolved = true;
  adventurer.pendingUpgradeChoices.splice(index, 1);
}

export const ACTION_LEVEL_PERCENT_PER_LEVEL = 15;

/**
 * Percent bonus (0 at level 1, scaling by ACTION_LEVEL_PERCENT_PER_LEVEL per
 * level beyond that) for `actionId` at `adventurer`'s current level in it.
 * Actions apply this to their own core number (see attack.ts/heal.ts) —
 * it's a shared default, not a requirement: an action can ignore this
 * helper and read `adventurer.actionLevels[actionId]` directly for bespoke
 * per-level effects instead (e.g. a level that changes targeting rather
 * than just scaling a number).
 */
export function actionLevelPercentBonus(adventurer: Adventurer, actionId: ActionId): number {
  const level = adventurer.actionLevels[actionId] ?? 1;
  return (level - 1) * ACTION_LEVEL_PERCENT_PER_LEVEL;
}

/**
 * Actions with no consumer of `actionLevelPercentBonus` at all (see
 * actions/support.ts's Empower/Command/Inspire, actions/attack.ts's Fear,
 * actions/retreat.ts's Retreat) — leveling one of these today would bump
 * `actionLevels` with zero mechanical effect, so they're excluded from the
 * action-level candidate pool in `generateUpgradeOffers` (roadmap item 12).
 * Still offerable as a new-Face candidate: owning more copies changes how
 * often the action fires even without a level to scale. Giving each of
 * these its own bespoke per-level scaling is flagged as separate future
 * work, not part of this pass.
 */
export const ACTIONS_WITHOUT_LEVEL_SCALING: ReadonlySet<ActionId> = new Set([
  'empower',
  'command',
  'inspire',
  'fear',
  'retreat',
]);

/** Actions whose core number is a heal amount rather than damage — purely for offer-preview wording (see actionLevelOffer). */
const HEAL_SHAPED_ACTION_IDS: ReadonlySet<ActionId> = new Set(['heal', 'self-heal', 'mending-charge']);

/** A rolled, concrete level-up option with a precomputed before/after preview — see generateUpgradeOffers. */
export interface UpgradeOfferPreview {
  label: string;
  beforeAfter: string;
}

export type UpgradeOffer =
  | { type: 'action-level'; action: Action; preview: UpgradeOfferPreview }
  | { type: 'new-face'; action: Action; preview: UpgradeOfferPreview }
  | { type: 'passive'; passive: PassiveAbility; preview: UpgradeOfferPreview };

function actionLevelOffer(action: Action): UpgradeOffer {
  const shape = HEAL_SHAPED_ACTION_IDS.has(action.id) ? 'healing' : 'damage';
  return {
    type: 'action-level',
    action,
    preview: { label: action.name, beforeAfter: `+${ACTION_LEVEL_PERCENT_PER_LEVEL}% ${shape}` },
  };
}

function newFaceOffer(adventurer: Adventurer, action: Action): UpgradeOffer {
  const owned = adventurer.ownedFaces.filter((a) => a === action).length;
  return {
    type: 'new-face',
    action,
    preview: { label: action.name, beforeAfter: `${owned} owned -> ${owned + 1} owned` },
  };
}

/**
 * Maps a StatModifier's `stat` to how its current base value is read off an
 * Adventurer — only stats actually stored on the Adventurer object can show
 * a real before/after number this way. A passive modifier targeting
 * anything else (e.g. `interRoomHeal`, whose base lives in dungeonRun.ts,
 * not on Adventurer — importing it here would cycle back through
 * room.ts -> leveling.ts) falls back to a plain delta in
 * `formatModifierPreview` instead of a fabricated before/after.
 */
const READABLE_STAT_BASE: Partial<Record<string, (adventurer: Adventurer) => number>> = {
  maxHp: (a) => a.maxHp,
  speed: (a) => a.speed,
  attackPower: (a) => a.attackPower,
  healPower: (a) => a.healPower,
  accuracy: (a) => a.accuracy,
  evasion: (a) => a.evasion,
  critChance: (a) => a.critChance,
};

function formatModifierPreview(adventurer: Adventurer, modifier: StatModifier): string {
  const readBase = READABLE_STAT_BASE[modifier.stat];
  if (!readBase) {
    const amount = modifier.type === 'percent' ? `+${modifier.amount}%` : `+${modifier.amount}`;
    return `${modifier.stat}: ${amount}`;
  }

  const base = readBase(adventurer);
  const before = getEffectiveStat(base, modifier.stat, adventurer.modifiers);
  const after = getEffectiveStat(base, modifier.stat, [...adventurer.modifiers, modifier]);
  return `${modifier.stat}: ${Math.round(before)} -> ${Math.round(after)}`;
}

function passiveOffer(adventurer: Adventurer, passive: PassiveAbility): UpgradeOffer {
  const beforeAfter = passive.modifiers.map((modifier) => formatModifierPreview(adventurer, modifier)).join(', ');
  return { type: 'passive', passive, preview: { label: passive.name, beforeAfter } };
}

/**
 * Rolls `count` concrete, rollable level-up options for `adventurer` — one
 * unified pool spanning action-level bumps (excluding
 * ACTIONS_WITHOUT_LEVEL_SCALING), new-Face grants (one candidate per action
 * `adventurer` owns at least one Face of — see distinctFaceActions), and
 * passives (every entry in `availablePassives`, injected so sim/ never
 * depends on data/ — passives can repeat/stack, so no already-owned
 * filter). Fully random across the combined pool — same Fisher-Yates
 * partial-shuffle convention as sim/draft.ts's generateDraftRound,
 * including its graceful shrink if the pool has fewer than `count`
 * candidates.
 */
export function generateUpgradeOffers(
  adventurer: Adventurer,
  availablePassives: PassiveAbility[],
  rng: RngSource,
  count = 3,
): UpgradeOffer[] {
  const actions = distinctFaceActions(adventurer);
  const pool: UpgradeOffer[] = [];

  for (const action of actions) {
    if (!ACTIONS_WITHOUT_LEVEL_SCALING.has(action.id)) {
      pool.push(actionLevelOffer(action));
    }
    pool.push(newFaceOffer(adventurer, action));
  }
  for (const passive of availablePassives) {
    pool.push(passiveOffer(adventurer, passive));
  }

  const shuffled = [...pool];
  const drawCount = Math.min(count, shuffled.length);
  for (let i = 0; i < drawCount; i++) {
    const j = i + Math.floor(rng() * (shuffled.length - i));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled.slice(0, drawCount);
}
