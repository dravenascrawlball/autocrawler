<script lang="ts">
  import { TOTAL_ROOMS } from '../data/rooms';
  import { roster } from '../state/roster';
  import { runHistory } from '../state/runHistory';
  import { metaProgression } from '../state/metaProgression';
  import { clearUnlocksFor, kitsFor } from '../state/progression';
  import { ACTION_DESCRIPTIONS } from './actionDescriptions';
  import ShopView from './ShopView.svelte';
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
                🔒 Kit: {kit.name} <span class="goal__hint">{kit.price} Renown below</span>
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

<ShopView />

<style>
  .progress {
    margin-bottom: 16px;
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
