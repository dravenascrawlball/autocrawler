<script lang="ts">
  import { floorOf, ROOMS_PER_FLOOR } from '../sim/dungeonRun';
  import { effectiveMaxHp } from '../sim/adventurer';
  import { onDestroy, tick } from 'svelte';
  import { get } from 'svelte/store';
  import Phaser from 'phaser';
  import { currentView } from '../state/view';
  import { dungeonPlayback } from '../state/dungeonPlayback';
  import { continueDungeonRun } from '../state/dungeonOrchestrator';
  import { roster } from '../state/roster';
  import { battleSpeed, type BattleSpeedMultiplier } from '../state/battleSpeed';
  import {
    RoomReplayScene,
    replayCanvasSize,
    type RoomReplaySceneData,
    type ReplayEvent,
    type ReplayUnit,
  } from '../game/RoomReplayScene';
  import { COLORS } from '../game/constants';
  import { ACTION_REGISTRY } from '../data/actions';
  import { SPECIAL_ACTION_REGISTRY } from '../data/specialActions';
  import { outcomeToReplayEvents } from './replayEvents';
  import type { ActionOutcome } from '../sim/action';
  import { RAGE_TRAIT } from '../sim/traits';
  import { hasChargedSpecial } from '../sim/charge';
  import { cutInSetting } from '../state/cutInSetting';
  import { cutIn, cutInEnabled, withKeyMomentCutIns, type CutInEvent } from './cutIns';
  import CutInOverlay from './CutInOverlay.svelte';
  import DungeonPauseView from './DungeonPauseView.svelte';

  const BATTLE_SPEED_OPTIONS: BattleSpeedMultiplier[] = [1, 2, 4];

  let container: HTMLDivElement;
  let game: Phaser.Game | undefined;
  let replayScene: RoomReplayScene | undefined;
  let visible = false;
  let paused = false;
  /** Live playback pause, distinct from `paused` (the between-rooms equip/level-up screen) — resets each room, not persisted. */
  let battlePaused = false;
  /** The portrait cut-in showing over the replay (ui/CutInOverlay.svelte), if any. */
  let cutInCurrent: { key: number; event: CutInEvent; unit: ReplayUnit } | null = null;
  let cutInKey = 0;

  const unsubscribeSpeed = battleSpeed.subscribe((speed) => {
    replayScene?.setSpeedMultiplier(speed);
  });

  function setBattleSpeed(speed: BattleSpeedMultiplier): void {
    battleSpeed.set(speed);
  }

  function toggleBattlePaused(): void {
    battlePaused = !battlePaused;
    replayScene?.setPaused(battlePaused);
  }

  function destroyGame(): void {
    game?.destroy(true);
    game = undefined;
    replayScene = undefined;
  }

  function buildRoomData(onComplete: () => void): RoomReplaySceneData | null {
    const playback = get(dungeonPlayback);
    if (!playback || !playback.currentRecord) {
      return null;
    }
    const record = playback.currentRecord;
    const roomDef = playback.runState.rooms[record.roomIndex];
    const rosterAdventurers = get(roster).adventurers;

    const partyUnits: ReplayUnit[] = record.partyAtRoomStart.map((snapshot) => {
      const adventurer = rosterAdventurers.find((a) => a.id === snapshot.id);
      return {
        id: snapshot.id,
        name: adventurer?.name ?? snapshot.id,
        archetype: adventurer?.archetype ?? '',
        kitArtKey: adventurer?.activeKit?.artKey,
        hp: snapshot.hp,
        maxHp: adventurer ? effectiveMaxHp(adventurer) : snapshot.hp,
        side: 'party',
        position: adventurer?.position ?? { lane: 1, rank: 0 },
        hasRageTrait: adventurer?.traits.some((trait) => trait.id === RAGE_TRAIT.id) ?? false,
        hasChargedSpecial: adventurer ? hasChargedSpecial(adventurer) : false,
      };
    });
    // Rooms are freshly built per run (see /src/data/rooms.ts), so enemies always start this room at full HP.
    const enemyUnits: ReplayUnit[] = roomDef.enemies.map((enemy) => ({
      id: enemy.id,
      name: enemy.name,
      archetype: enemy.archetype,
      hp: enemy.maxHp,
      maxHp: enemy.maxHp,
      side: 'enemy',
      position: enemy.position,
      // Summons (sim/summons.ts) are in the room's list after the fight resolves, but only appear
      // in the replay once they're actually called in.
      hiddenUntilSpawn: enemy.summonedBy !== undefined,
      hasChargedSpecial: hasChargedSpecial(enemy),
    }));

    const cutIns = get(cutInSetting);
    const events: ReplayEvent[] = [];
    const unitNames = new Map<string, string>([...partyUnits, ...enemyUnits].map((unit) => [unit.id, unit.name]));
    const nameOf = (unitId: string, fallback: string) => unitNames.get(unitId) ?? fallback;
    const pushOutcome = (outcome: ActionOutcome, actorId: string, actionName: string) =>
      events.push(...outcomeToReplayEvents(outcome, actorId, actionName, nameOf));


    for (const round of record.result.rounds) {
      for (const roundTurn of round.turns) {
        events.push({
          type: 'roll',
          actorId: roundTurn.unitId,
          actionName: ACTION_REGISTRY[roundTurn.turn.rolledActionId].name,
        });
        for (const event of roundTurn.turn.events) {
          if (event.type === 'action') {
            pushOutcome(event.outcome, roundTurn.unitId, ACTION_REGISTRY[roundTurn.turn.rolledActionId].name);
          } else if (event.type === 'special-action' && event.outcome) {
            const special = SPECIAL_ACTION_REGISTRY[event.specialActionId];
            const specialName = special?.name ?? 'Special';
            if (special && !special.alwaysOn && cutInEnabled(cutIns, 'special')) {
              events.push(cutIn(event.actorId, 'special', 'attack', `${nameOf(event.actorId, '')}: ${specialName}!`));
            }
            pushOutcome(event.outcome, event.actorId, specialName);
          } else if (event.type === 'banish') {
            events.push({ type: 'banish', unitIds: event.unitIds });
          } else if (event.type === 'trait-effect') {
            // Milestone Traits — a Vampiric heal or a Second Wind revive.
            events.push({
              type: 'announce',
              actorId: event.unitId,
              text: event.kind === 'revive' ? `${event.traitName}!` : `${event.traitName} +${event.amount}`,
              color: '#ff88aa',
            });
            events.push({ type: 'heal', actorId: event.unitId, targetId: event.unitId, amount: event.amount });
          } else if (event.type === 'intercept') {
            // A Bodyguard stepped in (adjacency pass) — announce it, then show the share they took.
            if (partyUnits.some((unit) => unit.id === event.guardianId) && cutInEnabled(cutIns, 'save')) {
              events.push(cutIn(event.guardianId, 'save', 'hit', `${nameOf(event.guardianId, '')} takes the hit!`));
            }
            events.push({ type: 'announce', actorId: event.guardianId, text: 'Bodyguard!', color: '#66ccff' });
            events.push({ type: 'attack', actorId: event.attackerId, targetId: event.guardianId, damage: event.damage, hit: true });
          } else if (event.type === 'status-tick') {
            events.push({
              type: 'status-tick',
              targetId: roundTurn.unitId,
              damage: event.damage,
              effectId: event.effectId,
            });
          }
        }
        if (roundTurn.turn.chargeAfter) events.push({ type: 'charge', values: roundTurn.turn.chargeAfter });
      }
    }

    const roomInFloor = (record.roomIndex % ROOMS_PER_FLOOR) + 1;
    const isBossRoom = roomInFloor === ROOMS_PER_FLOOR;
    const roomLabel = `Floor ${floorOf(record.roomIndex)} · ${isBossRoom ? 'Boss' : `Room ${roomInFloor} / ${ROOMS_PER_FLOOR}`}`;

    const units = [...partyUnits, ...enemyUnits];
    const boss = isBossRoom
      ? enemyUnits.filter((unit) => !unit.hiddenUntilSpawn).reduce<ReplayUnit | null>((top, unit) => (!top || unit.maxHp > top.maxHp ? unit : top), null)
      : null;

    return {
      units,
      events: withKeyMomentCutIns(events, units, cutIns),
      roomLabel,
      bossCard: boss && cutInEnabled(cutIns, 'boss') ? cutIn(boss.id, 'boss', 'idle', boss.name) : undefined,
      onCutIn: (event: CutInEvent) => {
        const unit = units.find((candidate) => candidate.id === event.unitId);
        if (unit) cutInCurrent = { key: ++cutInKey, event, unit };
      },
      onComplete,
      speedMultiplier: get(battleSpeed),
      onSceneReady: (scene) => {
        replayScene = scene;
      },
    };
  }

  /** Replays whatever room `dungeonPlayback.currentRecord` currently points at. */
  function playCurrentRoom(): void {
    const data = buildRoomData(onRoomReplayComplete);
    if (!data) {
      destroyGame();
      return;
    }

    destroyGame();
    battlePaused = false;
    const { width, height } = replayCanvasSize(data.units);
    // The container claims the section's full width (see the `.dungeon-canvas` style below); its
    // aspect-ratio is set to match this room's fixed resolution so Phaser's FIT scale mode has a
    // correctly-proportioned box to scale the canvas into, up or down, instead of leaving it at
    // its raw pixel size regardless of how much room the section actually has.
    container.style.aspectRatio = `${width} / ${height}`;
    game = new Phaser.Game({
      type: Phaser.AUTO,
      parent: container,
      backgroundColor: COLORS.background,
      scale: {
        mode: Phaser.Scale.FIT,
        autoCenter: Phaser.Scale.CENTER_BOTH,
        width,
        height,
      },
    });
    // Don't trust this call's return value for the scene instance — see RoomReplaySceneData's
    // onSceneReady doc comment for why; `data.onSceneReady` is what actually sets `replayScene`.
    game.scene.add(RoomReplayScene.KEY, RoomReplayScene, true, data);
  }

  /**
   * Called once the Phaser scene finishes animating the current room. Always
   * pauses here — on a still-ongoing run this is the equip/retreat screen
   * before the next room; on a just-ended run (win, loss, or a forced
   * stalemate retreat) it's where any pending Downed/Level-Up popups get
   * shown before DungeonPauseView's "Return to Town" button actually
   * returns to town (see DungeonPauseView.svelte) — a loss must still surface
   * the Downed popup rather than skipping straight back to town.
   */
  function onRoomReplayComplete(): void {
    destroyGame();
    if (!get(dungeonPlayback)) {
      return;
    }
    paused = true;
  }

  function handleContinue(): void {
    continueDungeonRun();
    paused = false;
    tick().then(() => {
      if (container) {
        playCurrentRoom();
      }
    });
  }

  const unsubscribe = currentView.subscribe((view) => {
    visible = view === 'dungeon';
    if (view === 'dungeon') {
      // A resumed run (see state/dungeonPlayback.ts's resumeFromSave) has no currentRecord to
      // replay — it's already sitting at a Between-Rooms boundary, so land straight there instead
      // of trying to animate a battle that was already fully resolved before the app closed.
      if (get(dungeonPlayback)?.currentRecord === undefined) {
        paused = true;
      } else {
        paused = false;
        // The container <div> only exists once `visible` flips true and Svelte re-renders; wait for that.
        tick().then(() => {
          if (container) {
            playCurrentRoom();
          }
        });
      }
    } else {
      paused = false;
      destroyGame();
    }
  });

  onDestroy(() => {
    unsubscribe();
    unsubscribeSpeed();
    destroyGame();
  });
