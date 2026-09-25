import { writable, get } from 'svelte/store';
import { createAdventurer, type Adventurer } from '../sim/adventurer';
import { resolveDefaultRow } from '../sim/formation';
import { createStarterRoster } from '../data/roster';
import { CHARACTER_TEMPLATES, DEE_TEMPLATE } from '../data/characters';
import { INITIAL_SAVE } from './persistence';

export interface RosterState {
  /**
   * One persistent record per unlocked character (see
   * data/characters.ts's CHARACTER_TEMPLATES) — always reflects template
   * baseline plus currently equipped gear. Level-ups reset every time a
   * run ends (see sim/adventurer.ts's resetToTemplateBaseline); equipment
   * is the only thing that survives across runs.
   */
  adventurers: Adventurer[];
  /**
   * Ids of characters the player has recruited — grants "always offerable
   * as a draft substitute" rights (see sim/recruitment.ts). Doesn't affect
   * whether a character's equipment persists; every unlocked character's
   * does, recruited or not.
   */
  recruitedIds: string[];
}

/**
 * Drops any saved adventurer whose name no longer matches a current
 * CHARACTER_TEMPLATES entry (e.g. a retired character like Envy) — a save
 * predates that removal, not a corruption, so this just quietly forgets
 * them rather than rejecting the whole save. Also drops their id from
 * recruitedIds if present, since a removed character can't stay recruited.
 */
function dropRetiredCharacters(state: RosterState): RosterState {
  const validNames = new Set(CHARACTER_TEMPLATES.map((template) => template.name));
  const adventurers = state.adventurers.filter((adventurer) => validNames.has(adventurer.name));
  const survivingIds = new Set(adventurers.map((adventurer) => adventurer.id));
  const recruitedIds = state.recruitedIds.filter((id) => survivingIds.has(id));
  return { adventurers, recruitedIds };
}

function createInitialRosterState(): RosterState {
  if (INITIAL_SAVE) {
    return dropRetiredCharacters(INITIAL_SAVE.roster);
  }
  return {
    adventurers: createStarterRoster(),
    recruitedIds: [],
  };
}

/** Sourced from a save if one exists, otherwise /src/data fixtures. */
export const roster = writable<RosterState>(createInitialRosterState());

/**
 * The single fixed code the feedback form's confirmation screen shows after
 * a player submits feedback/an image (see docs/roadmap.md) — matched
 * case-insensitively so "defaulthero"/"DefaultHero"/etc. all work. Not a
 * secret worth hiding in code (anyone can read the bundled JS), same as any
 * other single-shared-code redemption scheme.
 */
const DEE_UNLOCK_CODE = 'DEFAULTHERO';

export type RedeemCodeResult = 'unlocked' | 'already-unlocked' | 'invalid';

/**
 * Settings > "Enter Code" redemption. Unlocking Dee this way skips the
 * normal gold recruitment cost entirely — she's added to both the roster
 * and recruitedIds in one step, as if already recruited, rather than merely
 * becoming offerable in the recruitment pool (see data/characters.ts's
 * DEE_TEMPLATE doc comment).
 */
export function redeemSecretCode(input: string): RedeemCodeResult {
  if (input.trim().toUpperCase() !== DEE_UNLOCK_CODE) {
    return 'invalid';
  }

  const current = get(roster);
  if (current.adventurers.some((adventurer) => adventurer.name === DEE_TEMPLATE.name)) {
    return 'already-unlocked';
  }

  const dee = createAdventurer('dee', DEE_TEMPLATE, resolveDefaultRow(DEE_TEMPLATE));
  roster.set({
    adventurers: [...current.adventurers, dee],
    recruitedIds: [...current.recruitedIds, dee.id],
  });
  return 'unlocked';
}
