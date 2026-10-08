<script context="module" lang="ts">
  import type { GridPosition } from '../sim/formation';

  export interface LayoutUnit {
    id: string;
    name: string;
    position: GridPosition;
    /** Which side of the battle view this unit renders on — determines which half of the unified grid it appears in (see columnForSide below, mirroring game/RoomReplayScene.ts's columnForUnit). */
    side: 'party' | 'enemy';
    hp?: number;
    maxHp?: number;
  }
</script>

<script lang="ts">
  /**
   * A single 6-column x 3-row grid mirroring the actual battle view's layout
   * (see game/RoomReplayScene.ts's columnForUnit): party on the left reading
   * back-to-front left-to-right (columns 0-2, rank 2/1/0), enemies on the
   * right reading front-to-back left-to-right (columns 3-5, rank 0/1/2) — so
   * both sides' front lines sit nearest the middle, exactly as they will in
   * battle. Lane (0-2) is the row, top to bottom.
   */
  export let units: LayoutUnit[] = [];
  /** Read-only (plain preview) vs clickable (party placement) — only the party's three columns are ever clickable; the enemy preview columns never are. */
  export let interactive = false;
  /** Currently-selected party unit id — clicking a party cell while this is set moves (or swaps with whoever's there) that unit to the clicked cell. */
  export let selectedId: string | null = null;
  export let onCellClick: (position: GridPosition) => void = () => {};

  const COLUMNS = [0, 1, 2, 3, 4, 5] as const;
  const LANES = [0, 1, 2] as const;

  function columnSide(column: number): 'party' | 'enemy' {
    return column < 3 ? 'party' : 'enemy';
  }

  /** Inverse of game/RoomReplayScene.ts's columnForUnit, for a given column+side. */
  function rankForColumn(column: number, side: 'party' | 'enemy'): 0 | 1 | 2 {
    return (side === 'party' ? 2 - column : column - 3) as 0 | 1 | 2;
  }
</script>

<div class="layout-grid" class:layout-grid--interactive={interactive}>
  {#each LANES as lane (lane)}
    <div class="layout-grid__row">
      {#each COLUMNS as column (column)}
        {@const side = columnSide(column)}
        {@const rank = rankForColumn(column, side)}
        {@const cellUnits = units.filter((unit) => unit.side === side && unit.position.lane === lane && unit.position.rank === rank)}
        {@const clickable = interactive && side === 'party'}
        <button
          type="button"
          class="layout-grid__cell"
          class:layout-grid__cell--occupied={cellUnits.length > 0}
          class:layout-grid__cell--selectable={clickable && selectedId !== null}
          class:layout-grid__cell--midline={column === 2 || column === 3}
          disabled={!clickable}
          on:click={() => clickable && onCellClick({ lane, rank })}
        >
          {#each cellUnits as unit (unit.id)}
            <span class="layout-grid__unit" class:layout-grid__unit--selected={unit.id === selectedId}>
              {unit.name}
              {#if unit.maxHp !== undefined}
                <span class="layout-grid__hp">{Math.max(0, unit.hp ?? 0)}/{unit.maxHp}</span>
              {/if}
            </span>
          {/each}
        </button>
      {/each}
    </div>
  {/each}
</div>

<style>
  .layout-grid {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .layout-grid__row {
    display: grid;
    grid-template-columns: repeat(6, 1fr);
    gap: 4px;
    align-items: stretch;
  }

  .layout-grid__cell {
    min-height: 44px;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 2px;
    padding: 4px;
    background: var(--bg-raised);
    border: 1px solid var(--panel-border);
    border-radius: 4px;
    color: var(--text);
    font: inherit;
    cursor: default;
  }

  .layout-grid__cell--midline {
    border-color: var(--gold);
  }

  .layout-grid--interactive .layout-grid__cell--selectable {
    cursor: pointer;
  }

  .layout-grid--interactive .layout-grid__cell--selectable:hover {
    border-color: var(--gold);
  }

  .layout-grid__cell--occupied {
    background: var(--bg-inset);
  }

  .layout-grid__unit {
    font-size: 12px;
    line-height: 1.2;
    text-align: center;
  }

  .layout-grid__unit--selected {
    color: var(--gold-bright);
    font-weight: bold;
  }

  .layout-grid__hp {
    display: block;
    font-size: 10px;
    color: var(--text-muted);
  }
</style>
