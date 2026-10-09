<script lang="ts">
  import type { RunSummary } from '../state/runSummary';
  import { ROOMS_PER_FLOOR } from '../sim/dungeonRun';
  import { portraitCandidates } from './portraits';
  import { fallbackSrc } from './imageFallback';

  /**
   * A finished run at a glance (the run summary screen, and past runs from
   * Progress's run log): outcome, the 15-room path across three floors, MVP
   * awards, a card per hero, and run totals. Renders a plain-data
   * RunSummary (state/runSummary.ts) only — no live game state.
   */
  export let summary: RunSummary;

  $: title =
    summary.outcome === 'completed'
      ? 'Dungeon Complete!'
      : summary.outcome === 'loss'
        ? `Defeated on Floor ${summary.floorReached}`
        : `Retreated from Floor ${summary.floorReached}`;
  $: floors = Array.from({ length: Math.ceil(summary.roomsTotal / ROOMS_PER_FLOOR) }, (_, floor) =>
    Array.from({ length: ROOMS_PER_FLOOR }, (_, room) => floor * ROOMS_PER_FLOOR + room),
  );
  $: endedRoom = summary.outcome === 'loss' ? summary.roomsWon : null;

  function roomState(index: number): 'won' | 'lost' | 'unreached' {
    if (index < summary.roomsWon) return 'won';
    if (index === endedRoom) return 'lost';
    return 'unreached';
  }

  const date = (ms: number) => new Date(ms).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
</script>

