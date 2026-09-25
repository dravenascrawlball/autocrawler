<script lang="ts">
  import { roster } from '../state/roster';
  import { townStorage } from '../state/townStorage';
  import { unequipItemForAdventurer, equipItemForAdventurer, setAdventurerRow } from '../state/townActions';
  import { ENCHANTMENT_REGISTRY } from '../sim/enchantments';
  import { ACTION_DESCRIPTIONS } from './actionDescriptions';
  import type { EquipmentSlot } from '../sim/items';
  import type { Row } from '../sim/formation';
  import type { Adventurer } from '../sim/adventurer';
  import { portraitAssetPath } from './portraits';
  import Tooltip from './Tooltip.svelte';
  import ImageReportButton from './ImageReportButton.svelte';

  export let adventurerId: string | null = null;
  export let onClose: () => void = () => {};

  const SLOTS: EquipmentSlot[] = ['weapon', 'armor', 'trinket'];

  interface FaceGroup {
    label: string;
    count: number;
    description: string;
  }

  /** Groups the 6 fixed dice faces by (action, enchantment) so e.g. 4 identical Attack faces show as one row — see the Roster Dice Faces roadmap note: faces are no longer player-alterable, character + equipment fully determine them. */
  function groupFaces(adventurer: Adventurer): FaceGroup[] {
    const groups = new Map<string, FaceGroup>();
    for (const face of adventurer.dieFaces) {
      const enchantmentName = face.enchantmentId ? ENCHANTMENT_REGISTRY[face.enchantmentId].name : null;
      const key = `${face.action.id}:${enchantmentName ?? ''}`;
      const existing = groups.get(key);
      if (existing) {
        existing.count += 1;
        continue;
      }
      const description = ACTION_DESCRIPTIONS[face.action.id] ?? '';
      groups.set(key, {
        label: enchantmentName ? `${face.action.name} (${enchantmentName})` : face.action.name,
        count: 1,
        description: enchantmentName ? `${description}\nEnchanted: ${enchantmentName}` : description,
      });
    }
    return [...groups.values()];
  }

  $: adventurer = adventurerId ? ($roster.adventurers.find((a) => a.id === adventurerId) ?? null) : null;
  $: faceGroups = adventurer ? groupFaces(adventurer) : [];

  function setRow(row: Row): void {
    if (!adventurer) return;
    setAdventurerRow(adventurer.id, row);
  }

  function fallbackToIdle(event: Event, archetype: string): void {
    const img = event.currentTarget as HTMLImageElement;
    img.src = portraitAssetPath(archetype, 'idle');
  }

  // `adventurer` can go null (closed, or the roster entry disappears) in the same tick this
  // view's own <img> emits a failed-load `error` event — the handler below reads the live
  // reactive binding, not a snapshot, so it must guard against that instead of assuming the
  // element it's still attached to implies a non-null adventurer.

  function handleBackdropKeydown(event: KeyboardEvent): void {
    if (event.key === 'Escape' || event.key === 'Enter' || event.key === ' ') {
      onClose();
    }
  }
</script>

<svelte:window on:keydown={handleBackdropKeydown} />

