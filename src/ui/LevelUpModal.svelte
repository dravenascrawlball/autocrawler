<script lang="ts">
  import { roster } from '../state/roster';
  import LevelUpView from './LevelUpView.svelte';
  import { portraitAssetPath } from './portraits';
  import ImageReportButton from './ImageReportButton.svelte';

  export let adventurerId: string | null = null;

  $: adventurer = adventurerId ? ($roster.adventurers.find((a) => a.id === adventurerId) ?? null) : null;

  function fallbackToIdle(event: Event, archetype: string): void {
    const img = event.currentTarget as HTMLImageElement;
    img.src = portraitAssetPath(archetype, 'idle');
  }

  // `adventurer` can go null (choice resolved, no more pending) in the same tick this modal's own
  // <img> emits a failed-load `error` event — the handler below reads the live reactive binding,
  // not a snapshot, so it must guard against that instead of assuming the element it's still
  // attached to implies a non-null adventurer.
</script>

{#if adventurer && adventurer.pendingUpgradeChoices.length > 0}
  <!-- No close control anywhere here, deliberately — a pending level-up forces a choice before
       play continues, rather than being something to dismiss and revisit later. -->
  <div class="modal-backdrop" role="dialog" aria-modal="true" aria-label="{adventurer.name} level up">
    <div class="modal">
      <img
        class="modal__art"
        src={portraitAssetPath(adventurer.archetype, 'town')}
        on:error={(event) => adventurer && fallbackToIdle(event, adventurer.archetype)}
        alt="{adventurer.archetype} leveling up"
      />
      <span class="modal__scrim" aria-hidden="true"></span>

      <ImageReportButton
        imageRef={portraitAssetPath(adventurer.archetype, 'town')}
        style="top: 10px; right: 10px;"
      />

      <div class="modal__box">
        <LevelUpView adventurerId={adventurer.id} />
      </div>
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
    width: min(1040px, 96vw);
    max-height: 90vh;
    /* Matches the 1800x1240 "town" portrait art (see CharacterCard/CharacterSheetView's own
       aspect-ratio) so the full landscape image shows instead of a cropped portrait-shaped slice. */
    aspect-ratio: 45 / 31;
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
  }

  .modal__box {
    position: relative;
    z-index: 2;
    width: 100%;
    max-height: 78%;
    overflow-y: auto;
    padding: 16px;
  }

  .modal__box :global(section) {
    background: transparent;
    border: none;
    box-shadow: none;
    padding: 0;
    margin: 0;
  }
</style>
