<script lang="ts">
  import { effectiveMaxHp } from '../sim/adventurer';
  import {
    openingShop,
    startOpeningShop,
    buyOpeningRecruit,
    buyOpeningRelic,
    buyOpeningEquipment,
    embarkFromOpeningShop,
    placeOpeningMember,
    returnOpeningMemberToTray,
  } from '../state/openingShop';
  import FormationBoard, { type BoardUnit } from './FormationBoard.svelte';
  import Tooltip from './Tooltip.svelte';
  import SynergyPanel from './SynergyPanel.svelte';
  import { recruitTooltip } from './recruitTooltip';
  import type { Adventurer } from '../sim/adventurer';

  $: if ($openingShop === null) {
    startOpeningShop();
  }

  $: gold = $openingShop?.gold ?? 0;
  $: party = $openingShop?.party ?? [];
  $: offers = $openingShop?.offers ?? { recruits: [], relics: [], equipment: [] };
  $: canEmbark = party.length > 0;

  const toBoardUnit = (unit: Adventurer): BoardUnit => ({
    id: unit.id,
    name: unit.name,
    archetype: unit.archetype,
    activeKit: unit.activeKit,
    position: unit.position,
    hp: unit.hp,
    maxHp: effectiveMaxHp(unit),
  });
  $: partyUnits = party.map(toBoardUnit);
  // Room 1 is rolled when the shop opens (see state/openingShop.ts), so its formation can be previewed here.
  $: firstRoomEnemies = ($openingShop?.rooms[0]?.enemies ?? []).map(toBoardUnit);
  $: trayIds = $openingShop?.unplacedIds ?? [];
</script>

<section class="opening-shop">
  <h2>Build Your Party <span class="opening-shop__gold">{gold}g</span></h2>
  <p class="opening-shop__hint">Spend your starting gold on recruits, relics, and equipment, then Embark.</p>

  <h3>Prepare for Room 1</h3>
  <p class="opening-shop__hint">
    {#if party.length === 0}
      Recruit someone below, then drag them into position against the first room.
    {:else}
      Drag your party into position. Melee attacks only reach the frontmost unit in a lane — keep fragile
      characters behind someone.
    {/if}
  </p>
  <SynergyPanel {party} />
  <div class="opening-shop__board">
    <FormationBoard
      {partyUnits}
      enemyUnits={firstRoomEnemies}
      {trayIds}
      onPlace={placeOpeningMember}
      onReturnToTray={returnOpeningMemberToTray}
    />
  </div>

  <h3>Recruit</h3>
  <ul class="shop-offers">
    {#each offers.recruits as offer (offer.adventurer.id)}
      <li class="shop-offer">
        <Tooltip text={recruitTooltip(offer.adventurer, party)}>
          <span class="shop-offer__label shop-offer__label--hint">{offer.adventurer.name}</span>
        </Tooltip>
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

  .opening-shop__board {
    margin-bottom: 16px;
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

  .shop-offer__label--hint {
    text-decoration: underline dotted;
    cursor: help;
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
