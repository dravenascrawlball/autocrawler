<script lang="ts">
  import {
    openingShop,
    startOpeningShop,
    buyOpeningRecruit,
    buyOpeningRelic,
    buyOpeningEquipment,
    embarkFromOpeningShop,
  } from '../state/openingShop';
  import CharacterCard from './CharacterCard.svelte';

  $: if ($openingShop === null) {
    startOpeningShop();
  }

  $: gold = $openingShop?.gold ?? 0;
  $: party = $openingShop?.party ?? [];
  $: offers = $openingShop?.offers ?? { recruits: [], relics: [], equipment: [] };
  $: canEmbark = party.length > 0;
</script>

<section class="opening-shop">
  <h2>Build Your Party <span class="opening-shop__gold">{gold}g</span></h2>
  <p class="opening-shop__hint">Spend your starting gold on recruits, relics, and equipment, then Embark.</p>

  {#if party.length > 0}
    <h3>Your Party</h3>
    <ul class="party-grid">
      {#each party as adventurer (adventurer.id)}
        <li>
          <CharacterCard {adventurer} showDetails={false} />
        </li>
      {/each}
    </ul>
  {/if}

  <h3>Recruit</h3>
  <ul class="shop-offers">
    {#each offers.recruits as offer (offer.adventurer.id)}
      <li class="shop-offer">
        <span class="shop-offer__label">{offer.adventurer.name}</span>
        <button type="button" disabled={gold < offer.price} on:click={() => buyOpeningRecruit(offer.adventurer.id)}>
          Recruit — {offer.price}g
        </button>
      </li>
    {/each}
  </ul>

  <h3>Relics</h3>
  <ul class="shop-offers">
    {#each offers.relics as offer (offer.relic.id)}
      <li class="shop-offer">
        <span class="shop-offer__label">{offer.relic.name} — {offer.relic.description}</span>
        <button type="button" disabled={gold < offer.price} on:click={() => buyOpeningRelic(offer.relic.id)}>
          Buy — {offer.price}g
        </button>
      </li>
    {/each}
  </ul>

  <h3>Equipment</h3>
  <ul class="shop-offers">
    {#each offers.equipment as offer (offer.item.id)}
      <li class="shop-offer">
        <span class="shop-offer__label">{offer.item.name} — {offer.item.slot}</span>
        <button type="button" disabled={gold < offer.price} on:click={() => buyOpeningEquipment(offer.item.id)}>
          Buy — {offer.price}g
        </button>
      </li>
    {/each}
  </ul>

  <button type="button" class="opening-shop__embark" disabled={!canEmbark} on:click={() => embarkFromOpeningShop()}>
    Embark!
  </button>
</section>

<style>
  .opening-shop__gold {
    font-family: var(--font-heading);
    color: var(--gold-bright);
    margin-left: 10px;
  }

  .opening-shop__hint {
    color: var(--text-muted);
    font-size: 13px;
    margin-top: 0;
  }

  .party-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
    justify-content: center;
    gap: 12px;
    margin-bottom: 12px;
    list-style: none;
    padding: 0;
  }

  .shop-offers {
    display: flex;
    flex-direction: column;
    gap: 6px;
    margin: 0 0 16px;
    padding: 0;
    list-style: none;
  }

  .shop-offer {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    padding: 6px 10px;
    background: var(--bg-inset);
    border: 1px solid var(--panel-border);
    border-radius: 6px;
  }

  .shop-offer__label {
    font-size: 13px;
    color: var(--text);
  }

  .opening-shop__embark {
    font-family: var(--font-heading);
    font-size: 16px;
    padding: 10px 28px;
    background: var(--gold);
    color: var(--bg);
    border: none;
    border-radius: 6px;
    cursor: pointer;
  }

  .opening-shop__embark:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .opening-shop__embark:not(:disabled):hover {
    background: var(--gold-bright);
  }
</style>
