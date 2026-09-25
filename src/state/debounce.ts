/**
 * Returns a debounced wrapper around `fn`: rapid sequential calls collapse
 * into a single invocation, `delayMs` after the last call.
 */
export function debounce<Args extends unknown[]>(
  fn: (...args: Args) => void,
  delayMs: number,
): (...args: Args) => void {
  let handle: ReturnType<typeof setTimeout> | undefined;

  return (...args: Args) => {
    if (handle !== undefined) {
      clearTimeout(handle);
    }
    handle = setTimeout(() => {
      handle = undefined;
      fn(...args);
    }, delayMs);
  };
}