{#if adventurer}
  <div
    class="sheet-backdrop"
    on:click={onClose}
    on:keydown={handleBackdropKeydown}
    role="button"
    tabindex="-1"
    aria-label="Close character sheet"
  >
    <div
      class="sheet"
      role="dialog"
      aria-modal="true"
      aria-label="{adventurer.name} character sheet"
      tabindex="-1"
      on:click|stopPropagation
      on:keydown|stopPropagation
    >
      <img
        class="sheet__art"
        src={portraitAssetPath(adventurer.archetype, 'town')}
        on:error={(event) => adventurer && fallbackToIdle(event, adventurer.archetype)}
        alt="{adventurer.archetype} in town"
      />

      <div class="sheet__name-badge">
        <span class="sheet__name">{adventurer.name}</span>
        <span class="sheet__subtitle">
          {adventurer.role} — Lv {adventurer.level}
        </span>
      </div>

      <button type="button" class="sheet__close" on:click={onClose} aria-label="Close character sheet">✕</button>

      <ImageReportButton
        imageRef={portraitAssetPath(adventurer.archetype, 'town')}
        style="top: 10px; right: 50px;"
      />

      <div class="sheet__column sheet__column--left">
        <section class="sheet-box sheet-box--stats">
          <h3>Stats</h3>
          <div class="hp-bar" role="presentation">
            <span class="hp-fill" style="width: {Math.max(0, (adventurer.hp / adventurer.maxHp) * 100)}%"></span>
            <span class="hp-label">{adventurer.hp} / {adventurer.maxHp} HP</span>
          </div>
          <dl class="stat-grid">
            <dt>Attack</dt>
            <dd>{adventurer.attackPower}</dd>
            <dt>Speed</dt>
            <dd>{adventurer.speed}</dd>
            <dt>Accuracy</dt>
            <dd>{adventurer.accuracy}%</dd>
            <dt>Evasion</dt>
            <dd>{adventurer.evasion}%</dd>
            {#if adventurer.healPower > 0}
              <dt>Heal Power</dt>
              <dd>{adventurer.healPower}</dd>
            {/if}
            <dt>XP</dt>
            <dd>{adventurer.xp} / {adventurer.xp + adventurer.xpToNextLevel}</dd>
          </dl>

          <div class="row-toggle">
            <span class="row-toggle__label">Formation</span>
            <button type="button" aria-pressed={adventurer.row === 'front'} on:click={() => setRow('front')}>
              Front
            </button>
            <button type="button" aria-pressed={adventurer.row === 'back'} on:click={() => setRow('back')}>
              Back
            </button>
          </div>

          {#if adventurer.traits.length > 0}
            <p class="traits">Traits: {adventurer.traits.map((trait) => trait.name).join(', ')}</p>
          {/if}
        </section>

        <section class="sheet-box sheet-box--equipment">
          <h3>Equipment</h3>
          <ul class="slot-list">
            {#each SLOTS as slot (slot)}
              <li class="slot-row">
                <span class="slot-row__label">{slot}</span>
                <span class="slot-row__value">{adventurer.equipment[slot]?.name ?? '(empty)'}</span>
                {#if adventurer.equipment[slot]}
                  <button type="button" on:click={() => adventurer && unequipItemForAdventurer(adventurer.id, slot)}>
                    Unequip
                  </button>
                {:else}
                  <select
                    value=""
                    on:change={(event) => {
                      // Resolved by index into this exact filtered list, not by name — two items
                      // can share a name (e.g. two Ring of Embers drops with different rolled
                      // faceEffect.faceIndex values), and a name-string lookup would silently
                      // equip whichever same-named instance happened to match first.
                      const index = Number((event.target as HTMLSelectElement).value);
                      const item = $townStorage.items.filter((i) => i.slot === slot)[index];
                      if (item && adventurer) equipItemForAdventurer(adventurer.id, item);
                      (event.target as HTMLSelectElement).value = '';
                    }}
                  >
                    <option value="">Equip from storage…</option>
                    {#each $townStorage.items.filter((i) => i.slot === slot) as item, index (index)}
                      <option value={index}>{item.name}</option>
                    {/each}
                  </select>
                {/if}
              </li>
            {/each}
          </ul>
        </section>
      </div>

      <div class="sheet__column sheet__column--right">
        <section class="sheet-box sheet-box--dice">
          <h3>Dice Faces</h3>
          <ul class="face-list">
            {#each faceGroups as group (group.label)}
              <li class="face-row">
                <Tooltip text={group.description || 'No description yet.'}>
                  <span class="face-row__name">{group.count} {group.label}</span>
                </Tooltip>
              </li>
            {/each}
          </ul>
        </section>
      </div>
    </div>
  </div>
{/if}

<style>
  .sheet-backdrop {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.7);
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 24px;
    z-index: 100;
  }

  /* Matches the sample art's own ratio (1800x1240) so object-fit: cover
     crops as little as possible instead of chopping off the character. */
  .sheet {
    position: relative;
    width: min(1040px, 96vw);
    max-height: 90vh;
    aspect-ratio: 45 / 31;
    background: var(--bg-raised);
    border: 1px solid var(--panel-border);
    border-radius: 8px;
    box-shadow: var(--shadow);
    overflow: hidden;
  }

  .sheet__art {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    object-fit: cover;
    object-position: top center;
    z-index: 0;
  }

  .sheet__name-badge {
    position: absolute;
    top: 14px;
    left: 14px;
    z-index: 2;
    display: flex;
    flex-direction: column;
    gap: 2px;
    padding: 6px 12px;
    background: var(--bg-inset);
    border: 1px solid var(--panel-border);
    border-radius: 6px;
    box-shadow: var(--shadow);
  }

  .sheet__name {
    font-family: var(--font-heading);
    font-size: 16px;
    color: var(--text-heading);
  }

  .sheet__subtitle {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 12px;
    color: var(--text-muted);
  }

  .sheet__close {
    position: absolute;
    top: 10px;
    right: 10px;
    z-index: 2;
    padding: 4px 10px;
  }

  .sheet__column {
    position: absolute;
    top: 34%;
    bottom: 4%;
    width: clamp(220px, 27%, 320px);
    display: flex;
    flex-direction: column;
    gap: 12px;
    overflow-y: auto;
    z-index: 1;
  }

  .sheet__column--left {
    left: 4%;
  }

  .sheet__column--right {
    right: 4%;
  }

  .sheet-box {
    background: var(--bg-inset);
    border: 1px solid var(--panel-border);
    border-radius: 6px;
    padding: 12px 14px;
    box-shadow: var(--shadow);
    flex-shrink: 0;
  }

  .sheet-box h3 {
    margin-top: 0;
  }

  .hp-bar {
    position: relative;
    height: 20px;
    border-radius: 4px;
    background: var(--bg);
    border: 1px solid var(--panel-border);
    overflow: hidden;
    margin-bottom: 10px;
  }

  .hp-fill {
    display: block;
    height: 100%;
    background: var(--party);
  }

  .hp-label {
    position: absolute;
    inset: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 12px;
    color: var(--text-heading);
  }

  .stat-grid {
    display: grid;
    grid-template-columns: auto 1fr;
    column-gap: 12px;
    row-gap: 2px;
    margin: 0 0 10px;
  }

  .stat-grid dt {
    color: var(--text-muted);
  }

  .stat-grid dd {
    margin: 0;
    text-align: right;
    color: var(--text-heading);
  }

  .row-toggle {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: 6px;
    margin-bottom: 8px;
  }

  .row-toggle__label {
    color: var(--text-muted);
    font-size: 14px;
  }

  .traits {
    color: var(--gold-bright);
    font-size: 13px;
    margin: 0;
  }

  .slot-list,
  .face-list {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .slot-row {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: 8px;
  }

  .slot-row__label {
    text-transform: capitalize;
    color: var(--text-muted);
    width: 60px;
  }

  .slot-row__value {
    flex: 1;
  }

  .face-row {
    padding-bottom: 8px;
    border-bottom: 1px solid var(--panel-border);
  }

  .face-list li.face-row:last-child {
    padding-bottom: 0;
    border-bottom: none;
  }

  .face-row__name {
    color: var(--text-heading);
    cursor: default;
  }

  .sheet-box select {
    width: 100%;
    min-width: 0;
    font-size: 13px;
    padding: 3px 6px;
  }

  .sheet-box button {
    font-size: 13px;
    padding: 3px 10px;
  }
</style>
