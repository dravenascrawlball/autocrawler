/** A source of numbers in [0, 1); injected everywhere instead of calling Math.random() directly. */
export type RngSource = () => number;

/**
 * Deterministic seedable RNG (mulberry32) so tests can produce reproducible
 * results (e.g. loot drops) without depending on the global Math.random.
 */
export function createSeededRng(seed: number): RngSource {
  let state = seed >>> 0;

  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
