<script lang="ts">
  import { metaProgression } from '../state/metaProgression';
  import { buyKitFromShop } from '../state/townActions';
  import { KIT_SHOP_CATALOG } from '../data/kitShop';
  import { isEventKitEarnOnly } from '../state/progression';

  // Takes `unlockedKitIds` as a parameter (rather than closing over $metaProgression) so its call
  // site below can reference `$metaProgression` directly — Svelte's dependency tracking for a
  // template block only sees identifiers textually present in that block's own expressions, not
  // ones a called function merely closes over, so a plain closure here would silently go stale.
  function isOwned(unlockedKitIds: Record<string, string[]>, characterName: string, kitId: string): boolean {
    return (unlockedKitIds[characterName] ?? []).includes(kitId);
  }
</script>

<section class="shop">
  <img class="shop__art" src="/portraits/shop-town.png" alt="" />
  <span class="shop__scrim" aria-hidden="true"></span>

  <div class="shop__content">
    <h2>Shop <span class="shop__renown">{$metaProgression.renown} Renown</span></h2>

    <div class="shop-box shop-box--kits">
      <h3>Kits</h3>
      <ul>
        {#each KIT_SHOP_CATALOG as entry (entry.characterName + ':' + entry.kit.id)}
          <li>
            <strong>{entry.characterName}</strong> — <span class="kit-name">{entry.kit.name}</span>
            <p class="kit-description">{entry.kit.description}</p>
            {#if isOwned($metaProgression.unlockedKitIds, entry.characterName, entry.kit.id)}
              <span class="kit-owned">Owned</span>
            {:else if isEventKitEarnOnly(entry)}
              <span class="kit-event">🎃 Halloween event: reach Floor 2 with {entry.characterName}</span>
            {:else}
              <button
                type="button"
                disabled={$metaProgression.renown < entry.price}
                on:click={() => buyKitFromShop(entry.characterName, entry.kit.id)}
              >
                Buy — {entry.price} Renown
              </button>
            {/if}
          </li>
        {/each}
      </ul>
    </div>
  </div>
</section>

<style>
  .kit-event {
    font-size: 12px;
    color: #ffb070;
  }

  .shop {
    position: relative;
    overflow: hidden;
    min-height: 480px;
    /* Global `section` styling (app.css) adds 16px padding — overridden here so the background
       art can sit truly edge-to-edge instead of leaving an unstyled border around it; the same
       padding moves onto .shop__content instead. */
    padding: 0;
  }

  .shop__art {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    object-fit: cover;
    object-position: top center;
    z-index: 0;
  }

  .shop__scrim {
    position: absolute;
    inset: 0;
    background: linear-gradient(to bottom, rgba(0, 0, 0, 0.25) 0%, rgba(0, 0, 0, 0.75) 60%, rgba(0, 0, 0, 0.9) 100%);
    z-index: 1;
  }

  .shop__content {
    position: relative;
    z-index: 2;
    padding: 16px;
    display: flex;
    flex-direction: column;
    gap: 16px;
  }

  .shop__content h2 {
    text-shadow: 0 2px 6px rgba(0, 0, 0, 0.9);
  }

  .shop__renown {
    font-size: 14px;
    color: var(--gold-bright);
    margin-left: 8px;
  }

  .shop-box {
    background: var(--bg-inset);
    border: 1px solid var(--panel-border);
    border-radius: 6px;
    padding: 12px 14px;
    box-shadow: var(--shadow);
    /* Narrow so the background art stays visible beside it, rather than the panel spanning the
       whole section — this is a placeholder Kit roster (pending the balance pass), not tuned
       around today's specific count. */
    width: min(420px, 100%);
  }

  .shop-box h3 {
    margin-top: 0;
  }

  .shop-box--kits ul {
    list-style: none;
    margin: 0;
    padding: 0;
    max-height: 340px;
    overflow-y: auto;
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .shop-box--kits li {
    padding-bottom: 10px;
    border-bottom: 1px solid var(--panel-border);
  }

  .shop-box--kits li:last-child {
    padding-bottom: 0;
    border-bottom: none;
  }

  .kit-description {
    font-size: 13px;
    color: var(--text-muted);
    margin: 4px 0 8px;
  }

  .kit-owned {
    font-size: 13px;
    color: var(--gold-bright);
  }
</style>
