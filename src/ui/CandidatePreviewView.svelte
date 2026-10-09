<script lang="ts">
  import { recruitmentPool } from '../state/recruitmentPool';
  import { metaProgression } from '../state/metaProgression';
  import { recruitAdventurer } from '../state/townActions';
  import { ENCHANTMENT_REGISTRY } from '../sim/enchantments';
  import { portraitAssetPath, portraitCandidates } from './portraits';
  import { fallbackSrc } from './imageFallback';
  import { displayTitle } from '../sim/kits';
  import ImageReportButton from './ImageReportButton.svelte';

  export let candidateId: string | null = null;
  export let onClose: () => void = () => {};

  $: candidate = candidateId ? ($recruitmentPool.find((c) => c.id === candidateId) ?? null) : null;


  function handleRecruit(): void {
    if (!candidate) return;
    if (recruitAdventurer(candidate.id)) {
      onClose();
    }
  }

  function handleBackdropKeydown(event: KeyboardEvent): void {
    if (event.key === 'Escape' || event.key === 'Enter' || event.key === ' ') {
      onClose();
    }
  }
</script>

<svelte:window on:keydown={handleBackdropKeydown} />

{#if candidate}
  {@const adventurer = candidate.adventurer}
  <div
    class="sheet-backdrop"
    on:click={onClose}
    on:keydown={handleBackdropKeydown}
    role="button"
    tabindex="-1"
    aria-label="Close candidate preview"
  >
    <div
      class="sheet"
      role="dialog"
      aria-modal="true"
      aria-label="{adventurer.name} candidate preview"
      tabindex="-1"
      on:click|stopPropagation
      on:keydown|stopPropagation
    >
      <img
        class="sheet__art"
        use:fallbackSrc={portraitCandidates(adventurer, 'town')}
        alt="{adventurer.archetype} in town"
      />

      <div class="sheet__name-badge">
        <span class="sheet__name">{adventurer.name}</span>
        <span class="sheet__subtitle">{displayTitle(adventurer)} — Not Recruited</span>
      </div>

      <button type="button" class="sheet__close" on:click={onClose} aria-label="Close candidate preview">✕</button>

      <ImageReportButton
        imageRef={portraitAssetPath(adventurer.archetype, 'town')}
        style="top: 10px; right: 50px;"
      />

      <div class="sheet__column sheet__column--left">
        <section class="sheet-box sheet-box--stats">
          <h3>Stats</h3>
          <div class="hp-bar" role="presentation">
            <span class="hp-fill" style="width: 100%"></span>
            <span class="hp-label">{adventurer.maxHp} HP</span>
          </div>
          <dl class="stat-grid">
            <dt>Attack</dt>
            <dd>{adventurer.attackPower}</dd>
            <dt>Speed</dt>
            <dd>{adventurer.speed}</dd>
            <dt>Crit Chance</dt>
            <dd>{adventurer.critChance}%</dd>
            {#if adventurer.healPower > 0}
              <dt>Heal Power</dt>
              <dd>{adventurer.healPower}</dd>
            {/if}
          </dl>
        </section>
      </div>

      <div class="sheet__column sheet__column--right">
        <section class="sheet-box sheet-box--dice">
          <h3>Dice Faces</h3>
          <ol class="face-list">
            {#each adventurer.dieFaces as face, index (index)}
              <li class="face-row">
                <span class="face-row__name">
                  {face.action.name}
                  {#if face.enchantmentId}
                    <em>({ENCHANTMENT_REGISTRY[face.enchantmentId].name})</em>
                  {/if}
                </span>
              </li>
            {/each}
          </ol>
        </section>

        <div class="recruit-footer">
          <span class="recruit-footer__cost">Cost: {candidate.cost} Renown</span>
          <button type="button" disabled={$metaProgression.renown < candidate.cost} on:click={handleRecruit}>
            Recruit
          </button>
        </div>
      </div>
    </div>
  </div>
{/if}

<style>
  .sheet-backdrop {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.7);
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 24px;
    z-index: 100;
  }

  .sheet {
    position: relative;
    width: min(1040px, 96vw);
    max-height: 90vh;
    aspect-ratio: 45 / 31;
    background: var(--bg-raised);
    border: 1px solid var(--panel-border);
    border-radius: 8px;
    box-shadow: var(--shadow);
    overflow: hidden;
  }

  .sheet__art {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    object-fit: cover;
    object-position: top center;
    z-index: 0;
  }

  .sheet__name-badge {
    position: absolute;
    top: 14px;
    left: 14px;
    z-index: 2;
    display: flex;
    flex-direction: column;
    gap: 2px;
    padding: 6px 12px;
    background: var(--bg-inset);
    border: 1px solid var(--panel-border);
    border-radius: 6px;
    box-shadow: var(--shadow);
  }

  .sheet__name {
    font-family: var(--font-heading);
    font-size: 16px;
    color: var(--text-heading);
  }

  .sheet__subtitle {
    font-size: 12px;
    color: var(--text-muted);
  }

  .sheet__close {
    position: absolute;
    top: 10px;
    right: 10px;
    z-index: 2;
    padding: 4px 10px;
  }

  .sheet__column {
    position: absolute;
    top: 34%;
    bottom: 4%;
    width: clamp(220px, 27%, 320px);
    display: flex;
    flex-direction: column;
    gap: 12px;
    overflow-y: auto;
    z-index: 1;
  }

  .sheet__column--left {
    left: 4%;
  }

  .sheet__column--right {
    right: 4%;
  }

  .sheet-box {
    background: var(--bg-inset);
    border: 1px solid var(--panel-border);
    border-radius: 6px;
    padding: 12px 14px;
    box-shadow: var(--shadow);
    flex-shrink: 0;
  }

  .sheet-box h3 {
    margin-top: 0;
  }

  .hp-bar {
    position: relative;
    height: 20px;
    border-radius: 4px;
    background: var(--bg);
    border: 1px solid var(--panel-border);
    overflow: hidden;
    margin-bottom: 10px;
  }

  .hp-fill {
    display: block;
    height: 100%;
    background: var(--party);
  }

  .hp-label {
    position: absolute;
    inset: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 12px;
    color: var(--text-heading);
  }

  .stat-grid {
    display: grid;
    grid-template-columns: auto 1fr;
    column-gap: 12px;
    row-gap: 2px;
    margin: 0;
  }

  .stat-grid dt {
    color: var(--text-muted);
  }

  .stat-grid dd {
    margin: 0;
    text-align: right;
    color: var(--text-heading);
  }

  .face-list {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .face-row {
    padding-bottom: 8px;
    border-bottom: 1px solid var(--panel-border);
  }

  .face-list li.face-row:last-child {
    padding-bottom: 0;
    border-bottom: none;
  }

  .face-row__name {
    color: var(--text-heading);
  }

  .recruit-footer {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    flex-shrink: 0;
  }

  .recruit-footer__cost {
    font-family: var(--font-heading);
    color: var(--gold-bright);
  }
</style>
