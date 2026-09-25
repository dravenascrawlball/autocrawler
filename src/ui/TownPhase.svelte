<script lang="ts">
  import BenchView from './BenchView.svelte';
  import InventoryView from './InventoryView.svelte';
  import PartySelectionView from './PartySelectionView.svelte';
  import CharacterSheetView from './CharacterSheetView.svelte';
  import RecruitmentView from './RecruitmentView.svelte';
  import ShopView from './ShopView.svelte';
  import SettingsView from './SettingsView.svelte';
  import { townStorage } from '../state/townStorage';

  type Tab = 'roster' | 'shop' | 'recruit' | 'embark' | 'settings';
  const TABS: { id: Tab; label: string }[] = [
    { id: 'roster', label: 'Roster' },
    { id: 'shop', label: 'Shop' },
    { id: 'recruit', label: 'Recruit' },
    { id: 'embark', label: 'Embark' },
  ];

  let activeTab: Tab = 'roster';
  let selectedAdventurerId: string | null = null;
  let sheetOpen = false;

  function openSheet(id: string): void {
    selectedAdventurerId = id;
    sheetOpen = true;
  }
</script>

<div class="town">
  <header class="town-header">
    <h1>The Town</h1>
    <div class="town-header__stats">
      <span class="gold">{$townStorage.gold}g</span>
    </div>
  </header>

  <nav class="tabs">
    {#each TABS as tab (tab.id)}
      <button type="button" class="tab" class:tab--active={activeTab === tab.id} on:click={() => (activeTab = tab.id)}>
        {tab.label}
      </button>
    {/each}
    <button
      type="button"
      class="tab tab--settings"
      class:tab--active={activeTab === 'settings'}
      on:click={() => (activeTab = 'settings')}
    >
      Settings
    </button>
  </nav>

  <main class="tab-panel">
    {#if activeTab === 'roster'}
      <BenchView {selectedAdventurerId} onSelect={openSheet} onGoToRecruit={() => (activeTab = 'recruit')} />
      <InventoryView {selectedAdventurerId} />
    {:else if activeTab === 'shop'}
      <ShopView />
    {:else if activeTab === 'recruit'}
      <RecruitmentView />
    {:else if activeTab === 'embark'}
      <PartySelectionView />
    {:else}
      <SettingsView />
    {/if}
  </main>

  {#if sheetOpen}
    <CharacterSheetView adventurerId={selectedAdventurerId} onClose={() => (sheetOpen = false)} />
  {/if}
</div>
