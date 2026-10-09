import type { Trait } from '../sim/traits';
import { MILESTONE_TRAITS } from '../sim/traits';
import { HERO_QUIRK_POOL } from './quirks';

/** Floor-boss reward pool (sim/milestones.ts): the good hero Quirks plus the stronger, reward-only Milestone Traits. */
export const MILESTONE_REWARD_POOL: Trait[] = [...HERO_QUIRK_POOL.filter((quirk) => quirk.quirk === 'good'), ...MILESTONE_TRAITS];