<div class="summary">
  <header class="summary__header">
    <h2>{title}</h2>
    <span class="summary__date">{date(summary.endedAt)}</span>
  </header>

  <div class="path" aria-label="Run path">
    {#each floors as rooms, floor (floor)}
      <div class="path__floor">
        <span class="path__label">Floor {floor + 1}</span>
        <div class="path__rooms">
          {#each rooms as index (index)}
            {@const state = roomState(index)}
            {@const boss = (index + 1) % ROOMS_PER_FLOOR === 0}
            <span
              class="path__room path__room--{state}"
              class:path__room--boss={boss}
              title={`Room ${index + 1}${boss ? ' (boss)' : ''}: ${state}`}
            >
              {state === 'lost' ? '✕' : boss ? '♛' : state === 'won' ? '✓' : ''}
            </span>
          {/each}
        </div>
      </div>
    {/each}
  </div>
  <p class="summary__line">
    {summary.roomsWon} / {summary.roomsTotal} rooms cleared
    {#if summary.bossesBeaten.length > 0}· beat {summary.bossesBeaten.join(', ')}{/if}
    {#if summary.endedBy.length > 0}· fell to {summary.endedBy.join(', ')}{/if}
  </p>

  {#if summary.mvps.length > 0}
    <ul class="mvps">
      {#each summary.mvps as mvp (mvp.award)}
        <li class="mvp">
          <span class="mvp__award">{mvp.award}</span>
          <span class="mvp__hero">{mvp.heroName}</span>
          <span class="mvp__value">{mvp.value} {mvp.unit}</span>
        </li>
      {/each}
    </ul>
  {/if}

  <ul class="heroes">
    {#each summary.heroes as hero (hero.id)}
      <li class="hero" class:hero--downed={hero.downed}>
        <img
          class="hero__portrait"
          use:fallbackSrc={portraitCandidates({ archetype: hero.archetype, activeKit: hero.kitArtKey ? { artKey: hero.kitArtKey } : undefined }, 'town')}
          alt=""
        />
        <div class="hero__body">
          <span class="hero__name">
            {hero.name}
            {#if hero.level > 1}<span class="hero__stars">{'★'.repeat(hero.level)}</span>{/if}
          </span>
          <span class="hero__title">{hero.title}{hero.downed ? ' · downed' : ''}</span>
          {#if hero.traitsEarned.length > 0}
            <span class="hero__traits">
              {#each hero.traitsEarned as trait (trait.name)}
                <span class="trait trait--{trait.kind}">{trait.name}</span>
              {/each}
            </span>
          {/if}
          <span class="hero__stats">
            {hero.damageDealt} dmg · {hero.healingDone} healed · {hero.damageTaken} taken · {hero.kills} kill{hero.kills === 1 ? '' : 's'}
          </span>
        </div>
      </li>
    {/each}
  </ul>

  <dl class="totals">
    <dt>Renown</dt>
    <dd>
      +{summary.renown.total}
      <span class="totals__detail">
        ({summary.renown.roomRenown} rooms{#if summary.renown.floorBonus > 0}, {summary.renown.floorBonus} floors{/if}{#if summary.renown.completionBonus > 0}, {summary.renown.completionBonus} completion{/if})
      </span>
    </dd>
    <dt>Gold</dt>
    <dd>{summary.goldEarned}g earned · {summary.goldSpent}g spent</dd>
    {#if summary.relics.length > 0}
      <dt>Relics</dt>
      <dd>{summary.relics.join(', ')}</dd>
    {/if}
    {#if summary.synergies.length > 0}
      <dt>Synergies</dt>
      <dd>{summary.synergies.join(', ')}</dd>
    {/if}
  </dl>
</div>

<style>
  .summary {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .summary__header {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    gap: 12px;
    flex-wrap: wrap;
  }

  .summary__header h2 {
    margin: 0;
  }

  .summary__date,
  .summary__line {
    font-size: 13px;
    color: var(--text-muted);
    margin: 0;
  }

  .path {
    display: flex;
    flex-wrap: wrap;
    gap: 14px;
  }

  .path__floor {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .path__label {
    font-size: 11px;
    color: var(--text-muted);
  }

  .path__rooms {
    display: flex;
    gap: 4px;
  }

  .path__room {
    width: 26px;
    height: 26px;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 13px;
    border: 1px solid var(--panel-border);
    border-radius: 4px;
    color: var(--text-muted);
  }

  .path__room--won {
    background: var(--bg-inset);
    border-color: var(--gold);
    color: var(--gold-bright);
  }

  .path__room--lost {
    border-color: #e07a7a;
    color: #e07a7a;
  }

  .path__room--boss {
    border-width: 2px;
  }

  .mvps {
    list-style: none;
    padding: 0;
    margin: 0;
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
    gap: 8px;
  }

  .mvp {
    display: flex;
    flex-direction: column;
    padding: 8px 10px;
    border: 1px solid var(--gold);
    border-radius: 6px;
    background: var(--bg-inset);
  }

  .mvp__award {
    font-size: 11px;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: var(--gold-bright);
  }

  .mvp__hero {
    font-family: var(--font-heading);
    color: var(--text-heading);
  }

  .mvp__value {
    font-size: 12px;
    color: var(--text-muted);
  }

  .heroes {
    list-style: none;
    padding: 0;
    margin: 0;
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
    gap: 8px;
  }

  .hero {
    display: flex;
    gap: 10px;
    padding: 8px;
    border: 1px solid var(--panel-border);
    border-radius: 6px;
    background: var(--bg-inset);
  }

  .hero--downed {
    opacity: 0.7;
  }

  .hero__portrait {
    width: 52px;
    height: 78px;
    object-fit: cover;
    border-radius: 4px;
    flex-shrink: 0;
  }

  .hero__body {
    display: flex;
    flex-direction: column;
    gap: 2px;
    min-width: 0;
  }

  .hero__name {
    font-family: var(--font-heading);
    color: var(--text-heading);
  }

  .hero__stars {
    margin-left: 4px;
    color: var(--gold-bright);
    font-size: 12px;
  }

  .hero__title,
  .hero__stats {
    font-size: 12px;
    color: var(--text-muted);
  }

  .hero__traits {
    display: flex;
    flex-wrap: wrap;
    gap: 4px;
  }

  .trait {
    font-size: 11px;
    padding: 0 6px;
    border: 1px solid currentColor;
    border-radius: 3px;
  }

  .trait--milestone {
    color: var(--gold-bright);
  }

  .trait--boon {
    color: #7fd07f;
  }

  .trait--flaw {
    color: #e07a7a;
  }

  .totals {
    display: grid;
    grid-template-columns: max-content 1fr;
    gap: 4px 12px;
    margin: 0;
    font-size: 13px;
  }

  .totals dt {
    color: var(--text-heading);
  }

  .totals dd {
    margin: 0;
    color: var(--text);
  }

  .totals__detail {
    color: var(--text-muted);
  }
</style>
