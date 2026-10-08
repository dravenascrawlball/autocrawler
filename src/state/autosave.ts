import { get } from 'svelte/store';
import { roster } from './roster';
import { townStorage } from './townStorage';
import { dayCount } from './dayCount';
import { activeRun } from './activeRun';
import { recruitmentPool } from './recruitmentPool';
import { runHistory } from './runHistory';
import { metaProgression } from './metaProgression';
import { saveGame } from './persistence';
import { debounce } from './debounce';

const AUTO_SAVE_DEBOUNCE_MS = 300;

/**
 * Importing this module wires auto-save into the town/run stores: any
 * change to the roster, town storage (items + gold), day count, active
 * run, recruitment pool (day advance, run start/end, room completion,
 * equip/unequip, deck edits, recruiting, ...), run history (a completed
 * run), or meta-progression (Renown earned/spent, Kit unlocks bought)
 * schedules a save, with rapid bursts collapsed into a single write.
 */
const scheduleSave = debounce(() => {
  saveGame({
    roster: get(roster),
    townStorage: get(townStorage),
    dayCount: get(dayCount),
    activeRun: get(activeRun),
    recruitmentPool: get(recruitmentPool),
    runHistory: get(runHistory),
    metaProgression: get(metaProgression),
  });
}, AUTO_SAVE_DEBOUNCE_MS);

roster.subscribe(scheduleSave);
townStorage.subscribe(scheduleSave);
dayCount.subscribe(scheduleSave);
activeRun.subscribe(scheduleSave);
recruitmentPool.subscribe(scheduleSave);
runHistory.subscribe(scheduleSave);
metaProgression.subscribe(scheduleSave);
