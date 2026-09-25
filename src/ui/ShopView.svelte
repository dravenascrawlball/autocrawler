<script lang="ts">
  import { townStorage } from '../state/townStorage';
  import { buyShopItem } from '../state/townActions';
  import { ALL_ITEMS } from '../data/items';
</script>

<section class="shop">
  <img class="shop__art" src="/portraits/shop-town.png" alt="" />
  <span class="shop__scrim" aria-hidden="true"></span>

  <div class="shop__content">
    <h2>Shop</h2>

    <div class="shop-box shop-box--items">
      <h3>Items</h3>
      <ul>
        {#each ALL_ITEMS as item (item.id)}
          <li>
            {item.name} — {item.slot} — {item.price}g
            <button type="button" disabled={$townStorage.gold < item.price} on:click={() => buyShopItem(item.id)}>
              Buy
            </button>
          </li>
        {/each}
      </ul>
    </div>
  </div>
</section>

<style>
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

  .shop-box {
    background: var(--bg-inset);
    border: 1px solid var(--panel-border);
    border-radius: 6px;
    padding: 12px 14px;
    box-shadow: var(--shadow);
    /* Narrow so the background art stays visible beside it, rather than the panel spanning the
       whole section — this is a placeholder item roster (roadmap: item system likely gets
       reworked), so this isn't tuned around today's specific item count. */
    width: min(420px, 100%);
  }

  .shop-box h3 {
    margin-top: 0;
  }

  .shop-box--items ul {
    max-height: 340px;
    overflow-y: auto;
  }
</style>
