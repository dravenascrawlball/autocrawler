<script context="module" lang="ts">
  import type { GridPosition } from '../sim/formation';

  export interface BoardUnit {
    id: string;
    name: string;
    archetype: string;
    /** The unit's active Kit, if any — its sprite is tried first (see portraits.ts's bodySpriteCandidates). */
    activeKit?: { artKey: string };
    /** Names of the unit's adjacency abilities (ui/adjacency.ts) — drives the cell highlight and ◆ markers. */
    adjacency?: string[];
    /** "Name: effect" for each of the unit's Quirks (sim/quirks.ts) — shown as a ✦ marker with a tooltip. */
    quirks?: string[];
    position: GridPosition;
    hp?: number;
    maxHp?: number;
  }
</script>

<script lang="ts">
  /**
   * The pre-fight formation board: a 6-column x 3-row grid mirroring the
   * battle view (see game/RoomReplayScene.ts's columnForUnit) — party on the
   * left reading back-to-front (columns 0-2 = rank 2/1/0), enemies on the
   * right reading front-to-back (columns 3-5 = rank 0/1/2), so both front
   * lines meet in the middle. Lane (0-2) is the row, top to bottom.
   *
   * Party members are drawn as their battle sprites and can be dragged
   * between party cells, from the tray onto the grid, or back to the tray.
   * Dropping onto an occupied cell swaps — the actual move rules live in
   * sim/formation.ts's moveToCell, reached through `onPlace`. Dragging uses
   * pointer events (not HTML5 drag-and-drop) so it works with touch too.
   * Click-to-select then click-a-cell still works as a keyboard-friendly
   * fallback, and a plain click on a sprite also reports `onSelect`.
   */
  import { bodySpriteCandidates } from './portraits';
  import { fallbackSrc } from './imageFallback';

  export let partyUnits: BoardUnit[] = [];
  export let enemyUnits: BoardUnit[] = [];
  /** Party members in the placement tray, not on the grid yet (their `position` is ignored). */
  export let trayIds: string[] = [];
  export let selectedId: string | null = null;
  export let onPlace: (id: string, cell: GridPosition) => void = () => {};
  export let onReturnToTray: (id: string) => void = () => {};
  export let onSelect: (id: string) => void = () => {};

  const COLUMNS = [0, 1, 2, 3, 4, 5] as const;
  const LANES = [0, 1, 2] as const;
  /** Pointer travel (px) before a press becomes a drag rather than a click. */
  const DRAG_THRESHOLD = 5;

  $: placed = partyUnits.filter((unit) => !trayIds.includes(unit.id));
  $: tray = trayIds
    .map((id) => partyUnits.find((unit) => unit.id === id))
    .filter((unit): unit is BoardUnit => unit !== undefined);

  // Adjacency (the adjacency pass): when the selected or dragged unit has an adjacency ability, the
  // party cells it reaches light up — from the cell under the pointer while dragging, so you can see
  // the effect of a placement before dropping.
  $: focusUnit = dragging ?? (selectedId ? (placed.find((unit) => unit.id === selectedId) ?? null) : null);
  $: focusCell =
    focusUnit && (focusUnit.adjacency?.length ?? 0) > 0
      ? dragging && hoverTarget && hoverTarget !== 'tray'
        ? (() => {
            const [lane, rank] = hoverTarget.split(',').map(Number);
            return { lane, rank };
          })()
        : placed.some((unit) => unit.id === focusUnit?.id)
          ? focusUnit.position
          : null
      : null;
  $: linkedCells = new Set(
    focusCell
      ? [
          [focusCell.lane - 1, focusCell.rank],
          [focusCell.lane + 1, focusCell.rank],
          [focusCell.lane, focusCell.rank - 1],
          [focusCell.lane, focusCell.rank + 1],
        ]
          .filter(([lane, rank]) => lane >= 0 && lane <= 2 && rank >= 0 && rank <= 2)
          .map(([lane, rank]) => `${lane},${rank}`)
      : [],
  );

  /** Adjacency abilities currently reaching `unit` from placed allies next to it, e.g. ["Glint: Shield Bearer"]. */
  function adjacencyFrom(unit: BoardUnit, all: BoardUnit[]): string[] {
    return all
      .filter(
        (other) =>
          other.id !== unit.id &&
          (other.adjacency?.length ?? 0) > 0 &&
          Math.abs(other.position.lane - unit.position.lane) + Math.abs(other.position.rank - unit.position.rank) === 1,
      )
      .flatMap((other) => (other.adjacency ?? []).map((name) => `${other.name}: ${name}`));
  }

  function rankForColumn(column: number): 0 | 1 | 2 {
    return (column < 3 ? 2 - column : column - 3) as 0 | 1 | 2;
  }

  function unitAt(units: BoardUnit[], lane: number, rank: number): BoardUnit | undefined {
    return units.find((unit) => unit.position.lane === lane && unit.position.rank === rank);
  }



  // --- Drag state ---
  let pressed: { unit: BoardUnit; startX: number; startY: number } | null = null;
  let dragging: BoardUnit | null = null;
  let ghostX = 0;
  let ghostY = 0;
  /** Drop target under the pointer while dragging: a party cell key "lane,rank", or "tray". */
  let hoverTarget: string | null = null;
  /**
   * Set when a press on a sprite ends: the browser may still fire a `click`
   * on the cell underneath right after (e.g. dropping back onto the same
   * cell), which must not also run the click-to-place fallback. Cleared on
   * the next tick if no click arrives.
   */
  let suppressNextClick = false;

  function dropTargetAt(x: number, y: number): string | null {
    const element = document.elementFromPoint(x, y)?.closest('[data-drop]');
    return element instanceof HTMLElement ? (element.dataset.drop ?? null) : null;
  }

  function handlePointerDown(event: PointerEvent, unit: BoardUnit): void {
    if (event.button !== 0) return;
    event.preventDefault();
    pressed = { unit, startX: event.clientX, startY: event.clientY };
    ghostX = event.clientX;
    ghostY = event.clientY;
  }

  function handlePointerMove(event: PointerEvent): void {
    if (!pressed) return;
    ghostX = event.clientX;
    ghostY = event.clientY;
    if (!dragging && Math.hypot(event.clientX - pressed.startX, event.clientY - pressed.startY) >= DRAG_THRESHOLD) {
      dragging = pressed.unit;
    }
    if (dragging) hoverTarget = dropTargetAt(event.clientX, event.clientY);
  }

  function handlePointerUp(event: PointerEvent): void {
    if (!pressed) return;
    const unit = pressed.unit;
    if (dragging) {
      const target = dropTargetAt(event.clientX, event.clientY);
      if (target === 'tray') {
        if (!trayIds.includes(unit.id)) onReturnToTray(unit.id);
      } else if (target) {
        const [lane, rank] = target.split(',').map(Number) as [0 | 1 | 2, 0 | 1 | 2];
        onPlace(unit.id, { lane, rank });
      }
    } else {
      onSelect(unit.id);
    }
    pressed = null;
    dragging = null;
    hoverTarget = null;
    suppressNextClick = true;
    setTimeout(() => (suppressNextClick = false), 0);
  }

  function handleCellClick(lane: 0 | 1 | 2, rank: 0 | 1 | 2): void {
    if (suppressNextClick) {
      suppressNextClick = false;
      return;
    }
    if (selectedId && partyUnits.some((unit) => unit.id === selectedId)) {
      onPlace(selectedId, { lane, rank });
    }
  }
