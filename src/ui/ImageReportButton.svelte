<script lang="ts">
  import { bugReportUrl } from './feedback';

  /** Image path (e.g. from portraitAssetPath/downedArtPath) prefilled into the form so the report identifies the exact asset without the player typing it. */
  export let imageRef: string;
  /** Inline position override (top/right/bottom/left) — each host modal places its close/toggle controls differently, so there's no one corner that never collides. */
  export let style = '';
</script>

<a
  class="image-report"
  {style}
  href={bugReportUrl(imageRef)}
  target="_blank"
  rel="noopener noreferrer"
  title="This image isn't hitting for me"
  aria-label="Report feedback on this image"
>
  🖼️
</a>

<style>
  .image-report {
    position: absolute;
    z-index: 3;
    display: flex;
    align-items: center;
    justify-content: center;
    width: 26px;
    height: 26px;
    background: rgba(0, 0, 0, 0.55);
    border: 1px solid var(--panel-border);
    border-radius: 4px;
    text-decoration: none;
    font-size: 14px;
    line-height: 1;
  }

  .image-report:hover {
    background: rgba(0, 0, 0, 0.75);
  }
</style>
