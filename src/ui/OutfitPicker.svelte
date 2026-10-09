<script lang="ts">
  import type { Adventurer } from '../sim/adventurer';
  import { metaProgression } from '../state/metaProgression';
  import { ownedKitsFor } from '../state/progression';

  /**
   * Free outfit swap for owned Kits (between rooms and at the opening shop):
   * the base outfit plus every Kit this character owns. Renders nothing if
   * they own no Kits. Stat changes apply immediately; synergy changes from
   * a role-swapping Kit count from the next room.
   */
  export let adventurer: Adventurer;
  export let onChange: (kitId: string | null) => void;

  // Passing $metaProgression's map keeps this reactive to Kits bought elsewhere.
  $: kits = ownedKitsFor(adventurer, $metaProgression.unlockedKitIds);
  $: activeId = adventurer.activeKit?.id ?? null;
</script>

{#if kits.length > 0}
  <div class="outfits" role="group" aria-label="{adventurer.name}'s outfit">
    <button type="button" class="outfit" class:outfit--active={activeId === null} on:click={() => onChange(null)}>
      Base outfit
    </button>
    {#each kits as kit (kit.id)}
      <button
        type="button"
        class="outfit"
        class:outfit--active={activeId === kit.id}
        title={kit.description}
        on:click={() => onChange(kit.id)}
      >
        {kit.name}
      </button>
    {/each}
  </div>
{/if}

<style>
  .outfits {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
  }

  .outfit {
    font-size: 12px;
    padding: 4px 10px;
    border-radius: 4px;
  }

  .outfit--active {
    border-color: var(--gold);
    color: var(--gold-bright);
  }
</style>
