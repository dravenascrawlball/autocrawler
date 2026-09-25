import { writable, get } from 'svelte/store';
import {
  generateRecruitmentPool,
  DEFAULT_RECRUITMENT_POOL_SIZE,
  DEFAULT_RECRUIT_COST,
  type RecruitCandidate,
} from '../sim/recruitment';
import type { Adventurer } from '../sim/adventurer';
import { CHARACTER_TEMPLATES } from '../data/characters';
import { INITIAL_SAVE } from './persistence';
import { roster } from './roster';

/** Resolves a persistent adventurer's recruit cost from their template — sim/ stays decoupled from data/, so this lookup lives here. */
function costFor(adventurer: Adventurer): number {
  const template = CHARACTER_TEMPLATES.find((candidate) => candidate.name === adventurer.name);
  return template?.recruitCost ?? DEFAULT_RECRUIT_COST;
}

function buildPool(): RecruitCandidate[] {
  const state = get(roster);
  return generateRecruitmentPool(state.adventurers, new Set(state.recruitedIds), costFor);
}

function createInitialPool(): RecruitCandidate[] {
  if (INITIAL_SAVE) {
    // Drops any saved candidate for a since-retired character (e.g. Envy) — a save predates that
    // removal, not a corruption; see state/roster.ts's dropRetiredCharacters for the same handling
    // on the roster side.
    const validNames = new Set(CHARACTER_TEMPLATES.map((template) => template.name));
    return INITIAL_SAVE.recruitmentPool.filter((candidate) => validNames.has(candidate.adventurer.name));
  }
  return buildPool();
}

/** Sourced from a save if one exists, otherwise a freshly built pool of DEFAULT_RECRUITMENT_POOL_SIZE candidates. */
export const recruitmentPool = writable<RecruitCandidate[]>(createInitialPool());

/**
 * Recomputes the whole pool from the current roster (dropping anyone
 * already recruited, admitting anyone newly eligible). Called whenever a
 * new day starts — now just the day Embarking consumes, since Resting no
 * longer exists.
 */
export function refreshRecruitmentPool(): void {
  recruitmentPool.set(buildPool());
}

export { DEFAULT_RECRUITMENT_POOL_SIZE };
