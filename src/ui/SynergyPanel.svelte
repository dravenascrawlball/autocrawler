<script lang="ts">
  import type { Adventurer } from '../sim/adventurer';
  import { partySynergies, tierText } from './synergyText';

  /**
   * Role synergies the party currently contributes to (roadmap item 6 —
   * see sim/synergies.ts): active ones with their bonus, partial ones with
   * how many more members the next tier needs.
   */
  export let party: Adventurer[] = [];

  $: entries = partySynergies(party).map((entry) => ({
    ...entry,
    next: entry.synergy.tiers.find((tier) => tier.count > entry.count) ?? null,
  }));
</script>

{#if entries.length > 0}
  <ul class="synergies">
    {#each entries as entry (entry.synergy.id)}
      <li class="synergy" class:synergy--active={entry.tier !== null} title={entry.synergy.description}>
        <span class="synergy__name">{entry.synergy.name}</span>
        <span class="synergy__count">{entry.count}{entry.next ? `/${entry.next.count}` : ''}</span>
        {#if entry.tier}
          <span class="synergy__bonus">{tierText(entry.tier)}</span>
        {:else if entry.next}
          <span class="synergy__hint">{entry.next.count - entry.count} more: {tierText(entry.next)}</span>
        {/if}
      </li>
    {/each}
  </ul>
{/if}

<style>
  .synergies {
    list-style: none;
    padding: 0;
    margin: 0 0 12px;
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
  }

  .synergy {
    display: flex;
    gap: 6px;
    align-items: baseline;
    padding: 4px 8px;
    font-size: 12px;
    border: 1px solid var(--panel-border);
    border-radius: 4px;
    color: var(--text-muted);
  }

  .synergy--active {
    border-color: var(--gold);
    color: var(--text);
  }

  .synergy__name {
    font-family: var(--font-heading);
    color: var(--text-heading);
  }

  .synergy--active .synergy__bonus {
    color: var(--gold-bright);
  }
</style>
