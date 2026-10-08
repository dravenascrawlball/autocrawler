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
        position: adventurer?.position ?? { lane: 1, rank: 0 },
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
      position: enemy.position,
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
          } else if (event.type === 'action' && event.outcome.type === 'attack-and-heal-self') {
            // Caladwen's Lifesteal Strike (second-Special pass) — the attack half plays exactly like
            // a plain 'attack'; a landed hit that actually stole HP gets its own heal pulse on her.
            events.push({
              type: 'attack',
              actorId: roundTurn.unitId,
              targetId: event.outcome.targetId,
              damage: event.outcome.damage,
              hit: event.outcome.hit,
            });
            if (event.outcome.healedAmount > 0) {
              events.push({
                type: 'heal',
                actorId: roundTurn.unitId,
                targetId: roundTurn.unitId,
                amount: event.outcome.healedAmount,
              });
            }
          } else if (event.type === 'action' && event.outcome.type === 'support-buff') {
            // Fallacy's Empower / Mira's Potion Toss (Ally) / Bodil's Taunt / Tharavel's Guardian's
            // Ward / Dravena's Vanish (second-Special pass) — no attack of its own, just an
            // announcement over whichever ally got buffed. Named after whichever action actually
            // fired (rolledActionId), not hardcoded, since this outcome type is shared. Taunt/
            // Invulnerability/Stealth are flags encoded as buffs (see actions/support.ts), not
            // numeric stats worth displaying a magnitude for — just announce the effect.
            const outcome = event.outcome;
            const actionName = ACTION_REGISTRY[roundTurn.turn.rolledActionId].name;
            const buffedName = rosterAdventurers.find((a) => a.id === outcome.targetId)?.name ?? 'Ally';
            const statLabel = outcome.stat === 'attackPower' ? 'ATK' : outcome.stat;
            const flagText: Partial<Record<string, string>> = {
              taunt: 'locks enemy targeting',
              invulnerable: 'is Invulnerable',
              stealth: 'Vanishes (untargetable)',
            };
            const text = flagText[outcome.stat]
              ? `${actionName}! ${buffedName} ${flagText[outcome.stat]} (${outcome.durationTurns}t)`
              : `${actionName}! ${buffedName} +${outcome.amount}% ${statLabel} (${outcome.durationTurns}t)`;
            events.push({
              type: 'announce',
              actorId: outcome.targetId,
              text,
              color: '#ffcc66',
            });
          } else if (event.type === 'action' && event.outcome.type === 'support-shield') {
            // Glint's Shield Wall (second-Special pass) — no attack of its own, just an
            // announcement over whoever got shielded. Named after whichever action actually fired,
            // same convention as support-buff, since this outcome type could be shared later too.
            const outcome = event.outcome;
            const actionName = ACTION_REGISTRY[roundTurn.turn.rolledActionId].name;
            const shieldedName = rosterAdventurers.find((a) => a.id === outcome.targetId)?.name ?? 'Ally';
            events.push({
              type: 'announce',
              actorId: outcome.targetId,
              text: `${actionName}! ${shieldedName} +${outcome.amount} Shield (${outcome.durationTurns}t)`,
              color: '#66e0ff',
            });
          } else if (event.type === 'action' && event.outcome.type === 'support-debuff') {
            // Mira's Potion Toss (Enemy) / Isilwen's Mark / Fallacy's Silence / Mirka's Stun
            // (second-Special pass) — the debuff counterpart to support-buff above: no attack of
            // its own, an announcement over whichever enemy got debuffed. Silence/Stun are flags
            // encoded as debuffs, not numeric stats worth displaying a magnitude for.
            const outcome = event.outcome;
            const actionName = ACTION_REGISTRY[roundTurn.turn.rolledActionId].name;
            const debuffedName = roomDef.enemies.find((e) => e.id === outcome.targetId)?.name ?? 'Enemy';
            const statLabel = outcome.stat === 'attackPower' ? 'ATK' : outcome.stat === 'vulnerability' ? 'DMG Taken' : outcome.stat;
            const flagText: Partial<Record<string, string>> = {
              silence: 'is Silenced (Special Actions suppressed)',
              stun: 'is Stunned (skips next turn)',
            };
            // Mark's amount is a positive bonus-damage percent (prefixed with +); Potion Toss
            // Enemy's own debuff amounts are already negative (e.g. -20), so no extra sign needed.
            const text = flagText[outcome.stat]
              ? `${actionName}! ${debuffedName} ${flagText[outcome.stat]} (${outcome.durationTurns}t)`
              : `${actionName}! ${debuffedName} ${outcome.stat === 'vulnerability' ? '+' : ''}${outcome.amount}% ${statLabel} (${outcome.durationTurns}t)`;
            events.push({
              type: 'announce',
              actorId: outcome.targetId,
              text,
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
            // summarizing the whole-party crit buff (consolidated from a separate accuracy + crit
            // pair once Accuracy was removed as a baseline stat — see docs/roadmap.md).
            events.push({
              type: 'announce',
              actorId: roundTurn.unitId,
              text: `Inspire! +${event.outcome.critChanceAmount}% Crit (${event.outcome.durationTurns}t)`,
              color: '#ffee88',
            });
          } else if (event.type === 'action' && event.outcome.type === 'fear') {
            // Mirka's Fear (roadmap item 11) — no attack of her own, one announcement over her
            // summarizing the row-wide vulnerability debuff (reframed from an accuracy debuff once
            // Accuracy/Evasion were removed — the debuff's own effect, extra damage taken, is still
            // visible normally once it's in play).
            events.push({
              type: 'announce',
              actorId: roundTurn.unitId,
              text: `Fear! +${event.outcome.vulnerabilityAmount}% DMG Taken (${event.outcome.durationTurns}t)`,
              color: '#cc99ff',
            });
          } else if (event.type === 'action' && event.outcome.type === 'attack-with-execute') {
            // Drifta's Execute Strike (second-Special pass) — the hit half plays exactly like a
            // plain 'attack'; a finishing blow gets its own callout over the target.
            events.push({
              type: 'attack',
              actorId: roundTurn.unitId,
              targetId: event.outcome.targetId,
              damage: event.outcome.damage,
              hit: event.outcome.hit,
            });
            if (event.outcome.executed) {
              events.push({ type: 'announce', actorId: event.outcome.targetId, text: 'Executed!', color: '#ff4444' });
            }
          } else if (event.type === 'action' && event.outcome.type === 'cleanse') {
            // Dawneth's Cleanse (second-Special pass) — no attack of her own; only announces when it
            // actually cleared something (always resolves, same as Mending Charge, but a no-op
            // cleanse is silent rather than cluttering the log).
            if (event.outcome.clearedEffectIds.length > 0) {
              events.push({
                type: 'announce',
                actorId: event.outcome.targetId,
                text: `Cleanse! ${event.outcome.clearedEffectIds.join(', ')} removed`,
                color: '#88ddaa',
              });
            }
          } else if (event.type === 'action' && event.outcome.type === 'revive') {
            // Mira's Revive (second-Special pass) — no attack of her own; always announces (never an
            // idle no-op the way Cleanse can be, since selectTarget already gates on someone being
            // Downed before this ever resolves).
            events.push({
              type: 'announce',
              actorId: event.outcome.targetId,
              text: `Revive! +${event.outcome.amount} HP`,
              color: '#ffee88',
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
      <div class="dungeon-canvas" bind:this={container}></div>
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
  .dungeon-canvas {
    width: 100%;
    max-width: 640px;
    margin: 0 auto;
  }

  .dungeon-canvas :global(canvas) {
    display: block;
    margin: 0 auto;
  }
</style>
