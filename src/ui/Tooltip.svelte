<script lang="ts">
  /** Text shown on hover/focus, above the wrapped content. Supports \n line breaks. */
  export let text: string;
</script>

<span class="tooltip-wrap">
  <slot />
  <span class="tooltip-bubble" role="tooltip">{text}</span>
</span>

<style>
  .tooltip-wrap {
    position: relative;
    display: inline-block;
    width: 100%;
  }

  .tooltip-bubble {
    position: absolute;
    bottom: 100%;
    left: 50%;
    transform: translateX(-50%);
    margin-bottom: 6px;
    padding: 6px 10px;
    background: var(--bg-inset);
    border: 1px solid var(--panel-border);
    border-radius: 4px;
    font-size: 12px;
    line-height: 1.4;
    white-space: pre-line;
    color: var(--text-heading);
    box-shadow: var(--shadow);
    opacity: 0;
    visibility: hidden;
    pointer-events: none;
    transition: opacity 0.1s;
    z-index: 10;
    width: max-content;
    max-width: 220px;
  }

  .tooltip-wrap:hover .tooltip-bubble,
  .tooltip-wrap:focus-within .tooltip-bubble {
    opacity: 1;
    visibility: visible;
  }
</style>
