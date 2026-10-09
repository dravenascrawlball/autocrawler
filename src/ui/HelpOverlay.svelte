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
      <p>
        Build a party in <strong>Town</strong>, then take it into the <strong>Dungeon</strong>: 15 rooms across three
        floors, each floor ending in a boss. Gold, gear and level-ups only last for the run. What you keep is
        <strong>Renown</strong> (earned per room, per floor, and for finishing) plus the unlocks you earn.
      </p>
    </section>

    <section>
      <h3>Building Your Party</h3>
      <p>
        <strong>Embark</strong> opens a shop with 200 gold to recruit your starting party. Hover a recruit's name to see
        their Special, Traits and Kit. Between rooms the shop restocks: recruit more (up to 9), buy relics and gear, or
        buy a character you already have to <strong>level them up</strong> (2★ also grants a second Special).
      </p>
    </section>

    <section>
      <h3>Combat</h3>
      <p>
        Fights play out on their own. Every turn a character uses their Basic Action, plus any Special Actions that
        trigger. <strong>Melee</strong> attacks can only reach the frontmost unit in the attacker's lane, moving to the
        nearest lane once that lane is empty. <strong>Ranged</strong> attacks reach anyone. A fragile hero is only truly
        safe standing behind someone.
      </p>
    </section>

    <section>
      <h3>Formation</h3>
      <p>
        Drag your party around the board before each fight; you can see the next room's enemies. Some characters have
        <strong>adjacency</strong> abilities (Bodyguard, Shield Bearer, Sanctuary...). Select or drag them to light up the
        cells they reach. A ◆ marks allies they're helping.
      </p>
    </section>

    <section>
      <h3>Synergies</h3>
      <p>
        Fielding several characters of the same role (Fighters, Rogues, Healers...) or tag (Spooky) unlocks party bonuses
        that grow with the count. The synergy panel shows what's active and what the next tier needs.
      </p>
    </section>

    <section>
      <h3>Quirks</h3>
      <p>
        Now and then a recruit or monster has a <strong>Quirk</strong>: a small random boon (green) or flaw (red). Good
        Quirks make a recruit pricier, bad ones cheaper. Monsters with a Quirk show a ✦ on the board; hover it to see
        what you're facing.
      </p>
    </section>

    <section>
      <h3>Floors &amp; Bosses</h3>
      <p>
        Beating the floor 1 and floor 2 bosses earns a <strong>reward</strong>: pick one of three Traits for a party
        member, kept for the rest of the run. Clearing a floor also banks bonus Renown.
      </p>
    </section>

    <section>
      <h3>Progress</h3>
      <p>
        Spend Renown in <strong>Progress</strong> on <strong>Training</strong> (small permanent stat boosts) and
        <strong>Kits</strong> (costumes with a stat twist, swappable between rooms once owned). Characters also unlock
        extra Specials by meeting goals like "reach room 4 with them". Progress shows every goal.
      </p>
    </section>

    <section>
      <h3>Ending a Run</h3>
      <p>
        A run ends when you clear all 15 rooms, your party is wiped, or you retreat. Any of these banks the Renown you've
        earned so far.
      </p>
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
    width: min(600px, 92vw);
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
