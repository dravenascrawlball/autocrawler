<script lang="ts">
  import { bugReportUrl } from './feedback';
</script>

<a class="bug-report" href={bugReportUrl()} target="_blank" rel="noopener noreferrer" title="Report a bug">
  Report a Bug
</a>

<style>
  .bug-report {
    position: fixed;
    right: 12px;
    bottom: 12px;
    z-index: 500;
    padding: 6px 12px;
    background: var(--bg-inset);
    color: var(--text-muted);
    border: 1px solid var(--panel-border);
    border-radius: 6px;
    box-shadow: var(--shadow);
    font-size: 12px;
    text-decoration: none;
  }

  .bug-report:hover {
    color: var(--text-heading);
  }
</style>
