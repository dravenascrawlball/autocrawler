import type { CharacterPoolEntry } from '../sim/characterPool';
import type { SpecialAction } from '../sim/specialActions';
import {
  THARAVEL_RALLY_CRY_SPECIAL,
  DRIFTA_ADRENALINE_RUSH_SPECIAL,
  GUDRUN_BLOODLUST_SPECIAL,
  DAWNETH_CLEANSE_SPECIAL,
  ISILWEN_WILD_CARD_SPECIAL,
  BODIL_BULWARK_SPECIAL,
  GLINT_HOLD_THE_LINE_SPECIAL,
  FALLACY_BATTLE_ORDERS_SPECIAL,
  MIRKA_SHOCKWAVE_SPECIAL,
  NERISSA_FENCE_THE_LOOT_SPECIAL,
  DRAVENA_BLINK_SPECIAL,
  CALADWEN_AMBUSH_SPECIAL,
  MELPOMENE_VOLLEY_SPECIAL,
  MIRA_SECOND_CHANCE_SPECIAL,
} from './specialActions';

/**
 * What earns a character's unlock, checked against state/runHistory.ts
 * (see state/progression.ts's isUnlockEarned):
 * - `clear-run`: completed at least one run with them in the party.
 * - `reach-room`: won at least `roomsWon` rooms in a single run with them.
 * - `runs`: taken them on at least `count` runs, however those ended.
 */
export type UnlockCondition =
  | { kind: 'clear-run' }
  | { kind: 'reach-room'; roomsWon: number }
  | { kind: 'runs'; count: number };

export interface CharacterUnlock {
  entry: CharacterPoolEntry;
  condition: UnlockCondition;
}

const special = (specialAction: SpecialAction): CharacterPoolEntry => ({ kind: 'special-action', specialAction });

const CLEAR_RUN: UnlockCondition = { kind: 'clear-run' };
const REACH_ROOM_4: UnlockCondition = { kind: 'reach-room', roomsWon: 3 };
const THREE_RUNS: UnlockCondition = { kind: 'runs', count: 3 };

/**
 * Meta-progression: one extra Special Action pool candidate per character,
 * merged into their template's own pool at join/reset time (see
 * sim/adventurer.ts's createAdventurer / rerollPoolPicks) once its
 * condition is met. Keyed by character name (matches
 * AdventurerTemplate.name). Unlocking adds variety to the random draw — it
 * doesn't guarantee the Special. The unlock content pass (docs/roadmap.md)
 * gave everyone but Dee one; weaker characters got easier conditions
 * ("3 runs") and slightly stronger Specials (Fallacy, Melpomene).
 */
export const CHARACTER_UNLOCK_POOL: Record<string, CharacterUnlock[]> = {
  Tharavel: [{ entry: special(THARAVEL_RALLY_CRY_SPECIAL), condition: CLEAR_RUN }],
  Drifta: [{ entry: special(DRIFTA_ADRENALINE_RUSH_SPECIAL), condition: CLEAR_RUN }],
  Gudrun: [{ entry: special(GUDRUN_BLOODLUST_SPECIAL), condition: THREE_RUNS }],
  Dawneth: [{ entry: special(DAWNETH_CLEANSE_SPECIAL), condition: REACH_ROOM_4 }],
  Isilwen: [{ entry: special(ISILWEN_WILD_CARD_SPECIAL), condition: CLEAR_RUN }],
  Bodil: [{ entry: special(BODIL_BULWARK_SPECIAL), condition: REACH_ROOM_4 }],
  Glint: [{ entry: special(GLINT_HOLD_THE_LINE_SPECIAL), condition: THREE_RUNS }],
  Fallacy: [{ entry: special(FALLACY_BATTLE_ORDERS_SPECIAL), condition: THREE_RUNS }],
  Mirka: [{ entry: special(MIRKA_SHOCKWAVE_SPECIAL), condition: REACH_ROOM_4 }],
  Nerissa: [{ entry: special(NERISSA_FENCE_THE_LOOT_SPECIAL), condition: CLEAR_RUN }],
  Dravena: [{ entry: special(DRAVENA_BLINK_SPECIAL), condition: REACH_ROOM_4 }],
  Caladwen: [{ entry: special(CALADWEN_AMBUSH_SPECIAL), condition: THREE_RUNS }],
  Melpomene: [{ entry: special(MELPOMENE_VOLLEY_SPECIAL), condition: THREE_RUNS }],
  Mira: [{ entry: special(MIRA_SECOND_CHANCE_SPECIAL), condition: CLEAR_RUN }],
};
