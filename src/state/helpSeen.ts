import { writable } from 'svelte/store';

const STORAGE_KEY = 'autocrawler:help-seen';

function readSeen(): boolean {
  try {
    return globalThis.localStorage.getItem(STORAGE_KEY) === '1';
  } catch {
    return false;
  }
}

/** Whether the first-time help overlay has already been shown/dismissed on this browser. */
export const helpSeen = writable<boolean>(readSeen());

export function markHelpSeen(): void {
  helpSeen.set(true);
  try {
    globalThis.localStorage.setItem(STORAGE_KEY, '1');
  } catch {
    // Best-effort — worst case the overlay just shows again next visit.
  }
}
