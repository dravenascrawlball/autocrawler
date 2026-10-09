<script lang="ts">
  import { roster } from '../state/roster';
  import { acknowledgeDowned } from '../state/dungeonOrchestrator';
  import { downedArtPath, downedArtCandidates } from './portraits';
  import { fallbackSrc } from './imageFallback';
  import ImageReportButton from './ImageReportButton.svelte';

  export let adventurerId: string | null = null;

  let statsHidden = false;
  // Reset whenever the popup moves on to a different (or a fresh) adventurer, so "Hide Stats"
  // from a previous down doesn't carry over.
  $: adventurerId, (statsHidden = false);

  $: adventurer = adventurerId ? ($roster.adventurers.find((a) => a.id === adventurerId) ?? null) : null;
  $: summary = adventurer?.downedSummary ?? null;
</script>

{#if adventurer && summary && !summary.acknowledged}
  <div class="modal-backdrop" role="dialog" aria-modal="true" aria-label="{adventurer.name} downed">
    <div class="modal">
      <img
        class="modal__art"
        use:fallbackSrc={downedArtCandidates(adventurer, summary.killerArchetype)}
        alt=""
      />
      <span class="modal__scrim" class:modal__scrim--hidden={statsHidden} aria-hidden="true"></span>

      <ImageReportButton
        imageRef={downedArtPath(adventurer.archetype, summary.killerArchetype)}
        style="top: 12px; right: 90px;"
      />

      <button type="button" class="modal__toggle" on:click={() => (statsHidden = !statsHidden)}>
        {statsHidden ? 'Show Stats' : 'Hide Stats'}
      </button>

      {#if !statsHidden}
        <div class="modal__box">
          <h2>
            {adventurer.name} was defeated{summary.killerArchetype ? ` by a ${summary.killerArchetype}` : ''}!
          </h2>
          <dl class="modal__stats">
            <dt>Damage Done</dt>
            <dd>{summary.damageDone}</dd>
            <dt>Damage Taken</dt>
            <dd>{summary.damageTaken}</dd>
            <dt>Healed</dt>
            <dd>{summary.healed}</dd>
          </dl>
          <button type="button" on:click={() => adventurer && acknowledgeDowned(adventurer.id)}>Continue</button>
        </div>
      {:else}
        <div class="modal__box modal__box--minimal">
          <button type="button" on:click={() => adventurer && acknowledgeDowned(adventurer.id)}>Continue</button>
        </div>
      {/if}
    </div>
  </div>
{/if}

<style>
  .modal-backdrop {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.75);
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 24px;
    z-index: 200;
  }

  .modal {
    position: relative;
    width: min(1400px, 96vw);
    height: min(90vh, calc(min(1400px, 96vw) * 9 / 16));
    background: var(--bg-raised);
    border: 1px solid var(--panel-border);
    border-radius: 8px;
    box-shadow: var(--shadow);
    overflow: hidden;
    display: flex;
    align-items: flex-end;
  }

  .modal__art {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    object-fit: cover;
    object-position: top center;
    z-index: 0;
  }

  .modal__scrim {
    position: absolute;
    inset: 0;
    background: linear-gradient(to bottom, transparent 30%, rgba(0, 0, 0, 0.92) 75%);
    z-index: 1;
    transition: background 0.15s ease;
  }

  /* Hide Stats keeps just enough of a shadow for the Continue button to stay legible. */
  .modal__scrim--hidden {
    background: linear-gradient(to bottom, transparent 80%, rgba(0, 0, 0, 0.85) 100%);
  }

  .modal__toggle {
    position: absolute;
    top: 12px;
    right: 12px;
    z-index: 3;
    background: rgba(0, 0, 0, 0.55);
    color: var(--text-heading);
    border: 1px solid var(--panel-border);
    border-radius: 4px;
    padding: 6px 10px;
    cursor: pointer;
  }

  .modal__box {
    position: relative;
    z-index: 2;
    width: 100%;
    max-height: 78%;
    overflow-y: auto;
    padding: 16px;
  }

  .modal__box--minimal {
    max-height: none;
    display: flex;
    justify-content: flex-end;
  }

  .modal__box h2 {
    margin: 0 0 12px;
    color: var(--text-heading);
  }

  .modal__stats {
    display: grid;
    grid-template-columns: auto auto;
    gap: 4px 16px;
    margin: 0 0 16px;
  }

  .modal__stats dt {
    color: var(--text-muted);
  }

  .modal__stats dd {
    margin: 0;
    font-weight: bold;
  }
</style>
