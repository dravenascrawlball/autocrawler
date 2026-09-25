<script lang="ts">
  import { redeemSecretCode, type RedeemCodeResult } from '../state/roster';

  let code = '';
  let result: RedeemCodeResult | null = null;

  function submit(): void {
    if (!code.trim()) return;
    result = redeemSecretCode(code);
    code = '';
  }
</script>

<section>
  <h2>Enter Code</h2>
  <p class="hint">Hint: send feedback on the game or an image!</p>
  <form on:submit|preventDefault={submit}>
    <input type="text" bind:value={code} placeholder="Enter code" autocomplete="off" spellcheck="false" />
    <button type="submit">Redeem</button>
  </form>
  {#if result === 'unlocked'}
    <p class="message success">Code accepted — Dee has joined your roster!</p>
  {:else if result === 'already-unlocked'}
    <p class="message success">That code's already been redeemed — Dee is already in your roster.</p>
  {:else if result === 'invalid'}
    <p class="message error">That code isn't valid.</p>
  {/if}
</section>

<style>
  .hint {
    color: var(--text-muted, #999);
    font-size: 0.9em;
  }

  form {
    display: flex;
    gap: 0.5rem;
  }

  .message {
    margin-top: 0.5rem;
  }

  .success {
    color: var(--gold-bright);
  }

  .error {
    color: var(--danger-bright);
  }
</style>
