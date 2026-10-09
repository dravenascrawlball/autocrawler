<script lang="ts">
  import type { ReplayUnit } from '../game/RoomReplayScene';
  import type { CutInEvent } from './cutIns';
  import { portraitCandidates } from './portraits';
  import { fallbackSrc } from './imageFallback';

  /**
   * Draws portrait cut-ins (ui/cutIns.ts) over the replay canvas: a slanted
   * banner sliding in from the unit's side (heroes from the left, monsters
   * from the right), or a centered card for a boss entrance. A new cut-in
   * replaces the one showing, so they never queue up behind the fight.
   * Pointer-transparent, so the canvas underneath stays clickable.
   */
  export let current: { key: number; event: CutInEvent; unit: ReplayUnit } | null = null;
  /** Battle speed (state/battleSpeed.ts) — cut-ins play faster at 2×/4× too. */
  export let speed = 1;

  const BANNER_MS = 1300;
  const BOSS_MS = 1900;

  $: duration = current ? (current.event.kind === 'boss' ? BOSS_MS : BANNER_MS) / speed : 0;
  $: subject = current
    ? { archetype: current.unit.archetype, activeKit: current.unit.kitArtKey ? { artKey: current.unit.kitArtKey } : undefined }
    : null;

  function done(key: number): void {
    if (current?.key === key) current = null;
  }
</script>

{#if current && subject}
  {#key current.key}
    {@const key = current.key}
    {#if current.event.kind === 'boss'}
      <div class="cut-in cut-in--boss" style="--cut-in-ms: {duration}ms" on:animationend={() => done(key)}>
        <img class="cut-in__portrait" use:fallbackSrc={portraitCandidates(subject, 'idle')} alt="" />
        <div class="cut-in__text">
          <span class="cut-in__eyebrow">Boss</span>
          <span class="cut-in__name">{current.unit.name}</span>
        </div>
      </div>
    {:else}
      <div
        class="cut-in cut-in--banner cut-in--{current.event.kind} cut-in--{current.unit.side}"
        style="--cut-in-ms: {duration}ms"
        on:animationend={() => done(key)}
      >
        <img class="cut-in__portrait" use:fallbackSrc={portraitCandidates(subject, current.event.art)} alt="" />
        <span class="cut-in__line">{current.event.text}</span>
      </div>
    {/if}
  {/key}
{/if}

<style>
  .cut-in {
    position: absolute;
    pointer-events: none;
    z-index: 5;
    display: flex;
    align-items: center;
  }

  .cut-in--banner {
    --accent: var(--gold-bright, #ffd24a);
    top: 18%;
    left: 0;
    right: 0;
    height: 30%;
    max-height: 170px;
    gap: 12px;
    padding: 0 16px;
    background: linear-gradient(90deg, rgba(0, 0, 0, 0.85), rgba(0, 0, 0, 0.55));
    border-top: 2px solid var(--accent);
    border-bottom: 2px solid var(--accent);
    clip-path: polygon(0 12%, 100% 0, 100% 88%, 0 100%);
    animation: banner-from-left var(--cut-in-ms) ease-out forwards;
  }

  .cut-in--enemy {
    flex-direction: row-reverse;
    background: linear-gradient(270deg, rgba(0, 0, 0, 0.85), rgba(0, 0, 0, 0.55));
    animation-name: banner-from-right;
  }

  .cut-in--save {
    --accent: #7fd07f;
  }

  .cut-in--fall {
    --accent: #e07a7a;
  }

  .cut-in--special {
    --accent: #5aa9ff;
  }

  .cut-in--banner .cut-in__portrait {
    height: 120%;
    aspect-ratio: 2 / 3;
    object-fit: cover;
    object-position: top;
    align-self: flex-end;
  }

  .cut-in__line {
    font-family: var(--font-heading, serif);
    font-size: clamp(14px, 3.4vw, 22px);
    color: var(--accent);
    text-shadow: 0 2px 4px #000;
  }

  .cut-in--boss {
    inset: 0;
    flex-direction: column;
    justify-content: center;
    gap: 10px;
    background: radial-gradient(circle, rgba(60, 0, 0, 0.75), rgba(0, 0, 0, 0.9));
    animation: boss-card var(--cut-in-ms) ease-out forwards;
  }

  .cut-in--boss .cut-in__portrait {
    height: 55%;
    aspect-ratio: 2 / 3;
    object-fit: cover;
    border: 2px solid #c0392b;
    border-radius: 6px;
    box-shadow: 0 0 24px rgba(192, 57, 43, 0.7);
  }

  .cut-in--boss .cut-in__text {
    display: flex;
    flex-direction: column;
    align-items: center;
  }

  .cut-in__eyebrow {
    font-size: 12px;
    letter-spacing: 0.3em;
    text-transform: uppercase;
    color: #e07a7a;
  }

  .cut-in__name {
    font-family: var(--font-heading, serif);
    font-size: clamp(20px, 5vw, 32px);
    color: #fff;
    text-shadow: 0 2px 6px #000;
  }

  @keyframes banner-from-left {
    0% {
      transform: translateX(-100%);
      opacity: 0;
    }
    15%,
    80% {
      transform: translateX(0);
      opacity: 1;
    }
    100% {
      transform: translateX(8%);
      opacity: 0;
    }
  }

  @keyframes banner-from-right {
    0% {
      transform: translateX(100%);
      opacity: 0;
    }
    15%,
    80% {
      transform: translateX(0);
      opacity: 1;
    }
    100% {
      transform: translateX(-8%);
      opacity: 0;
    }
  }

  @keyframes boss-card {
    0% {
      opacity: 0;
      transform: scale(1.08);
    }
    15%,
    80% {
      opacity: 1;
      transform: scale(1);
    }
    100% {
      opacity: 0;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .cut-in--banner,
    .cut-in--enemy,
    .cut-in--boss {
      animation-name: boss-card;
    }
  }
</style>
