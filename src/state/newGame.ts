import { roster } from './roster';
import { townStorage } from './townStorage';
import { dayCount } from './dayCount';
import { activeRun } from './activeRun';
import { dungeonPlayback } from './dungeonPlayback';
import { currentView } from './view';
import { refreshRecruitmentPool } from './recruitmentPool';
import { clearOpeningShop } from './openingShop';
import { createStarterRoster } from '../data/roster';
import { STARTER_TOWN_ITEMS } from '../data/items';
import { createTownStorage } from '../sim/townStorage';

/**
 * Wipes the current save and resets every store to exactly what a brand
 * new install looks like — the same starter roster/town items/day count
 * that `roster.ts`/`townStorage.ts`/`dayCount.ts` fall back to when there's
 * no save to load, plus a freshly rolled recruitment pool. Nobody starts
 * recruited: the first Embark opens onto a fresh opening gold shop (see
 * state/openingShop.ts). Autosave (see autosave.ts) then persists this over
 * whatever save existed before, so there's no separate "clear localStorage"
 * step.
 *
 * Deliberately leaves state/runHistory.ts untouched — it's meant to back
 * future achievements/branching paths ("cleared a run with Gudrun"), which
 * read more like permanent profile progress than save-file state, so a New
 * Game doesn't erase it.
 */
export function resetGame(): void {
  roster.set({ adventurers: createStarterRoster(), recruitedIds: [] });

  const storage = createTownStorage();
  storage.items.push(...STARTER_TOWN_ITEMS);
  townStorage.set(storage);

  dayCount.set(0);
  activeRun.set(null);
  dungeonPlayback.set(null);
  clearOpeningShop();
  currentView.set('town');

  refreshRecruitmentPool();
}
