<script lang="ts">
  import { TOTAL_ROOMS } from '../data/rooms';
  import { effectiveMaxHp } from '../sim/adventurer';
  import { roster } from '../state/roster';
  import { runHistory } from '../state/runHistory';
  import { metaProgression } from '../state/metaProgression';
  import { clearUnlocksFor, kitsFor } from '../state/progression';
  import { MAX_TRAINING_RANK, TRAINING_PERCENT_PER_RANK } from '../sim/training';
  import { ACTION_DESCRIPTIONS } from './actionDescriptions';
  import { portraitAssetPath, portraitCandidates } from './portraits';
  import { fallbackSrc } from './imageFallback';
  import { displayTitle } from '../sim/kits';
  import ImageReportButton from './ImageReportButton.svelte';

  export let adventurerId: string | null = null;
  export let onClose: () => void = () => {};

  $: adventurer = adventurerId ? ($roster.adventurers.find((a) => a.id === adventurerId) ?? null) : null;
  // Progression (roadmap item 3): run stats, clear-unlocks and Kits — see state/progression.ts.
  $: stats = adventurer ? $runHistory.characterStats[adventurer.id] : undefined;
  $: clearUnlocks = adventurer ? clearUnlocksFor(adventurer.name, adventurer.id, $runHistory) : [];
  $: kits = adventurer ? kitsFor(adventurer.name, $metaProgression.unlockedKitIds) : [];
  $: trainingRank = adventurer ? ($metaProgression.trainingRanks[adventurer.name] ?? 0) : 0;


  function handleBackdropKeydown(event: KeyboardEvent): void {
    if (event.key === 'Escape' || event.key === 'Enter' || event.key === ' ') {
      onClose();
    }
  }
</script>

<svelte:window on:keydown={handleBackdropKeydown} />

