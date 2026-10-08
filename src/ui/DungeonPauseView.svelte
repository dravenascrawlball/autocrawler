<script lang="ts">
  import { dungeonPlayback } from '../state/dungeonPlayback';
  import { roster } from '../state/roster';
  import {
    equipItemDuringRun,
    unequipItemDuringRun,
    retreatFromDungeon,
    finishDungeonRun,
    buyRecruitOffer,
    buyRelicOffer,
    buyEquipmentOffer,
    placePartyMemberDuringRun,
    returnPartyMemberToTrayDuringRun,
  } from '../state/dungeonOrchestrator';
  import DownedModal from './DownedModal.svelte';
  import LootModal from './LootModal.svelte';
  import CharacterCard from './CharacterCard.svelte';
  import FormationBoard, { type BoardUnit } from './FormationBoard.svelte';
  import { runHistory } from '../state/runHistory';
  import { newUnlocksForRun } from '../state/progression';
  import { calculateRunRenownBreakdown } from '../sim/renown';
  import type { EquipmentSlot } from '../sim/items';

  export let onContinue: () => void;

  const SLOTS: EquipmentSlot[] = ['weapon', 'armor', 'trinket'];

  let selectedAdventurerId: string | null = null;

  $: partyIds = $dungeonPlayback ? $dungeonPlayback.runState.party.map((adventurer) => adventurer.id) : [];
  $: partyMembers = $roster.adventurers.filter((adventurer) => partyIds.includes(adventurer.id));
  $: selected = selectedAdventurerId
    ? (partyMembers.find((adventurer) => adventurer.id === selectedAdventurerId) ?? null)
    : null;
  $: inventoryItems = $dungeonPlayback?.inventory.items ?? [];
  // The room resolveNextRoom will resolve next (see dungeonRun.ts's own doc comment — roomIndex
  // already points past the room that just finished) — null once the run has fully ended (a Win/
  // Loss/Retreat outcome, checked explicitly via runOutcome rather than just the index bounds:
  // a Loss still leaves roomIndex pointing at a room that would have come next had the run kept
  // going, but there's no actual "next room" to prepare a layout for once it's over).
  $: nextRoom =
    $dungeonPlayback && runOutcome === null && $dungeonPlayback.runState.roomIndex < $dungeonPlayback.runState.rooms.length
      ? $dungeonPlayback.runState.rooms[$dungeonPlayback.runState.roomIndex]
      : null;
  const toBoardUnit = (unit: (typeof partyMembers)[number]): BoardUnit => ({
    id: unit.id,
    name: unit.name,
    archetype: unit.archetype,
    position: unit.position,
    hp: unit.hp,
    maxHp: unit.maxHp,
  });
  $: nextRoomEnemyUnits = nextRoom ? nextRoom.enemies.map(toBoardUnit) : [];
  $: partyBoardUnits = partyMembers.map(toBoardUnit);
  $: trayIds = $dungeonPlayback?.unplacedIds ?? [];
  // Same one-at-a-time gating for a just-downed character's popup (see DownedModal) — resolved
  // before any pending level-up, so the run's story reads in the order it happened.
  $: nextDownedId =
    (partyMembers.find((member) => member.downedSummary && !member.downedSummary.acknowledged) ?? null)?.id ?? null;
  // Loot prompts come after the life-and-death Downed popup, same priority chain as before — see
  // LootModal.svelte.
  $: nextUnpromptedLootItem = nextDownedId
    ? null
    : ($dungeonPlayback?.inventory.items.find((item) => !item.promptDismissed) ?? null);
  $: shopOffers = $dungeonPlayback?.shopOffers ?? { recruits: [], relics: [], equipment: [] };
  $: shopGold = $dungeonPlayback?.inventory.gold ?? 0;
  // Non-null once the run has actually ended (win/loss/forced-retreat) — see
  // DungeonPhaseView.svelte's onRoomReplayComplete, which now pauses here even on an ended run so
  // any pending Downed popup still gets shown before the player can leave for town.
  $: runOutcome = $dungeonPlayback?.outcome ?? null;

  // Run recap (shown once runOutcome !== null, below) — every field here reads data already
  // tracked live all run (see sim/room.ts's applyTurnStats), nothing new to instrument.
  // "Rooms reached" rather than "rooms cleared": roomIndex counts every room resolveNextRoom has
  // resolved, win or not, so it's accurate for a completed run (equals the total) without having
  // to disambiguate a loss/stalemate room (not actually cleared) from a voluntary retreat (every
  // prior room was) — a small, deliberate simplification rather than threading that distinction
  // through just for this summary.
  $: totalRooms = $dungeonPlayback?.runState.rooms.length ?? 0;
  $: roomsReached = $dungeonPlayback?.runState.roomIndex ?? 0;
  $: runGold = $dungeonPlayback?.inventory.gold ?? 0;
  // What finishDungeonRun is about to bank (roadmap item 3) — previewed here with the same pure
  // helpers it uses, so the recap and the town toast always agree.
  $: renownPreview =
    $dungeonPlayback && runOutcome !== null
      ? calculateRunRenownBreakdown($dungeonPlayback.runState.roomRecords, runOutcome)
      : null;
  $: unlockPreview =
    $dungeonPlayback && runOutcome !== null
      ? newUnlocksForRun($dungeonPlayback.runState.party, runOutcome, $runHistory.clearedWithIds)
      : [];
