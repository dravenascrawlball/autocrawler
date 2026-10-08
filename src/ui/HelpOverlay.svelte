<script lang="ts">
  export let onClose: () => void;

  function handleBackdropKeydown(event: KeyboardEvent): void {
    if (event.key === 'Escape' || event.key === 'Enter' || event.key === ' ') {
      onClose();
    }
  }
</script>

<svelte:window on:keydown={handleBackdropKeydown} />

<div
  class="modal-backdrop"
  on:click={onClose}
  on:keydown={handleBackdropKeydown}
  role="button"
  tabindex="-1"
  aria-label="Close help"
>
  <div
    class="modal"
    role="dialog"
    aria-modal="true"
    aria-label="How to play"
    tabindex="-1"
    on:click|stopPropagation
    on:keydown|stopPropagation
  >
    <button type="button" class="modal__close" on:click={onClose} aria-label="Close help">✕</button>
    <h2>How to Play</h2>

    <section>
      <h3>The Loop</h3>
      <p>Recruit adventurers in <strong>Town</strong>, then embark a party into the <strong>Dungeon</strong>. Gold and gear found along the way are spent in the between-room shop — none of it carries back to Town.</p>
    </section>

    <section>
      <h3>Combat</h3>
      <p>Battles resolve automatically. Each adventurer always acts on their turn — usually an attack, though healers and support characters have their own reliable move instead — plus a chance to trigger their own signature special move or passive trait. The front row soaks up most enemy attacks; the back row is safer, but not untouchable.</p>
    </section>

    <section>
      <h3>Between Rooms</h3>
      <p>After each fight, re-equip gear, resolve any level-ups, and check loot before pushing on to the next room.</p>
    </section>

    <section>
      <h3>Ending a Run</h3>
      <p>A run ends when you clear every room, your party is wiped, or you retreat to Town with whatever you've gathered so far.</p>
    </section>

    <button type="button" class="modal__done" on:click={onClose}>Got it</button>
  </div>
</div>

<style>
  .modal-backdrop {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.7);
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 24px;
    z-index: 600;
  }

  .modal {
    position: relative;
    width: min(520px, 92vw);
    max-height: 85vh;
    overflow-y: auto;
    background: var(--bg-raised);
    border: 1px solid var(--panel-border);
    border-radius: 8px;
    box-shadow: var(--shadow);
    padding: 24px;
  }

  .modal h2 {
    margin: 0 0 12px;
    color: var(--text-heading);
    font-family: var(--font-heading);
  }

  .modal section {
    margin-bottom: 14px;
  }

  .modal h3 {
    margin: 0 0 4px;
    color: var(--text-heading);
    font-size: 15px;
  }

  .modal p {
    margin: 0;
    color: var(--text-muted);
    line-height: 1.4;
  }

  .modal__close {
    position: absolute;
    top: 12px;
    right: 12px;
    padding: 4px 10px;
  }

  .modal__done {
    margin-top: 4px;
  }
</style>