{#if adventurer}
  <div
    class="sheet-backdrop"
    on:click={onClose}
    on:keydown={handleBackdropKeydown}
    role="button"
    tabindex="-1"
    aria-label="Close character sheet"
  >
    <div
      class="sheet"
      role="dialog"
      aria-modal="true"
      aria-label="{adventurer.name} character sheet"
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
        <span class="sheet__subtitle">
          {displayTitle(adventurer)} — Lv {adventurer.level}
        </span>
      </div>

      <button type="button" class="sheet__close" on:click={onClose} aria-label="Close character sheet">✕</button>

      <ImageReportButton
        imageRef={portraitAssetPath(adventurer.archetype, 'town')}
        style="top: 10px; right: 50px;"
      />

      <div class="sheet__column sheet__column--left">
        <section class="sheet-box sheet-box--stats">
          <h3>Stats</h3>
          <div class="hp-bar" role="presentation">
            <span class="hp-fill" style="width: {Math.max(0, (adventurer.hp / effectiveMaxHp(adventurer)) * 100)}%"></span>
            <span class="hp-label">{Math.round(adventurer.hp)} / {effectiveMaxHp(adventurer)} HP</span>
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
            <dt>Level</dt>
            <dd>{adventurer.level}</dd>
          </dl>
        </section>

        <section class="sheet-box sheet-box--traits">
          <h3>Traits</h3>
          {#if adventurer.traits.length > 0}
            <ul class="trait-list">
              {#each adventurer.traits as trait (trait.id)}
                <li class="trait-row">
                  <span class="trait-row__name">{trait.name}</span>
                  <span class="trait-row__description">{trait.description}</span>
                </li>
              {/each}
            </ul>
          {:else}
            <p class="empty-state">No traits yet.</p>
          {/if}
        </section>
      </div>

      <div class="sheet__column sheet__column--right">
        <section class="sheet-box sheet-box--kits">
          <h3>Kit &amp; Specials</h3>
          {#if adventurer.activeKit}
            <div class="kit-row">
              <span class="kit-row__name">{adventurer.activeKit.name}</span>
              <span class="kit-row__description">{adventurer.activeKit.description}</span>
            </div>
          {:else}
            <p class="empty-state">No Kit yet.</p>
          {/if}

          {#if adventurer.activeSpecialActions.length > 0}
            <ul class="trait-list">
              {#each adventurer.activeSpecialActions as special (special.id)}
                <li class="trait-row">
                  <span class="trait-row__name">{special.name}</span>
                  <span class="trait-row__description">
                    {ACTION_DESCRIPTIONS[special.action.id] ?? 'No description yet.'}
                  </span>
                </li>
              {/each}
            </ul>
          {:else}
            <p class="empty-state">No Special Action yet.</p>
          {/if}
        </section>

        <section class="sheet-box sheet-box--progress">
          <h3>Unlocks &amp; Progress</h3>
          <p class="progress-stats">
            {#if stats}
              {stats.runs} run{stats.runs === 1 ? '' : 's'} · {stats.clears} clear{stats.clears === 1 ? '' : 's'} · best {stats.bestRoomsWon}/{TOTAL_ROOMS} rooms
            {:else}
              Not taken on a run yet.
            {/if}
            <br />
            Training {trainingRank}/{MAX_TRAINING_RANK}{#if trainingRank > 0}
              (+{trainingRank * TRAINING_PERCENT_PER_RANK}% HP, attack, healing){/if}
          </p>
          {#if clearUnlocks.length === 0 && kits.length === 0}
            <p class="empty-state">Nothing to unlock yet.</p>
          {:else}
            <ul class="trait-list">
              {#each clearUnlocks as unlock (unlock.name)}
                <li class="trait-row" class:trait-row--locked={!unlock.earned}>
                  <span class="trait-row__name">{unlock.earned ? '✓' : '🔒'} {unlock.name}</span>
                  <span class="trait-row__description">
                    {(unlock.actionId ? ACTION_DESCRIPTIONS[unlock.actionId] : unlock.description) ?? ''}
                    {unlock.earned ? 'In their Special pool.' : `${unlock.conditionText} to add it to their Special pool.`}
                  </span>
                </li>
              {/each}
              {#each kits as kit (kit.kitId)}
                <li class="trait-row" class:trait-row--locked={!kit.owned}>
                  <span class="trait-row__name">{kit.owned ? '✓' : '🔒'} Kit: {kit.name}</span>
                  <span class="trait-row__description">
                    {kit.description}
                    {kit.owned ? 'Owned.' : `Buy for ${kit.price} Renown in Progress.`}
                  </span>
                </li>
              {/each}
            </ul>
          {/if}
        </section>
      </div>
    </div>
  </div>
{/if}

<style>
  .progress-stats {
    margin: 0 0 8px;
    font-size: 13px;
    color: var(--text-muted);
  }

  .trait-row--locked {
    opacity: 0.65;
  }

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

  /* Matches the sample art's own ratio (1800x1240) so object-fit: cover
     crops as little as possible instead of chopping off the character. */
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
    display: flex;
    align-items: center;
    gap: 6px;
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
    margin: 0 0 10px;
  }

  .stat-grid dt {
    color: var(--text-muted);
  }

  .stat-grid dd {
    margin: 0;
    text-align: right;
    color: var(--text-heading);
  }

  .empty-state {
    color: var(--text-muted);
    font-size: 13px;
    margin: 0;
  }

  .trait-list {
    display: flex;
    flex-direction: column;
    gap: 8px;
    margin: 0;
    padding: 0;
    list-style: none;
  }

  .trait-row {
    display: flex;
    flex-direction: column;
    gap: 2px;
    padding-bottom: 8px;
    border-bottom: 1px solid var(--panel-border);
  }

  .trait-list li.trait-row:last-child {
    padding-bottom: 0;
    border-bottom: none;
  }

  .trait-row__name {
    color: var(--gold-bright);
    font-family: var(--font-heading);
  }

  .trait-row__description {
    font-size: 13px;
    color: var(--text);
  }

  .kit-row {
    display: flex;
    flex-direction: column;
    gap: 2px;
    margin-bottom: 10px;
    padding-bottom: 10px;
    border-bottom: 1px solid var(--panel-border);
  }

  .kit-row__name {
    color: var(--gold-bright);
    font-family: var(--font-heading);
  }

  .kit-row__description {
    font-size: 13px;
    color: var(--text);
  }
</style>
