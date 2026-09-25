<script lang="ts">
  import type { Adventurer } from '../sim/adventurer';
  import { portraitAssetPath, downedArtPath, downedArtFallbackPath } from './portraits';

  export let adventurer: Adventurer;
  /** Whether the whole card acts as one big button (e.g. open the character sheet, toggle party membership). Leave unset when the only action lives in the actions slot (e.g. a dedicated Recruit button). */
  export let onClick: (() => void) | undefined = undefined;
  /** Highlights the card (e.g. currently in the active party, or its sheet is open). */
  export let selected: boolean = false;
  /** Disables the whole-card button (only meaningful when `onClick` is set). */
  export let disabled: boolean = false;
  /** Shows the HP bar/number, level, and traits — combat-relevant detail that only matters once a run is live. Town views (Roster/Recruit/Embark) set this false; Dungeon views (Between Rooms, Loot) leave it at the default. */
  export let showDetails: boolean = true;

  $: downed = adventurer.hp <= 0;
  $: portraitSrc = downed
    ? downedArtPath(adventurer.archetype, adventurer.downedSummary?.killerArchetype ?? null)
    : portraitAssetPath(adventurer.archetype, 'town');

  // Falls back from a missing killer-specific downed image, to the generic downed image, to idle
  // — same graceful-degradation convention the rest of the portrait system uses.
  let fallbackStep: 'killer' | 'general' | 'idle' = 'killer';
  $: if (portraitSrc) fallbackStep = 'killer';

  function fallbackToIdle(event: Event): void {
    const img = event.currentTarget as HTMLImageElement;
    if (downed && fallbackStep === 'killer') {
      fallbackStep = 'general';
      img.src = downedArtFallbackPath(adventurer.archetype);
      return;
    }
    fallbackStep = 'idle';
    img.src = portraitAssetPath(adventurer.archetype, 'idle');
  }
</script>

<div class="char-card" class:char-card--selected={selected} class:char-card--disabled={onClick && disabled}>
  <img class="char-card__portrait" src={portraitSrc} on:error={fallbackToIdle} alt="" />
  <span class="char-card__scrim" aria-hidden="true"></span>

  {#if onClick}
    <button
      type="button"
      class="char-card__click-target"
      aria-pressed={selected}
      aria-label={adventurer.name}
      {disabled}
      on:click={onClick}
    ></button>
  {/if}

  <span class="char-card__info">
    <span class="char-card__name">{adventurer.name}</span>
    <span class="char-card__role">{adventurer.role}{showDetails ? ` — Lv ${adventurer.level}` : ''}</span>
    {#if showDetails}
      <span class="char-card__hp-bar" role="presentation">
        <span
          class="char-card__hp-fill"
          style="width: {Math.max(0, (adventurer.hp / adventurer.maxHp) * 100)}%"
        ></span>
      </span>
      <span class="char-card__hp-text">HP {adventurer.hp}/{adventurer.maxHp}</span>
    {/if}
    <span class="char-card__tags">
      <slot name="tags" />
    </span>
    {#if showDetails && adventurer.traits.length > 0}
      <span class="char-card__traits">Traits: {adventurer.traits.map((trait) => trait.name).join(', ')}</span>
    {/if}
    <span class="char-card__actions">
      <slot name="actions" />
    </span>
  </span>
</div>

<style>
  .char-card {
    position: relative;
    width: 100%;
    /* Matches the 1800x1240 "town" portrait art (see CharacterSheetView's
       .sheet aspect-ratio) so the full landscape image shows instead of a
       cropped portrait-shaped slice. */
    aspect-ratio: 45 / 31;
    border-radius: 6px;
    overflow: hidden;
    border: 1px solid var(--panel-border);
    background: var(--bg-inset);
  }

  .char-card--disabled {
    opacity: 0.55;
  }

  .char-card--selected {
    border-color: var(--gold);
    box-shadow: 0 0 0 2px var(--gold) inset;
  }

  .char-card__portrait {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    object-fit: cover;
    object-position: center;
  }

  .char-card__scrim {
    position: absolute;
    inset: 0;
    background: linear-gradient(to bottom, transparent 35%, rgba(0, 0, 0, 0.88) 100%);
  }

  .char-card__click-target {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    padding: 0;
    margin: 0;
    border: none;
    background: transparent;
    cursor: pointer;
  }

  .char-card__click-target:disabled {
    cursor: not-allowed;
  }

  .char-card__info {
    position: absolute;
    left: 0;
    right: 0;
    bottom: 0;
    display: flex;
    flex-direction: column;
    gap: 3px;
    padding: 8px;
    /* Lets a click anywhere on the name/role/HP text fall through to char-card__click-target
       beneath it, same as clicking the card itself — only the actions slot (real buttons like
       Recruit) needs to intercept clicks of its own. */
    pointer-events: none;
  }

  .char-card__actions {
    pointer-events: auto;
  }

  .char-card__name {
    font-family: var(--font-heading);
    color: var(--text-heading);
    font-size: 16px;
    line-height: 1.1;
  }

  .char-card__role {
    font-size: 12px;
    color: var(--text-muted);
  }

  .char-card__hp-bar {
    width: 100%;
    height: 6px;
    border-radius: 3px;
    background: var(--bg);
    border: 1px solid var(--panel-border);
    overflow: hidden;
  }

  .char-card__hp-fill {
    display: block;
    height: 100%;
    background: var(--party);
  }

  .char-card__hp-text {
    font-size: 12px;
    color: var(--text-muted);
  }

  .char-card__tags {
    display: flex;
    flex-wrap: wrap;
    gap: 4px;
  }

  .char-card__traits {
    font-size: 11px;
    color: var(--gold-bright);
  }

  .char-card__actions {
    display: flex;
    flex-wrap: wrap;
    gap: 4px;
    margin-top: 2px;
  }

  .char-card__actions:empty {
    margin-top: 0;
  }
</style>
