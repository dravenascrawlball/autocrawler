<script lang="ts">
  import { TOTAL_ROOMS } from '../data/rooms';
  import { roster } from '../state/roster';
  import { runHistory } from '../state/runHistory';
  import { metaProgression } from '../state/metaProgression';
  import { clearUnlocksFor, kitsFor } from '../state/progression';
  import { ACTION_DESCRIPTIONS } from './actionDescriptions';
  import ShopView from './ShopView.svelte';
  import RunSummaryView from './RunSummaryView.svelte';
  import { runLog, type RunSummary } from '../state/runSummary';
  import { buyTrainingRank } from '../state/townActions';
  import { MAX_TRAINING_RANK, TRAINING_PERCENT_PER_RANK, trainingCost } from '../sim/training';

  /**
   * The Progress screen (roadmap item 3, replacing the Town hub's old
   * "Meta Progression" card, which only opened the Kit shop): Renown total,
   * each character's run stats and unlock goals — earned ones checked,
   * locked ones with how to get them — and the Kit shop underneath.
   */
  export let onOpenCharacter: (adventurerId: string) => void = () => {};

  $: rows = [...$roster.adventurers].sort((a, b) => a.name.localeCompare(b.name)).map((adventurer) => {
    const unlocks = clearUnlocksFor(adventurer.name, adventurer.id, $runHistory);
    const kits = kitsFor(adventurer.name, $metaProgression.unlockedKitIds);
    const goals = unlocks.length + kits.length;
    const earned = unlocks.filter((u) => u.earned).length + kits.filter((k) => k.owned).length;
    const trainingRank = $metaProgression.trainingRanks[adventurer.name] ?? 0;
    return {
      adventurer,
      stats: $runHistory.characterStats[adventurer.id],
      unlocks,
      kits,
      goals,
      earned,
      trainingRank,
      nextTrainingCost: trainingCost(trainingRank),
    };
  });
  $: totalGoals = rows.reduce((sum, row) => sum + row.goals, 0);

  // Run log (run summary pass): the last few runs, each re-openable as its full summary.
  let openRun: RunSummary | null = null;
  const outcomeLabel = (run: RunSummary) =>
    run.outcome === 'completed' ? 'Cleared' : run.outcome === 'loss' ? `Fell on Floor ${run.floorReached}` : `Retreated on Floor ${run.floorReached}`;
  const shortDate = (ms: number) => new Date(ms).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  $: totalEarned = rows.reduce((sum, row) => sum + row.earned, 0);
</script>

