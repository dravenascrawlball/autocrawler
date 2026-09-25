<script lang="ts">
  import { resetGame } from '../state/newGame';

  let confirming = false;

  function confirmReset(): void {
    resetGame();
    confirming = false;
  }
</script>

<section>
  <h2>New Game</h2>
  {#if confirming}
    <p>This will permanently erase your save — roster, gold, items, and day count. Are you sure?</p>
    <button type="button" class="danger" on:click={confirmReset}>Confirm Reset</button>
    <button type="button" on:click={() => (confirming = false)}>Cancel</button>
  {:else}
    <button type="button" on:click={() => (confirming = true)}>New Game</button>
  {/if}
</section>

<style>
  .danger {
    color: var(--danger-bright);
    border-color: var(--danger);
  }

  .danger:hover:not(:disabled) {
    background: color-mix(in srgb, var(--danger) 18%, var(--bg-inset));
    border-color: var(--danger-bright);
    color: var(--danger-bright);
  }
</style>