</script>

{#if visible}
  <section>
    <h1>Dungeon Phase</h1>
    {#if paused}
      <DungeonPauseView onContinue={handleContinue} />
    {:else}
      <div class="battle-controls">
        {#each BATTLE_SPEED_OPTIONS as speed (speed)}
          <button type="button" aria-pressed={$battleSpeed === speed} on:click={() => setBattleSpeed(speed)}>
            {speed}x
          </button>
        {/each}
        <button type="button" aria-pressed={battlePaused} on:click={toggleBattlePaused}>
          {battlePaused ? 'Resume' : 'Pause'}
        </button>
      </div>
      <div class="dungeon-stage">
        <div class="dungeon-canvas" bind:this={container}></div>
        <CutInOverlay bind:current={cutInCurrent} speed={$battleSpeed} />
      </div>
    {/if}
  </section>
{/if}

<style>
  /* The Phaser game itself is created at a fixed pixel resolution (see replayCanvasSize) and
     scaled to fit via Phaser.Scale.FIT — this wrapper claims up to DUNGEON_CANVAS_MAX_WIDTH so
     FIT has real room to scale into, instead of collapsing to the canvas's own intrinsic size and
     leaving the rest of the section empty. Capped (not just 100%) and centered — the native
     resolution is quite narrow/tall (6 lane-columns, 3+ ranks deep), so letting it claim the
     page's full ~1220px width (see app.css) blew it up to an enormous, "zoomed in" size once the
     old fixed-size HUD card strip (which used to share this space) was removed — see
     docs/roadmap.md's Autobattle Revision Cleanup. */
  .dungeon-stage {
    position: relative;
    width: 100%;
    max-width: 640px;
    margin: 0 auto;
    overflow: hidden;
  }

  .dungeon-canvas {
    width: 100%;
  }

  .dungeon-canvas :global(canvas) {
    display: block;
    margin: 0 auto;
  }
</style>
