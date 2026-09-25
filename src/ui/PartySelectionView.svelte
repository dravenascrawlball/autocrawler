<script lang="ts">
  import { roster } from '../state/roster';
  import { draftState, startDraft, pickDraftOffer, isDraftComplete, clearDraft, DRAFT_ROUND_COUNT } from '../state/draft';
  import { startDungeon } from '../state/dungeonOrchestrator';
  import type { Adventurer } from '../sim/adventurer';
  import CharacterCard from './CharacterCard.svelte';
  import Tooltip from './Tooltip.svelte';

  $: if ($draftState === null) {
    startDraft();
  }

  function infoText(adventurer: Adventurer): string {
    const lines = [
      `${adventurer.name} — ${adventurer.role}, Lv ${adventurer.level}`,
      `HP ${adventurer.hp}/${adventurer.maxHp}   Attack ${adventurer.attackPower}`,
      `Speed ${adventurer.speed}   Accuracy ${adventurer.accuracy}%   Evasion ${adventurer.evasion}%`,
    ];
    if (adventurer.healPower > 0) {
      lines.push(`Heal Power ${adventurer.healPower}`);
    }
    if (adventurer.traits.length > 0) {
      lines.push(`Traits: ${adventurer.traits.map((trait) => trait.name).join(', ')}`);
    }
    return lines.join('\n');
  }

  $: recruitedSubstitutes = $draftState
    ? $roster.adventurers.filter(
        (adventurer) =>
          $roster.recruitedIds.includes(adventurer.id) &&
          !$draftState!.picks.some((pick) => pick.id === adventurer.id),
      )
    : [];

  $: complete = isDraftComplete($draftState);

  function embark(): void {
    if (!$draftState) return;
    startDungeon($draftState.picks);
    clearDraft();
  }
</script>

<section>
  {#if $draftState}
    {#if !complete}
      <h2>Draft ({$draftState.roundIndex + 1}/{DRAFT_ROUND_COUNT})</h2>
      <ul class="party-grid">
        {#each $draftState.offers as adventurer (adventurer.id)}
          <li>
            <Tooltip text={infoText(adventurer)}>
              <CharacterCard {adventurer} onClick={() => pickDraftOffer(adventurer.id)} showDetails={false} />
            </Tooltip>
          </li>
        {/each}
      </ul>

      {#if recruitedSubstitutes.length > 0}
        <h3>Or substitute a recruited character</h3>
        <ul class="party-grid">
          {#each recruitedSubstitutes as adventurer (adventurer.id)}
            <li>
              <Tooltip text={infoText(adventurer)}>
                <CharacterCard {adventurer} onClick={() => pickDraftOffer(adventurer.id)} showDetails={false}>
                  <svelte:fragment slot="tags">
                    <span class="tag tag--recruited">Recruited</span>
                  </svelte:fragment>
                </CharacterCard>
              </Tooltip>
            </li>
          {/each}
        </ul>
      {/if}
    {/if}

    <h3>Party ({$draftState.picks.length}/{DRAFT_ROUND_COUNT})</h3>
    <ul class="party-grid">
      {#each $draftState.picks as adventurer (adventurer.id)}
        <li>
          <Tooltip text={infoText(adventurer)}>
            <CharacterCard {adventurer} selected showDetails={false} />
          </Tooltip>
        </li>
      {/each}
    </ul>

    {#if complete}
      <button type="button" on:click={embark}>Embark</button>
    {/if}
  {/if}
</section>

<style>
  .party-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
    justify-content: center;
    gap: 12px;
    margin-bottom: 12px;
  }

  .tag--recruited {
    color: var(--gold-bright);
    border-color: var(--gold);
  }
</style>
