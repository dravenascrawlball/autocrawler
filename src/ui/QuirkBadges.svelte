<script lang="ts">
  import type { Adventurer } from '../sim/adventurer';
  import { quirksOf } from '../sim/quirks';

  /** A unit's Quirks (sim/quirks.ts) as small colored badges — green for a boon, red for a flaw — with the effect on hover. */
  export let adventurer: Adventurer;

  $: quirks = quirksOf(adventurer);
</script>

{#each quirks as quirk (quirk.id)}
  <span class="quirk" class:quirk--good={quirk.quirk === 'good'} class:quirk--bad={quirk.quirk === 'bad'} title={quirk.description}>
    {quirk.name}
  </span>
{/each}

<style>
  .quirk {
    display: inline-block;
    margin-left: 6px;
    padding: 0 6px;
    font-size: 11px;
    border-radius: 3px;
    border: 1px solid currentColor;
    cursor: help;
  }

  .quirk--good {
    color: #7fd07f;
  }

  .quirk--bad {
    color: #e07a7a;
  }
</style>