<section class="progress">
  <h2>Progress <span class="progress__renown">{$metaProgression.renown} Renown</span></h2>
  <p class="progress__summary">
    {totalEarned} of {totalGoals} unlocks earned. Renown comes from every room you clear, plus a bonus for finishing a
    run. Training permanently adds +{TRAINING_PERCENT_PER_RANK}% HP, attack and healing per rank (max
    {MAX_TRAINING_RANK}).
  </p>

  <ul class="progress-list">
    {#each rows as row (row.adventurer.id)}
      <li class="progress-row">
        <button type="button" class="progress-row__name" on:click={() => onOpenCharacter(row.adventurer.id)}>
          {row.adventurer.name}
        </button>
        <span class="progress-row__stats">
          {#if row.stats}
            {row.stats.runs} run{row.stats.runs === 1 ? '' : 's'} · {row.stats.clears} clear{row.stats.clears === 1 ? '' : 's'}
            · best {row.stats.bestRoomsWon}/{TOTAL_ROOMS}
          {:else}
            No runs yet
          {/if}
        </span>
        <ul class="progress-row__goals">
          {#each row.unlocks as unlock (unlock.name)}
            <li class:goal--locked={!unlock.earned} title={unlock.actionId ? ACTION_DESCRIPTIONS[unlock.actionId] : unlock.description}>
              {#if unlock.earned}
                ✓ {unlock.name} <span class="goal__hint">in Special pool</span>
              {:else}
                🔒 {unlock.name} <span class="goal__hint">{unlock.conditionText.toLowerCase()}</span>
              {/if}
            </li>
          {/each}
          {#each row.kits as kit (kit.kitId)}
            <li class:goal--locked={!kit.owned} title={kit.description}>
              {#if kit.owned}
                ✓ Kit: {kit.name}
              {:else}
                🔒 Kit: {kit.name} <span class="goal__hint">{kit.howToEarn ? kit.howToEarn.toLowerCase() : `${kit.price} Renown below`}</span>
              {/if}
            </li>
          {/each}
          {#if row.goals === 0}
            <li class="goal--none">No unlocks yet</li>
          {/if}
        </ul>
        <div class="progress-row__training">
          <span class="training__rank">Training {row.trainingRank}/{MAX_TRAINING_RANK}</span>
          {#if row.nextTrainingCost !== null}
            <button
              type="button"
              disabled={$metaProgression.renown < row.nextTrainingCost}
              on:click={() => buyTrainingRank(row.adventurer.name)}
            >
              Train — {row.nextTrainingCost} Renown
            </button>
          {:else}
            <span class="training__max">Max</span>
          {/if}
        </div>
      </li>
    {/each}
  </ul>
</section>

<section class="runs">
  <h3>Recent Runs</h3>
  {#if $runLog.length === 0}
    <p class="progress__summary">No runs finished yet.</p>
  {:else}
    <ul class="runs__list">
      {#each $runLog as run (run.id)}
        <li>
          <button type="button" class="runs__row" on:click={() => (openRun = run)}>
            <span class="runs__date">{shortDate(run.endedAt)}</span>
            <span class="runs__outcome" class:runs__outcome--win={run.outcome === 'completed'}>{outcomeLabel(run)}</span>
            <span class="runs__party">{run.heroes.map((hero) => hero.name).join(', ')}</span>
            <span class="runs__renown">+{run.renown.total} Renown</span>
          </button>
        </li>
      {/each}
    </ul>
  {/if}
</section>

{#if openRun}
  <div class="run-modal-backdrop" role="presentation" on:click={() => (openRun = null)}>
    <!-- svelte-ignore a11y-click-events-have-key-events -->
    <div class="run-modal" role="dialog" aria-modal="true" aria-label="Run summary" tabindex="-1" on:click|stopPropagation>
      <button type="button" class="run-modal__close" aria-label="Close run summary" on:click={() => (openRun = null)}>✕</button>
      <RunSummaryView summary={openRun} />
    </div>
  </div>
{/if}

<ShopView />

<style>
  .progress {
    margin-bottom: 16px;
  }

  .runs {
    margin-bottom: 16px;
  }

  .runs__list {
    list-style: none;
    padding: 0;
    margin: 0;
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .runs__row {
    width: 100%;
    display: grid;
    grid-template-columns: 60px 150px 1fr max-content;
    gap: 10px;
    align-items: center;
    text-align: left;
    padding: 6px 10px;
    font-size: 13px;
    background: var(--bg-inset);
    border: 1px solid var(--panel-border);
    border-radius: 6px;
    cursor: pointer;
  }

  .runs__row:hover {
    border-color: var(--gold);
  }

  @media (max-width: 640px) {
    .runs__row {
      grid-template-columns: 1fr max-content;
    }
    .runs__party {
      display: none;
    }
  }

  .runs__date,
  .runs__party {
    color: var(--text-muted);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .runs__outcome--win {
    color: var(--gold-bright);
  }

  .runs__renown {
    color: var(--text-heading);
  }

  .run-modal-backdrop {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.7);
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 24px;
    z-index: 600;
  }

  .run-modal {
    position: relative;
    width: min(760px, 94vw);
    max-height: 88vh;
    overflow-y: auto;
    background: var(--bg-raised);
    border: 1px solid var(--panel-border);
    border-radius: 8px;
    padding: 20px;
  }

  .run-modal__close {
    position: absolute;
    top: 10px;
    right: 10px;
  }

  .progress__renown {
    color: var(--gold-bright);
    font-size: 16px;
    margin-left: 10px;
  }

  .progress__summary {
    color: var(--text-muted);
    font-size: 13px;
    margin: 0 0 12px;
  }

  .progress-list {
    list-style: none;
    padding: 0;
    margin: 0;
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .progress-row {
    display: grid;
    grid-template-columns: minmax(110px, 160px) minmax(130px, 200px) 1fr;
    gap: 8px 12px;
    align-items: start;
    padding: 8px 10px;
    background: var(--bg-inset);
    border: 1px solid var(--panel-border);
    border-radius: 6px;
  }

  @media (max-width: 640px) {
    .progress-row {
      grid-template-columns: 1fr;
    }
  }

  .progress-row__name {
    justify-self: start;
    background: none;
    border: none;
    padding: 0;
    font-family: var(--font-heading);
    color: var(--text-heading);
    cursor: pointer;
    text-align: left;
  }

  .progress-row__name:hover {
    color: var(--gold-bright);
  }

  .progress-row__stats {
    font-size: 13px;
    color: var(--text-muted);
  }

  .progress-row__goals {
    list-style: none;
    padding: 0;
    margin: 0;
    display: flex;
    flex-wrap: wrap;
    gap: 4px 14px;
    font-size: 13px;
    color: var(--text);
  }

  .progress-row__training {
    grid-column: 1 / -1;
    display: flex;
    align-items: center;
    gap: 10px;
    font-size: 13px;
  }

  .training__rank {
    color: var(--text-muted);
  }

  .training__max {
    color: var(--gold-bright);
  }

  .goal--locked {
    opacity: 0.7;
  }

  .goal--none {
    color: var(--text-muted);
  }

  .goal__hint {
    color: var(--text-muted);
    font-size: 12px;
  }
</style>
