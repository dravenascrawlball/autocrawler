<script lang="ts">
  import { cutInSetting, type CutInSetting } from '../state/cutInSetting';

  /** Settings: how often portrait cut-ins (ui/cutIns.ts) pop up during fights. */
  const OPTIONS: { value: CutInSetting; label: string; hint: string }[] = [
    { value: 'off', label: 'Off', hint: 'No cut-ins or boss cards.' },
    { value: 'key', label: 'Key moments', hint: 'Killing blows, saves, heroes falling, and boss entrances.' },
    { value: 'all', label: 'All', hint: 'Key moments plus every Special Action.' },
  ];
</script>

<section>
  <h2>Battle Cut-ins</h2>
  <div class="options" role="radiogroup" aria-label="Battle cut-ins">
    {#each OPTIONS as option (option.value)}
      <label class="option">
        <input type="radio" name="cut-ins" value={option.value} bind:group={$cutInSetting} />
        <span class="option__label">{option.label}</span>
        <span class="option__hint">{option.hint}</span>
      </label>
    {/each}
  </div>
</section>

<style>
  .options {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .option {
    display: flex;
    align-items: baseline;
    gap: 8px;
    cursor: pointer;
  }

  .option__label {
    color: var(--text-heading);
  }

  .option__hint {
    font-size: 12px;
    color: var(--text-muted);
  }
</style>
