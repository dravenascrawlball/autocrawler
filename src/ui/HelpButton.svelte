<script lang="ts">
  export let onClick: () => void;
</script>

<button type="button" class="help-button" on:click={onClick} title="How to play" aria-label="How to play">?</button>

<style>
  .help-button {
    position: fixed;
    right: 108px;
    bottom: 12px;
    z-index: 500;
    width: 28px;
    height: 28px;
    padding: 0;
    background: var(--bg-inset);
    color: var(--text-muted);
    border: 1px solid var(--panel-border);
    border-radius: 6px;
    box-shadow: var(--shadow);
    font-size: 13px;
    font-weight: bold;
    cursor: pointer;
  }

  .help-button:hover {
    color: var(--text-heading);
  }
</style>
