<script lang="ts">
  import { dungeonPlayback } from '../state/dungeonPlayback';
  import { roster } from '../state/roster';
  import {
    equipItemDuringRun,
    unequipItemDuringRun,
    retreatFromDungeon,
    finishDungeonRun,
  } from '../state/dungeonOrchestrator';
  import LevelUpModal from './LevelUpModal.svelte';
  import DownedModal from './DownedModal.svelte';
  import LootModal from './LootModal.svelte';
  import CharacterCard from './CharacterCard.svelte';
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
  // Same one-at-a-time gating for a just-downed character's popup (see DownedModal) — resolved
  // before any pending level-up, so the run's story reads in the order it happened.
  $: nextDownedId =
    (partyMembers.find((member) => member.downedSummary && !member.downedSummary.acknowledged) ?? null)?.id ?? null;
  // Forces every pending level-up to be resolved, one character at a time, before the equipment
  // screen underneath is usable — see LevelUpModal. Held back while a Downed popup is still
  // pending (nextDownedId), then party order decides who goes first; not otherwise meaningful.
  $: nextLevelUpId = nextDownedId
    ? null
    : ((partyMembers.find((member) => member.pendingUpgradeChoices.length > 0) ?? null)?.id ?? null);
  // Loot prompts come last in the priority chain (life-and-death, then growth, then housekeeping)
  // — held back while a Downed popup or a pending level-up is still queued, same as those two are
  // held back by each other. See LootModal.svelte.
  $: nextUnpromptedLootItem =
    nextDownedId || nextLevelUpId
      ? null
      : ($dungeonPlayback?.inventory.items.find((item) => !item.promptDismissed) ?? null);
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
            {#if member.pendingUpgradeChoices.length > 0}
              <span class="tag tag--level-up">★ Level Up!</span>
            {/if}
          </svelte:fragment>
        </CharacterCard>
      </li>
    {/each}
  </ul>

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
<LevelUpModal adventurerId={nextLevelUpId} />
<LootModal item={nextUnpromptedLootItem} />

<style>
  .run-recap {
    margin-bottom: 16px;
    padding-bottom: 12px;
    border-bottom: 1px solid var(--panel-border);
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
</style>
