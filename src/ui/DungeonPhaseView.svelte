<script lang="ts">
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
  import { RAGE_TRAIT } from '../sim/traits';
  import DungeonPauseView from './DungeonPauseView.svelte';

  const BATTLE_SPEED_OPTIONS: BattleSpeedMultiplier[] = [1, 2, 4];

  let container: HTMLDivElement;
  let game: Phaser.Game | undefined;
  let replayScene: RoomReplayScene | undefined;
  let visible = false;
  let paused = false;
  /** Live playback pause, distinct from `paused` (the between-rooms equip/level-up screen) — resets each room, not persisted. */
  let battlePaused = false;

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
        hp: snapshot.hp,
        maxHp: adventurer?.maxHp ?? snapshot.hp,
        side: 'party',
        row: adventurer?.row ?? 'front',
        hasRageTrait: adventurer?.traits.some((trait) => trait.id === RAGE_TRAIT.id) ?? false,
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
      row: enemy.row,
    }));

    const events: ReplayEvent[] = [];
    for (const round of record.result.rounds) {
      for (const roundTurn of round.turns) {
        events.push({
          type: 'roll',
          actorId: roundTurn.unitId,
          actionName: ACTION_REGISTRY[roundTurn.turn.rolledActionId].name,
        });
        for (const event of roundTurn.turn.events) {
          if (event.type === 'action' && event.outcome.type === 'attack') {
            events.push({
              type: 'attack',
              actorId: roundTurn.unitId,
              targetId: event.outcome.targetId,
              damage: event.outcome.damage,
              hit: event.outcome.hit,
            });
          } else if (event.type === 'action' && event.outcome.type === 'attack-multi') {
            // Bodil's Cleave (roadmap item 11) — one 'attack-multi' outcome becomes a plain 'attack'
            // replay event per hit, so RoomReplayScene needs no changes to play each one in sequence.
            for (const hit of event.outcome.hits) {
              events.push({
                type: 'attack',
                actorId: roundTurn.unitId,
                targetId: hit.targetId,
                damage: hit.damage,
                hit: hit.hit,
              });
            }
          } else if (event.type === 'action' && event.outcome.type === 'attack-and-buff') {
            // Glint's Rallying Strike (roadmap item 11) — the attack half plays exactly like a plain
            // 'attack'; the buff half gets its own announcement event (see RoomReplayScene's 'announce').
            events.push({
              type: 'attack',
              actorId: roundTurn.unitId,
              targetId: event.outcome.targetId,
              damage: event.outcome.damage,
              hit: event.outcome.hit,
            });
            events.push({
              type: 'announce',
              actorId: roundTurn.unitId,
              text: `Rally! +${event.outcome.armorAmount} Armor (${event.outcome.durationTurns}t)`,
              color: '#66ccff',
            });
          } else if (event.type === 'action' && event.outcome.type === 'attack-and-gold') {
            // Nerissa's Pickpocket Strike (roadmap item 11) — the attack half plays exactly like a
            // plain 'attack'; a landed hit that also generated gold gets a small announcement too.
            events.push({
              type: 'attack',
              actorId: roundTurn.unitId,
              targetId: event.outcome.targetId,
              damage: event.outcome.damage,
              hit: event.outcome.hit,
            });
            if (event.outcome.goldGenerated > 0) {
              events.push({
                type: 'announce',
                actorId: roundTurn.unitId,
                text: `+${event.outcome.goldGenerated}g!`,
                color: '#ffd700',
              });
            }
          } else if (event.type === 'action' && event.outcome.type === 'attack-and-debuff') {
            // Dravena's Blinding Bolt (roadmap item 11) — the attack half plays exactly like a plain
            // 'attack'; a landed hit that also blinded the target gets an announcement over them.
            events.push({
              type: 'attack',
              actorId: roundTurn.unitId,
              targetId: event.outcome.targetId,
              damage: event.outcome.damage,
              hit: event.outcome.hit,
            });
            if (event.outcome.debuffApplied) {
              events.push({
                type: 'announce',
                actorId: event.outcome.targetId,
                text: `Blind! ${event.outcome.attackPowerPercent}% ATK (${event.outcome.durationTurns}t)`,
                color: '#cc66ff',
              });
            }
          } else if (event.type === 'action' && event.outcome.type === 'support-buff') {
            // Fallacy's Empower / Mira's Potion Toss (Ally) (roadmap items 11/3) — no attack of its
            // own, just an announcement over whichever ally got buffed. Named after whichever action
            // actually fired (rolledActionId), not hardcoded, since this outcome type is shared.
            const outcome = event.outcome;
            const actionName = ACTION_REGISTRY[roundTurn.turn.rolledActionId].name;
            const buffedName = rosterAdventurers.find((a) => a.id === outcome.targetId)?.name ?? 'Ally';
            const statLabel = outcome.stat === 'attackPower' ? 'ATK' : outcome.stat;
            events.push({
              type: 'announce',
              actorId: outcome.targetId,
              text: `${actionName}! ${buffedName} +${outcome.amount}% ${statLabel} (${outcome.durationTurns}t)`,
              color: '#ffcc66',
            });
          } else if (event.type === 'action' && event.outcome.type === 'support-debuff') {
            // Mira's Potion Toss (Enemy) (roadmap item 3) — the debuff counterpart to support-buff
            // above: no attack of its own, an announcement over whichever enemy got debuffed.
            const outcome = event.outcome;
            const actionName = ACTION_REGISTRY[roundTurn.turn.rolledActionId].name;
            const debuffedName = roomDef.enemies.find((e) => e.id === outcome.targetId)?.name ?? 'Enemy';
            const statLabel = outcome.stat === 'attackPower' ? 'ATK' : outcome.stat;
            events.push({
              type: 'announce',
              actorId: outcome.targetId,
              text: `${actionName}! ${debuffedName} ${outcome.amount}% ${statLabel} (${outcome.durationTurns}t)`,
              color: '#cc66ff',
            });
          } else if (event.type === 'action' && event.outcome.type === 'command') {
            // Fallacy's Command (roadmap item 11) — an announcement over her, then the commanded
            // ally's bonus attack plays exactly like a plain 'attack' from them.
            events.push({ type: 'announce', actorId: roundTurn.unitId, text: 'Command!', color: '#ff9966' });
            if (event.outcome.attackOutcome) {
              events.push({
                type: 'attack',
                actorId: event.outcome.commandedAllyId,
                targetId: event.outcome.attackOutcome.targetId,
                damage: event.outcome.attackOutcome.damage,
                hit: event.outcome.attackOutcome.hit,
              });
            }
          } else if (event.type === 'action' && event.outcome.type === 'party-buff') {
            // Tharavel's Inspire (roadmap item 11) — no attack of her own, one announcement over her
            // summarizing the whole-party accuracy + crit buff.
            events.push({
              type: 'announce',
              actorId: roundTurn.unitId,
              text: `Inspire! +${event.outcome.accuracyAmount} ACC / +${event.outcome.critChanceAmount}% Crit (${event.outcome.durationTurns}t)`,
              color: '#ffee88',
            });
          } else if (event.type === 'action' && event.outcome.type === 'fear') {
            // Mirka's Fear (roadmap item 11) — no attack of her own, one announcement over her
            // summarizing the row-wide accuracy debuff (the debuff's own effect, missed enemy
            // attacks, is still visible normally once it's in play).
            events.push({
              type: 'announce',
              actorId: roundTurn.unitId,
              text: `Fear! ${event.outcome.accuracyAmount} ACC (${event.outcome.durationTurns}t)`,
              color: '#cc99ff',
            });
          } else if (event.type === 'action' && event.outcome.type === 'heal') {
            events.push({
              type: 'heal',
              actorId: roundTurn.unitId,
              targetId: event.outcome.targetId,
              amount: event.outcome.amount,
            });
          } else if (event.type === 'action' && event.outcome.type === 'heal-and-charge') {
            // Dawneth's Mending Charge (roadmap item 11) — only plays the heal pulse if it actually
            // healed anyone (amount 0 means nobody needed it this roll); the energy announcement
            // always plays, since the face always fires.
            if (event.outcome.amount > 0) {
              events.push({
                type: 'heal',
                actorId: roundTurn.unitId,
                targetId: event.outcome.targetId,
                amount: event.outcome.amount,
              });
            }
            events.push({
              type: 'announce',
              actorId: roundTurn.unitId,
              text: `+${event.outcome.energyGained} Energy (${event.outcome.totalEnergy})`,
              color: '#88ddaa',
            });
          } else if (event.type === 'status-tick') {
            events.push({
              type: 'status-tick',
              targetId: roundTurn.unitId,
              damage: event.damage,
              effectId: event.effectId,
            });
          }
        }
      }
    }

    const roomLabel = `Room ${record.roomIndex + 1} / ${playback.runState.rooms.length}`;

    return {
      units: [...partyUnits, ...enemyUnits],
      events,
      roomLabel,
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
    const countOf = (side: 'party' | 'enemy', row: 'front' | 'back') =>
      data.units.filter((unit) => unit.side === side && unit.row === row).length;
    const { width, height } = replayCanvasSize(
      countOf('party', 'front'),
      countOf('party', 'back'),
      countOf('enemy', 'front'),
      countOf('enemy', 'back'),
    );
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
      <div class="dungeon-canvas" bind:this={container}></div>
    {/if}
  </section>
{/if}

<style>
  /* The Phaser game itself is created at a fixed pixel resolution (see replayCanvasSize) and
     scaled to fit via Phaser.Scale.FIT — this wrapper just needs to claim the section's full
     width so FIT has real room to scale into, instead of collapsing to the canvas's own intrinsic
     size and leaving the rest of the section empty. */
  .dungeon-canvas {
    width: 100%;
  }

  .dungeon-canvas :global(canvas) {
    display: block;
    margin: 0 auto;
  }
</style>
