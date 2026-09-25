<script lang="ts">
  import { roster } from '../state/roster';
  import CharacterCard from './CharacterCard.svelte';

  export let selectedAdventurerId: string | null = null;
  export let onSelect: (id: string) => void = () => {};
  /** Jumps to the Recruit tab, offered from the empty Bench note. */
  export let onGoToRecruit: () => void = () => {};

  $: benched = $roster.adventurers.filter((adventurer) => $roster.recruitedIds.includes(adventurer.id));
  $: draftable = $roster.adventurers.filter((adventurer) => !$roster.recruitedIds.includes(adventurer.id));
</script>

<section>
  <h2>Bench</h2>
  {#if benched.length === 0}
    <p class="empty-note">
      Recruit a character to always have them available —
      <button type="button" class="link-button" on:click={onGoToRecruit}>go to Recruit</button>.
    </p>
  {:else}
    <ul class="roster-grid">
      {#each benched as adventurer (adventurer.id)}
        <li>
          <CharacterCard
            {adventurer}
            selected={selectedAdventurerId === adventurer.id}
            onClick={() => onSelect(adventurer.id)}
            showDetails={false}
          >
            <svelte:fragment slot="tags">
              <span class="tag">Recruited</span>
            </svelte:fragment>
          </CharacterCard>
        </li>
      {/each}
    </ul>
  {/if}
</section>

<section>
  <h2>Draftable</h2>
  <ul class="roster-grid">
    {#each draftable as adventurer (adventurer.id)}
      <li>
        <CharacterCard
          {adventurer}
          selected={selectedAdventurerId === adventurer.id}
          onClick={() => onSelect(adventurer.id)}
          showDetails={false}
        />
      </li>
    {/each}
  </ul>
</section>

<style>
  .roster-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
    justify-content: center;
    gap: 12px;
  }

  .empty-note {
    color: var(--text-muted);
  }

  .link-button {
    background: transparent;
    border: none;
    padding: 0;
    color: var(--gold-bright);
    text-decoration: underline;
    cursor: pointer;
    font: inherit;
  }

  .tag {
    font-size: 11px;
    padding: 1px 6px;
    border-radius: 3px;
    border: 1px solid var(--panel-border);
    color: var(--text-muted);
    background: var(--bg-inset);
  }
</style>
