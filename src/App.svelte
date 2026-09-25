<script lang="ts">
  import TownPhase from './ui/TownPhase.svelte';
  import DungeonPhaseView from './ui/DungeonPhaseView.svelte';
  import BugReportButton from './ui/BugReportButton.svelte';
  import HelpButton from './ui/HelpButton.svelte';
  import HelpOverlay from './ui/HelpOverlay.svelte';
  import { currentView } from './state/view';
  import { helpSeen, markHelpSeen } from './state/helpSeen';
  import './state/autosave';

  let helpOpen = !$helpSeen;

  function closeHelp(): void {
    helpOpen = false;
    markHelpSeen();
  }
</script>

{#if $currentView === 'town'}
  <TownPhase />
{/if}

<DungeonPhaseView />

<BugReportButton />
<HelpButton onClick={() => (helpOpen = true)} />

{#if helpOpen}
  <HelpOverlay onClose={closeHelp} />
{/if}
