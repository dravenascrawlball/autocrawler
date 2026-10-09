<script lang="ts">
  import { effectiveMaxHp } from '../sim/adventurer';
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
    changeKitDuringRun,
    chooseMilestoneOffer,
  } from '../state/dungeonOrchestrator';
  import { floorOf } from '../sim/dungeonRun';
  import RunSummaryView from './RunSummaryView.svelte';
  import { buildRunSummary } from '../state/runSummary';
  import OutfitPicker from './OutfitPicker.svelte';
  import QuirkBadges from './QuirkBadges.svelte';
  import { quirksOf } from '../sim/quirks';
  import { adjacencyAbilities } from './adjacency';
  import DownedModal from './DownedModal.svelte';
  import LootModal from './LootModal.svelte';
  import CharacterCard from './CharacterCard.svelte';
  import FormationBoard, { type BoardUnit } from './FormationBoard.svelte';
  import Tooltip from './Tooltip.svelte';
  import SynergyPanel from './SynergyPanel.svelte';
  import { recruitTooltip } from './recruitTooltip';
  import { runHistory, recordRun } from '../state/runHistory';
  import { newUnlocksForRun, halloweenUnlocksForRun } from '../state/progression';
  import { metaProgression } from '../state/metaProgression';
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
    activeKit: unit.activeKit,
    adjacency: adjacencyAbilities(unit),
    quirks: quirksOf(unit).map((quirk) => `${quirk.name}: ${quirk.description}`),
    position: unit.position,
    hp: unit.hp,
    maxHp: effectiveMaxHp(unit),
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
  // Floor-boss reward (mid-run Trait growth): must be picked before continuing.
  $: milestoneOffers = $dungeonPlayback?.milestoneOffers ?? [];
  $: clearedFloor = $dungeonPlayback ? floorOf($dungeonPlayback.runState.roomIndex - 1) : 0;
  const memberName = (id: string) => partyMembers.find((member) => member.id === id)?.name ?? 'Ally';
  $: shopGold = $dungeonPlayback?.inventory.gold ?? 0;
  // Non-null once the run has actually ended (win/loss/forced-retreat) — see
  // DungeonPhaseView.svelte's onRoomReplayComplete, which now pauses here even on an ended run so
  // any pending Downed popup still gets shown before the player can leave for town.
  $: runOutcome = $dungeonPlayback?.outcome ?? null;

  // What finishDungeonRun is about to bank (roadmap item 3) — previewed here with the same pure
  // helpers it uses, so the recap and the town toast always agree.
  $: renownPreview =
    $dungeonPlayback && runOutcome !== null
      ? calculateRunRenownBreakdown($dungeonPlayback.runState.roomRecords, runOutcome)
      : null;
  $: kitUnlockPreview =
    $dungeonPlayback && renownPreview
      ? halloweenUnlocksForRun($dungeonPlayback.runState.party, renownPreview.roomsWon, $metaProgression.unlockedKitIds)
      : [];
  $: unlockPreview =
    $dungeonPlayback && runOutcome !== null && renownPreview
      ? newUnlocksForRun(
          $dungeonPlayback.runState.party,
          $runHistory,
          recordRun(
            $runHistory,
            $dungeonPlayback.runState.party.map((member) => member.id),
            renownPreview.roomsWon,
            runOutcome === 'completed',
          ),
        )
      : [];
</script>

<section>
  {#if runOutcome !== null && $dungeonPlayback}
    <!-- The run is over: a dedicated summary screen (ui/RunSummaryView.svelte) instead of the between-rooms layout. -->
    <RunSummaryView summary={buildRunSummary($dungeonPlayback)} />
    <div class="run-end__extras">
      {#each kitUnlockPreview as unlock (unlock.kitId)}
        <p class="run-recap__unlock">🎃 {unlock.characterName} unlocked the <strong>{unlock.kitName}</strong> Kit</p>
      {/each}
      {#each unlockPreview as unlock (unlock.characterName + unlock.name)}
        <p class="run-recap__unlock">✦ {unlock.characterName} unlocked <strong>{unlock.name}</strong> — added to their Special pool</p>
      {/each}
      {#if inventoryItems.length > 0}
        <p>Loot found: {inventoryItems.map((item) => item.name).join(', ')}</p>
      {/if}
      <button type="button" class="run-end__return" on:click={() => finishDungeonRun()}>Return to Town</button>
    </div>
  {:else}
  <h2>Between Rooms</h2>


  {#if runOutcome === null && milestoneOffers.length > 0}
    <section class="milestone">
      <h3>Floor {clearedFloor} cleared! Choose a reward</h3>
      <p class="milestone__hint">The Trait lasts for the rest of this run.</p>
      <div class="milestone__cards">
        {#each milestoneOffers as offer, index (offer.adventurerId + offer.trait.id)}
          <button type="button" class="milestone__card" on:click={() => chooseMilestoneOffer(index)}>
            <span class="milestone__trait">{offer.trait.name}</span>
            <span class="milestone__hero">→ {memberName(offer.adventurerId)}</span>
            <span class="milestone__description">{offer.trait.description}</span>
          </button>
        {/each}
      </div>
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
      <SynergyPanel party={partyMembers} />
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
            <Tooltip text={recruitTooltip(offer.adventurer, partyMembers)}>
              <span class="shop-offer__label shop-offer__label--hint">
                {offer.adventurer.name}
                {#if offer.alreadyInParty}<span class="shop-offer__hint">(level up!)</span>{/if}
              </span>
            </Tooltip>
            {#if !offer.alreadyInParty}<QuirkBadges adventurer={offer.adventurer} />{/if}
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
    {#if runOutcome === null}
      <OutfitPicker adventurer={selected} onChange={(kitId) => selected && changeKitDuringRun(selected.id, kitId)} />
    {/if}
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
    <button type="button" on:click={onContinue} disabled={milestoneOffers.length > 0}>
      {milestoneOffers.length > 0 ? 'Choose a reward first' : 'Continue to Next Room'}
    </button>
    <button type="button" on:click={() => retreatFromDungeon()}>Retreat</button>
  </div>
  {/if}
</section>

<DownedModal adventurerId={nextDownedId} />
<LootModal item={nextUnpromptedLootItem} />

<style>
  .milestone {
    margin-bottom: 16px;
    padding: 12px;
    border: 1px solid var(--gold);
    border-radius: 8px;
  }

  .milestone__hint {
    margin: 0 0 10px;
    font-size: 13px;
    color: var(--text-muted);
  }

  .milestone__cards {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(170px, 1fr));
    gap: 10px;
  }

  .milestone__card {
    display: flex;
    flex-direction: column;
    gap: 4px;
    align-items: flex-start;
    text-align: left;
    padding: 12px;
    background: var(--bg-inset);
    border: 1px solid var(--panel-border);
    border-radius: 6px;
    cursor: pointer;
  }

  .milestone__card:hover {
    border-color: var(--gold);
  }

  .milestone__trait {
    font-family: var(--font-heading);
    color: var(--gold-bright);
  }

  .milestone__hero {
    font-size: 13px;
    color: var(--text-heading);
  }

  .milestone__description {
    font-size: 12px;
    color: var(--text-muted);
  }

  .run-end__extras {
    margin-top: 12px;
  }

  .run-end__return {
    margin-top: 8px;
  }




  .run-recap__unlock {
    color: var(--text-heading);
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

  .shop-offer__label--hint {
    text-decoration: underline dotted;
    cursor: help;
  }

  .shop-offer__hint {
    color: var(--gold-bright);
    margin-left: 4px;
  }
</style>
