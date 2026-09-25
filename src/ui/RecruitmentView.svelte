<script lang="ts">
  import { townStorage } from '../state/townStorage';
  import { recruitmentPool } from '../state/recruitmentPool';
  import { recruitAdventurer } from '../state/townActions';
  import CharacterCard from './CharacterCard.svelte';
  import CandidatePreviewView from './CandidatePreviewView.svelte';

  let previewCandidateId: string | null = null;
</script>

<section>
  <h2>Recruitment</h2>
  <ul class="recruit-grid">
    {#each $recruitmentPool as candidate (candidate.id)}
      <li>
        <CharacterCard
          adventurer={candidate.adventurer}
          onClick={() => (previewCandidateId = candidate.id)}
          showDetails={false}
        >
          <svelte:fragment slot="tags">
            <span class="tag">Cost: {candidate.cost}g</span>
          </svelte:fragment>
          <svelte:fragment slot="actions">
            <button
              type="button"
              disabled={$townStorage.gold < candidate.cost}
              on:click={() => recruitAdventurer(candidate.id)}
            >
              Recruit
            </button>
          </svelte:fragment>
        </CharacterCard>
      </li>
    {/each}
  </ul>
</section>

<CandidatePreviewView candidateId={previewCandidateId} onClose={() => (previewCandidateId = null)} />

<style>
  .recruit-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
    justify-content: center;
    gap: 12px;
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
