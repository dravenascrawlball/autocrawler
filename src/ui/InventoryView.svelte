<script lang="ts">
  import { townStorage } from '../state/townStorage';
  import { equipItemForAdventurer } from '../state/townActions';

  export let selectedAdventurerId: string | null = null;
</script>

<section>
  <h2>Town Storage</h2>
  <ul>
    <!-- Keyed by index, not item.id: town storage can hold multiple instances of the same item (e.g. duplicate loot drops). -->
    {#each $townStorage.items as item, index (index)}
      <li>
        {item.name} — {item.slot}
        <button
          type="button"
          disabled={!selectedAdventurerId}
          on:click={() => selectedAdventurerId && equipItemForAdventurer(selectedAdventurerId, item)}
        >
          Equip to selected
        </button>
      </li>
    {/each}
  </ul>
</section>