</script>

<svelte:window on:pointermove={handlePointerMove} on:pointerup={handlePointerUp} on:pointercancel={handlePointerUp} />

<div class="board" class:board--dragging={dragging !== null}>
  <div class="board__labels">
    <span>Your Formation</span>
    <span>Enemies</span>
  </div>
  <div class="board__grid">
    {#each LANES as lane (lane)}
      {#each COLUMNS as column (column)}
        {@const isParty = column < 3}
        {@const rank = rankForColumn(column)}
        {@const unit = unitAt(isParty ? placed : enemyUnits, lane, rank)}
        {@const key = `${lane},${rank}`}
        {#if isParty}
          <button
            type="button"
            class="cell cell--party"
            class:cell--midline={column === 2}
            class:cell--hover={hoverTarget === key}
            class:cell--linked={linkedCells.has(key)}
            data-drop={key}
            aria-label={`Lane ${lane + 1}, rank ${rank + 1}${unit ? `: ${unit.name}` : ' (empty)'}`}
            on:click={() => handleCellClick(lane, rank)}
          >
            {#if unit}
              <!-- svelte-ignore a11y-no-static-element-interactions -->
              <span
                class="token"
                class:token--selected={unit.id === selectedId}
                class:token--lifted={dragging?.id === unit.id}
                on:pointerdown={(event) => handlePointerDown(event, unit)}
              >
                <img
                  class="token__sprite"
                  use:fallbackSrc={bodySpriteCandidates(unit, 'party')}
                  alt=""
                  draggable="false"
                />
                <span class="token__name">{unit.name}</span>
                {#if unit.maxHp !== undefined}
                  <span class="token__hp">{Math.max(0, Math.round(unit.hp ?? 0))}/{Math.round(unit.maxHp)}</span>
                {/if}
                {#if (unit.quirks?.length ?? 0) > 0}
                  <span class="token__quirk" title={unit.quirks?.join(', ')}>✦</span>
                {/if}
                {#if adjacencyFrom(unit, placed).length > 0}
                  <span class="token__linked" title={adjacencyFrom(unit, placed).join(', ')}>◆</span>
                {/if}
              </span>
            {/if}
          </button>
        {:else}
          <div class="cell cell--enemy" class:cell--midline={column === 3}>
            {#if unit}
              <span class="token token--enemy">
                <img
                  class="token__sprite"
                  use:fallbackSrc={bodySpriteCandidates(unit, 'enemy')}
                  alt=""
                  draggable="false"
                />
                <span class="token__name">{unit.name}</span>
                {#if unit.maxHp !== undefined}
                  <span class="token__hp">{Math.max(0, Math.round(unit.hp ?? 0))}/{Math.round(unit.maxHp)}</span>
                {/if}
                {#if (unit.quirks?.length ?? 0) > 0}
                  <span class="token__quirk" title={unit.quirks?.join(', ')}>✦</span>
                {/if}
              </span>
            {/if}
          </div>
        {/if}
      {/each}
    {/each}
  </div>

  <div class="tray" class:tray--hover={hoverTarget === 'tray'} data-drop="tray">
    <span class="tray__label">
      {#if tray.length > 0}
        Drag onto your formation — anyone left here is placed automatically.
      {:else}
        Drag a character here to take them off the board.
      {/if}
    </span>
    <div class="tray__tokens">
      {#each tray as unit (unit.id)}
        <!-- svelte-ignore a11y-no-static-element-interactions -->
        <span
          class="token token--tray"
          class:token--selected={unit.id === selectedId}
          class:token--lifted={dragging?.id === unit.id}
          on:pointerdown={(event) => handlePointerDown(event, unit)}
        >
          <img
            class="token__sprite"
            use:fallbackSrc={bodySpriteCandidates(unit, 'party')}
            alt=""
            draggable="false"
          />
          <span class="token__name">{unit.name}</span>
        </span>
      {/each}
    </div>
  </div>
</div>

{#if dragging}
  <img
    class="ghost"
    use:fallbackSrc={bodySpriteCandidates(dragging, 'party')}
    alt=""
    style:left={`${ghostX}px`}
    style:top={`${ghostY}px`}
  />
{/if}

<style>
  .board {
    display: flex;
    flex-direction: column;
    gap: 6px;
    max-width: 640px;
    user-select: none;
  }

  .board--dragging,
  .board--dragging * {
    cursor: grabbing !important;
  }

  .board__labels {
    display: grid;
    grid-template-columns: 1fr 1fr;
    font-size: 12px;
    color: var(--text-muted);
    text-align: center;
  }

  .board__grid {
    display: grid;
    grid-template-columns: repeat(6, minmax(0, 1fr));
    gap: 4px;
  }

  .cell {
    min-height: 92px;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 2px;
    background: var(--bg-raised);
    border: 1px solid var(--panel-border);
    border-radius: 4px;
    color: var(--text);
    font: inherit;
  }

  .cell--party {
    cursor: pointer;
  }

  .cell--party:hover,
  .cell--hover {
    border-color: var(--gold);
  }

  .cell--hover {
    background: var(--bg-inset);
    box-shadow: inset 0 0 0 1px var(--gold);
  }

  .cell--linked {
    box-shadow: inset 0 0 0 2px var(--gold-bright);
  }

  .token__quirk {
    position: absolute;
    top: 2px;
    left: 4px;
    font-size: 11px;
    color: #e0b0ff;
    cursor: help;
  }

  .token__linked {
    position: absolute;
    top: 2px;
    right: 4px;
    font-size: 11px;
    color: var(--gold-bright);
    cursor: help;
  }

  .cell--midline {
    border-color: var(--gold);
  }

  .cell--enemy {
    background: var(--bg-inset);
  }

  .token {
    position: relative;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 1px;
    max-width: 100%;
    touch-action: none;
    cursor: grab;
  }

  .token--enemy {
    cursor: default;
  }

  .token--lifted {
    opacity: 0.3;
  }

  .token__sprite {
    height: 56px;
    width: auto;
    max-width: 100%;
    object-fit: contain;
    pointer-events: none;
  }

  .token__name {
    font-size: 11px;
    line-height: 1.1;
    text-align: center;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    max-width: 100%;
  }

  .token--selected .token__name {
    color: var(--gold-bright);
    font-weight: bold;
  }

  .token__hp {
    font-size: 10px;
    color: var(--text-muted);
  }

  .tray {
    display: flex;
    flex-direction: column;
    gap: 4px;
    min-height: 64px;
    padding: 6px 8px;
    border: 1px dashed var(--panel-border);
    border-radius: 6px;
  }

  .tray--hover {
    border-color: var(--gold);
    background: var(--bg-inset);
  }

  .tray__label {
    font-size: 12px;
    color: var(--text-muted);
  }

  .tray__tokens {
    display: flex;
    flex-wrap: wrap;
    gap: 10px;
  }

  .token--tray {
    width: 64px;
  }

  .ghost {
    position: fixed;
    height: 72px;
    transform: translate(-50%, -60%);
    pointer-events: none;
    z-index: 1000;
    filter: drop-shadow(0 4px 6px rgb(0 0 0 / 0.45));
  }
</style>
