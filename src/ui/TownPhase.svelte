<script lang="ts">
  import BenchView from './BenchView.svelte';
  import OpeningShopView from './OpeningShopView.svelte';
  import CharacterSheetView from './CharacterSheetView.svelte';
  import RecruitmentView from './RecruitmentView.svelte';
  import ProgressView from './ProgressView.svelte';
  import SettingsView from './SettingsView.svelte';
  import { metaProgression } from '../state/metaProgression';
  import { lastRunReward } from '../state/progression';

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
   * Progress card (ui/ProgressView.svelte — roadmap item 3) shows Renown,
   * per-character stats and unlock goals, with the Renown-priced Kit shop
   * (ui/ShopView.svelte) underneath.
   */
  const HUB_CARDS: HubCard[] = [
    { id: 'roster', label: 'Roster', description: 'Review your characters, their Kits, and their Traits.' },
    { id: 'recruit', label: 'Recruit', description: 'Permanently unlock a new character for future runs.' },
    { id: 'embark', label: 'Embark', description: 'Spend gold to build your party, then head into the dungeon.' },
    { id: 'shop', label: 'Progress', description: 'Your Renown, unlocks and goals — and the Kit shop.' },
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

  {#if $lastRunReward}
    <!-- Return-to-town toast (roadmap item 3): what the run just earned, once — see state/progression.ts. -->
    <div class="reward-toast" role="status">
      <div class="reward-toast__body">
        <strong>+{$lastRunReward.renown.total} Renown</strong>
        <span class="reward-toast__detail">
          {$lastRunReward.renown.roomsWon} room{$lastRunReward.renown.roomsWon === 1 ? '' : 's'} cleared{#if $lastRunReward.renown.floorBonus > 0}
            · +{$lastRunReward.renown.floorBonus} floor bonus{/if}{#if $lastRunReward.renown.completionBonus > 0}
            · +{$lastRunReward.renown.completionBonus} completion bonus{/if}
        </span>
        {#each $lastRunReward.newUnlocks as unlock (unlock.characterName + unlock.name)}
          <span class="reward-toast__unlock">✦ {unlock.characterName} unlocked {unlock.name}</span>
        {/each}
      </div>
      <div class="reward-toast__actions">
        <button
          type="button"
          on:click={() => {
            activeView = 'shop';
            lastRunReward.set(null);
          }}
        >
          View Progress
        </button>
        <button type="button" class="reward-toast__close" aria-label="Dismiss" on:click={() => lastRunReward.set(null)}>✕</button>
      </div>
    </div>
  {/if}

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
      <ProgressView onOpenCharacter={openSheet} />
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
  .reward-toast {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 12px;
    margin-bottom: 16px;
    padding: 12px 14px;
    background: var(--bg-inset);
    border: 1px solid var(--gold);
    border-radius: 8px;
    box-shadow: var(--shadow);
  }

  .reward-toast__body {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .reward-toast__body strong {
    font-family: var(--font-heading);
    color: var(--gold-bright);
  }

  .reward-toast__detail {
    font-size: 13px;
    color: var(--text-muted);
  }

  .reward-toast__unlock {
    font-size: 13px;
    color: var(--text-heading);
  }

  .reward-toast__actions {
    display: flex;
    align-items: center;
    gap: 8px;
    flex-shrink: 0;
  }

  .reward-toast__close {
    background: none;
    border: none;
    color: var(--text-muted);
    cursor: pointer;
  }

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
