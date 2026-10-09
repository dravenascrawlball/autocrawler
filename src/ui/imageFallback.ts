/**
 * Svelte action: `<img use:fallbackSrc={paths} />` loads `paths[0]` and, on
 * each load error, moves to the next path — so Kit costume art (see
 * sim/kits.ts's artKeyFor) can be tried first and quietly fall back to the
 * base character art, then a generic stand-in, until real files exist.
 * Restarts from the top whenever the list changes.
 */
export function fallbackSrc(node: HTMLImageElement, sources: string[]) {
  let list = sources;
  let index = 0;
  const onError = () => {
    if (index < list.length - 1) {
      index += 1;
      node.src = list[index];
    }
  };
  node.addEventListener('error', onError);
  node.src = list[0];

  return {
    update(next: string[]) {
      if (next.join('|') === list.join('|')) return;
      list = next;
      index = 0;
      node.src = list[0];
    },
    destroy() {
      node.removeEventListener('error', onError);
    },
  };
}
