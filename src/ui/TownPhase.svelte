<script lang="ts">
  import BenchView from './BenchView.svelte';
  import OpeningShopView from './OpeningShopView.svelte';
  import CharacterSheetView from './CharacterSheetView.svelte';
  import RecruitmentView from './RecruitmentView.svelte';
  import ShopView from './ShopView.svelte';
  import SettingsView from './SettingsView.svelte';
  import { metaProgression } from '../state/metaProgression';

  type View = 'hub' | 'roster' | 'shop' | 'recruit' | 'embark' | 'settings';

  interface HubCard {
    id: View;
    label: string;
    description: string;
    disabled?: boolean;
  }

  /**
   * The Town's front screen (Town Storage Cleanup, see docs/roadmap.md) —
   * replaces the old top tab bar with a Hub of large card-buttons. The
   * Meta Progression card (ui/ShopView.svelte) now spends Renown — see
   * state/metaProgression.ts/sim/renown.ts — on Kits instead of the old
   * gold-priced Items.
   */
  const HUB_CARDS: HubCard[] = [
    { id: 'roster', label: 'Roster', description: 'Review your characters, their Kits, and their Traits.' },
    { id: 'recruit', label: 'Recruit', description: 'Permanently unlock a new character for future runs.' },
    { id: 'embark', label: 'Embark', description: 'Spend gold to build your party, then head into the dungeon.' },
    { id: 'shop', label: 'Meta Progression', description: 'Spend Renown on Kits for your characters.' },
  ];

  let activeView: View = 'hub';
  let selectedAdventurerId: string | null = null;
  let sheetOpen = false;

  function openSheet(id: string): void {
    selectedAdventurerId = id;
    sheetOpen = true;
  }

  function openCard(card: HubCard): void {
    if (card.disabled) return;
    activeView = card.id;
  }
</script>

<div class="town">
  <header class="town-header">
    <h1>The Town</h1>
    <span class="renown">{$metaProgression.renown} Renown</span>
  </header>

  {#if activeView !== 'hub'}
    <button type="button" class="back-to-hub" on:click={() => (activeView = 'hub')}>← Back to Town</button>
  {/if}

  <main class="tab-panel">
    {#if activeView === 'hub'}
      <div class="hub-grid">
        {#each HUB_CARDS as card (card.id)}
          <button
            type="button"
            class="hub-card"
            class:hub-card--disabled={card.disabled}
            disabled={card.disabled}
            on:click={() => openCard(card)}
          >
            <span class="hub-card__label">{card.label}</span>
            <span class="hub-card__description">{card.description}</span>
          </button>
        {/each}
        <button type="button" class="hub-card hub-card--settings" on:click={() => (activeView = 'settings')}>
          <span class="hub-card__label">Settings</span>
          <span class="hub-card__description">Manage your save.</span>
        </button>
      </div>
    {:else if activeView === 'roster'}
      <BenchView {selectedAdventurerId} onSelect={openSheet} onGoToRecruit={() => (activeView = 'recruit')} />
    {:else if activeView === 'shop'}
      <ShopView />
    {:else if activeView === 'recruit'}
      <RecruitmentView />
    {:else if activeView === 'embark'}
      <OpeningShopView />
    {:else}
      <SettingsView />
    {/if}
  </main>

  {#if sheetOpen}
    <CharacterSheetView adventurerId={selectedAdventurerId} onClose={() => (sheetOpen = false)} />
  {/if}
</div>

<style>
  .renown {
    font-family: var(--font-heading);
    font-size: 20px;
    color: var(--gold-bright);
  }

  .back-to-hub {
    margin-bottom: 12px;
    font-size: 13px;
    color: var(--text-muted);
    background: transparent;
    border: none;
    padding: 0;
    cursor: pointer;
  }

  .back-to-hub:hover {
    color: var(--text-heading);
  }

  .hub-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
    gap: 16px;
  }

  .hub-card {
    display: flex;
    flex-direction: column;
    gap: 6px;
    align-items: flex-start;
    text-align: left;
    padding: 20px;
    min-height: 120px;
    background: var(--bg-inset);
    border: 1px solid var(--panel-border);
    border-radius: 8px;
    box-shadow: var(--shadow);
    cursor: pointer;
  }

  .hub-card:not(.hub-card--disabled):hover {
    border-color: var(--gold);
  }

  .hub-card--disabled {
    cursor: not-allowed;
    opacity: 0.5;
  }

  .hub-card__label {
    font-family: var(--font-heading);
    font-size: 18px;
    color: var(--text-heading);
  }

  .hub-card__description {
    font-size: 13px;
    color: var(--text-muted);
  }
</style>
