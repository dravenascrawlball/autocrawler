import { writable } from 'svelte/store';
import { INITIAL_SAVE } from './persistence';

/** Sourced from a save if one exists; otherwise a fresh run starts on day 0. */
export const dayCount = writable<number>(INITIAL_SAVE?.dayCount ?? 0);
