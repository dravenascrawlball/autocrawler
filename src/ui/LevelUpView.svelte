<script lang="ts">
  import { roster } from '../state/roster';
  import { rollOffersForChoice, resolveOffer } from '../state/leveling';
  import type { UpgradeOffer } from '../sim/leveling';

  export let adventurerId: string | null = null;

  $: adventurer = adventurerId ? ($roster.adventurers.find((a) => a.id === adventurerId) ?? null) : null;
  $: pendingChoice = adventurer && adventurer.pendingUpgradeChoices.length > 0 ? adventurer.pendingUpgradeChoices[0] : null;
  $: offers = adventurer && pendingChoice ? (rollOffersForChoice(adventurer.id, pendingChoice) ?? []) : [];

  // The in-progress "which of the 6 slots does this new Face replace?" sub-view — only relevant
  // once a 'new-face' offer has been picked, before the choice is actually resolved. Reset (only)
  // when the pending choice itself changes, not on every unrelated re-render.
  let pendingNewFaceOffer: UpgradeOffer | null = null;
  let lastChoiceId: string | null = null;
  $: if (pendingChoice && pendingChoice.id !== lastChoiceId) {
    lastChoiceId = pendingChoice.id;
    pendingNewFaceOffer = null;
  }

  function offerKey(offer: UpgradeOffer): string {
    return offer.type === 'passive' ? `passive:${offer.passive.id}` : `${offer.type}:${offer.action.id}`;
  }

  function pickOffer(offer: UpgradeOffer): void {
    if (!adventurer || !pendingChoice) return;
    if (offer.type === 'new-face') {
      pendingNewFaceOffer = offer;
      return;
    }
    resolveOffer(adventurer.id, pendingChoice, offer);
  }

  function pickSlot(faceIndex: number): void {
    if (!adventurer || !pendingChoice || !pendingNewFaceOffer) return;
    resolveOffer(adventurer.id, pendingChoice, pendingNewFaceOffer, faceIndex);
    pendingNewFaceOffer = null;
  }
</script>

{#if adventurer && pendingChoice}
  <section>
    <h2>Level Up — {adventurer.name}</h2>
    <p>{adventurer.pendingUpgradeChoices.length} pending choice(s) — reached level {pendingChoice.level}.</p>

    {#if pendingNewFaceOffer}
      <h3>Replace which Face with {pendingNewFaceOffer.preview.label}?</h3>
      <ul class="offer-grid">
        {#each adventurer.dieFaces as face, index (index)}
          <li>
            <button type="button" class="offer-card" on:click={() => pickSlot(index)}>
              <span class="offer-card__type">Face {index + 1}</span>
              <span class="offer-card__label">{face.action.name}</span>
              {#if face.enchantmentId}
                <span class="offer-card__preview">enchanted — will be cleared</span>
              {/if}
            </button>
          </li>
        {/each}
      </ul>
      <button type="button" on:click={() => (pendingNewFaceOffer = null)}>Back</button>
    {:else}
      <ul class="offer-grid">
        {#each offers as offer (offerKey(offer))}
          <li>
            <button type="button" class="offer-card" on:click={() => pickOffer(offer)}>
              <span class="offer-card__type">{offer.type}</span>
              <span class="offer-card__label">{offer.preview.label}</span>
              <span class="offer-card__preview">{offer.preview.beforeAfter}</span>
            </button>
          </li>
        {/each}
      </ul>
    {/if}
  </section>
{/if}

<style>
  .offer-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
    justify-content: center;
    gap: 12px;
    margin: 12px 0;
  }

  .offer-card {
    display: flex;
    flex-direction: column;
    gap: 4px;
    width: 100%;
    padding: 12px;
    text-align: left;
    background: var(--bg-inset);
    border: 1px solid var(--panel-border);
    border-radius: 6px;
    cursor: pointer;
  }

  .offer-card:hover {
    border-color: var(--gold);
  }

  .offer-card__type {
    font-size: 11px;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    color: var(--text-muted);
  }

  .offer-card__label {
    font-family: var(--font-heading);
    color: var(--text-heading);
  }

  .offer-card__preview {
    font-size: 13px;
    color: var(--gold-bright);
  }
</style>
