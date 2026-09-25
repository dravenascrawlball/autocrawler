<script lang="ts">
  import { dungeonPlayback } from '../state/dungeonPlayback';
  import { equipItemDuringRun, dismissLootPrompt } from '../state/dungeonOrchestrator';
  import type { Item } from '../sim/items';
  import type { StatModifier } from '../sim/stats';
  import CharacterCard from './CharacterCard.svelte';

  export let item: Item | null = null;

  $: partyMembers = $dungeonPlayback?.runState.party ?? [];

  function formatModifier(modifier: StatModifier): string {
    const amount = modifier.type === 'percent' ? `${modifier.amount}%` : `${modifier.amount}`;
    return `${modifier.amount >= 0 ? '+' : ''}${amount} ${modifier.stat}`;
  }

  function faceEffectDescription(current: Item): string | null {
    if (!current.faceEffect) return null;
    return current.faceEffect.effect.kind === 'enchant'
      ? 'Enchants a die face with Burning.'
      : `Replaces a die face with ${current.faceEffect.effect.action.name}.`;
  }

  function equip(adventurerId: string): void {
    if (!item) return;
    equipItemDuringRun(adventurerId, item);
  }

  function skip(): void {
    if (!item) return;
    dismissLootPrompt(item);
  }
</script>

{#if item}
  <div class="modal-backdrop" role="dialog" aria-modal="true" aria-label="New loot: {item.name}">
    <div class="modal">
      <h2>You found {item.name}!</h2>
      <p class="modal__slot">{item.slot}</p>

      {#if item.modifiers.length > 0}
        <ul class="modal__modifiers">
          {#each item.modifiers as modifier, index (index)}
            <li>{formatModifier(modifier)}</li>
          {/each}
        </ul>
      {/if}

      {#if faceEffectDescription(item)}
        <p class="modal__effect">{faceEffectDescription(item)}</p>
      {/if}

      <h3>Equip on</h3>
      <ul class="modal__party">
        {#each partyMembers as member (member.id)}
          <li>
            <CharacterCard adventurer={member} onClick={() => equip(member.id)} />
          </li>
        {/each}
      </ul>

      <button type="button" class="modal__skip" on:click={skip}>Skip for now</button>
    </div>
  </div>
{/if}

<style>
  .modal-backdrop {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.75);
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 24px;
    z-index: 200;
  }

  .modal {
    position: relative;
    width: min(520px, 96vw);
    max-height: 90vh;
    overflow-y: auto;
    background: var(--bg-raised);
    border: 1px solid var(--panel-border);
    border-radius: 8px;
    box-shadow: var(--shadow);
    padding: 20px;
  }

  .modal h2 {
    margin: 0 0 4px;
    color: var(--text-heading);
  }

  .modal__slot {
    text-transform: capitalize;
    color: var(--text-muted);
    margin: 0 0 12px;
  }

  .modal__modifiers {
    list-style: none;
    padding: 0;
    margin: 0 0 8px;
    color: var(--gold-bright);
  }

  .modal__effect {
    color: var(--gold-bright);
    margin: 0 0 16px;
  }

  .modal__party {
    display: grid;
    /* Fixed 2 columns rather than auto-fill: the party is always exactly 4 (DRAFT_ROUND_COUNT), so
       this always lands as a clean 2x2 instead of a lopsided 3-then-1 the old auto-fill produced
       at this modal's width. */
    grid-template-columns: repeat(2, 1fr);
    gap: 12px;
    list-style: none;
    padding: 0;
    margin: 0 0 16px;
  }

  .modal__skip {
    color: var(--text-muted);
  }
</style>