</script>

<section>
  <h2>
    {#if runOutcome === 'completed'}
      Dungeon Complete!
    {:else if runOutcome === 'loss'}
      Defeat...
    {:else if runOutcome === 'retreat'}
      Retreated
    {:else}
      Between Rooms
    {/if}
  </h2>

  {#if runOutcome !== null}
    <section class="run-recap">
      <p>Rooms reached: {roomsReached} / {totalRooms}</p>
      <p>Gold gained: {runGold}g</p>
      {#if renownPreview}
        <p class="run-recap__renown">
          Renown earned: <strong>+{renownPreview.total}</strong>
          <span class="run-recap__breakdown">
            ({renownPreview.roomsWon} room{renownPreview.roomsWon === 1 ? '' : 's'} × {renownPreview.roomsWon > 0
              ? renownPreview.roomRenown / renownPreview.roomsWon
              : 0}{#if renownPreview.completionBonus > 0}
              + {renownPreview.completionBonus} completion bonus{/if})
          </span>
        </p>
      {/if}
      {#each unlockPreview as unlock (unlock.characterName + unlock.name)}
        <p class="run-recap__unlock">✦ {unlock.characterName} unlocked <strong>{unlock.name}</strong> — added to their Special pool</p>
      {/each}
      {#if inventoryItems.length > 0}
        <p>Loot found: {inventoryItems.map((item) => item.name).join(', ')}</p>
      {/if}

      <h3>Run Stats</h3>
      <ul class="run-recap__stats">
        {#each partyMembers as member (member.id)}
          <li>
            <span class="run-recap__name">{member.name}</span>
            <span class="run-recap__figures">
              {member.runDamageDealt} dmg dealt · {member.runDamageTaken} dmg taken · {member.runHealingDone} healed
            </span>
          </li>
        {/each}
      </ul>
    </section>
  {/if}

  <h3>Party</h3>
  <ul class="party-grid">
    {#each partyMembers as member (member.id)}
      <li>
        <CharacterCard
          adventurer={member}
          selected={selectedAdventurerId === member.id}
          onClick={() => (selectedAdventurerId = member.id)}
        >
          <svelte:fragment slot="tags">
            {#if member.hp <= 0}
              <span class="tag tag--downed">☠ Downed</span>
            {/if}
            {#if member.level > 1}
              <span class="tag tag--level-up">★ Level {member.level}</span>
            {/if}
          </svelte:fragment>
        </CharacterCard>
      </li>
    {/each}
  </ul>

  {#if nextRoom}
    <section class="prepare-battle">
      <h3>Prepare for Battle</h3>
      <p class="prepare-battle__hint">
        Drag your party into position. Melee attacks only reach the frontmost unit in a lane — keep fragile
        characters behind someone.
      </p>
      <FormationBoard
        partyUnits={partyBoardUnits}
        enemyUnits={nextRoomEnemyUnits}
        {trayIds}
        selectedId={selectedAdventurerId}
        onPlace={placePartyMemberDuringRun}
        onReturnToTray={returnPartyMemberToTrayDuringRun}
        onSelect={(id) => (selectedAdventurerId = id)}
      />
    </section>
  {/if}

  {#if runOutcome === null}
    <section class="shop">
      <h3>Shop <span class="shop__gold">{shopGold}g</span></h3>

      <h4>Recruit</h4>
      <ul class="shop-offers">
        {#each shopOffers.recruits as offer (offer.adventurer.id)}
          <li class="shop-offer">
            <span class="shop-offer__label">
              {offer.adventurer.name}
              {#if offer.alreadyInParty}<span class="shop-offer__hint">(level up!)</span>{/if}
            </span>
            <button
              type="button"
              disabled={shopGold < offer.price}
              on:click={() => buyRecruitOffer(offer.adventurer.id)}
            >
              {offer.alreadyInParty ? 'Level Up' : 'Recruit'} — {offer.price}g
            </button>
          </li>
        {/each}
      </ul>

      <h4>Relics</h4>
      <ul class="shop-offers">
        {#each shopOffers.relics as offer (offer.relic.id)}
          <li class="shop-offer">
            <span class="shop-offer__label">{offer.relic.name} — {offer.relic.description}</span>
            <button type="button" disabled={shopGold < offer.price} on:click={() => buyRelicOffer(offer.relic.id)}>
              Buy — {offer.price}g
            </button>
          </li>
        {/each}
      </ul>

      <h4>Equipment</h4>
      <ul class="shop-offers">
        {#each shopOffers.equipment as offer (offer.item.id)}
          <li class="shop-offer">
            <span class="shop-offer__label">{offer.item.name} — {offer.item.slot}</span>
            <button type="button" disabled={shopGold < offer.price} on:click={() => buyEquipmentOffer(offer.item.id)}>
              Buy — {offer.price}g
            </button>
          </li>
        {/each}
      </ul>
    </section>
  {/if}

  {#if selected}
    <h3>{selected.name}'s Equipment</h3>
    <ul>
      {#each SLOTS as slot (slot)}
        <li>
          {slot}: {selected.equipment[slot]?.name ?? '(empty)'}
          {#if selected.equipment[slot]}
            <button type="button" on:click={() => selected && unequipItemDuringRun(selected.id, slot)}>
              Unequip
            </button>
          {/if}
        </li>
      {/each}
    </ul>

    <h3>Run Inventory</h3>
    <ul>
      {#each inventoryItems as item, index (index)}
        <li>
          {item.name} — {item.slot}
          <button type="button" on:click={() => selected && equipItemDuringRun(selected.id, item)}>
            Equip
          </button>
        </li>
      {/each}
    </ul>
  {:else}
    <p>Select a party member to manage equipment.</p>
  {/if}

  <div>
    {#if runOutcome !== null}
      <button type="button" on:click={() => finishDungeonRun()}>Return to Town</button>
    {:else}
      <button type="button" on:click={onContinue}>Continue to Next Room</button>
      <button type="button" on:click={() => retreatFromDungeon()}>Retreat</button>
    {/if}
  </div>
</section>

<DownedModal adventurerId={nextDownedId} />
<LootModal item={nextUnpromptedLootItem} />

<style>
  .run-recap {
    margin-bottom: 16px;
    padding-bottom: 12px;
    border-bottom: 1px solid var(--panel-border);
  }

  .run-recap__renown strong {
    color: var(--gold-bright);
  }

  .run-recap__breakdown {
    font-size: 13px;
    color: var(--text-muted);
  }

  .run-recap__unlock {
    color: var(--text-heading);
  }

  .run-recap p {
    margin: 0 0 4px;
    color: var(--text);
  }

  .run-recap__stats {
    list-style: none;
    padding: 0;
    margin: 0;
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .run-recap__name {
    font-family: var(--font-heading);
    color: var(--text-heading);
    margin-right: 8px;
  }

  .run-recap__figures {
    font-size: 13px;
    color: var(--text-muted);
  }

  .party-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
    gap: 12px;
    margin-bottom: 16px;
  }

  .tag--level-up {
    color: var(--gold-bright);
    border-color: var(--gold);
  }

  .tag--downed {
    color: var(--danger-bright);
    border-color: var(--danger);
  }

  .prepare-battle {
    margin-bottom: 16px;
    padding-bottom: 12px;
    border-bottom: 1px solid var(--panel-border);
  }

  .prepare-battle__hint {
    color: var(--text-muted);
    font-size: 13px;
    margin: 0 0 8px;
  }

  .shop {
    margin-bottom: 16px;
    padding-bottom: 12px;
    border-bottom: 1px solid var(--panel-border);
  }

  .shop__gold {
    color: var(--gold-bright);
    font-size: 14px;
    margin-left: 8px;
  }

  .shop-offers {
    list-style: none;
    padding: 0;
    margin: 0 0 8px;
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .shop-offer {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
  }

  .shop-offer__hint {
    color: var(--gold-bright);
    margin-left: 4px;
  }
</style>
