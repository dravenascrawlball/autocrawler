import Phaser from 'phaser';
import type { Row } from '../sim/formation';
import type { StatusEffectId } from '../sim/statusEffects';
import { rageDamageBonusFraction } from '../sim/traits';
import { COLORS } from './constants';

/**
 * A portrait's current mood, driven by combat events (see playAttack/
 * playHeal below). Textures are looked up as `portrait:<archetype
 * lowercased>:<state>`, loaded from `/portraits/<archetype>-<state>.png`
 * — any state missing for a given archetype falls back to that
 * archetype's `idle` texture, and if even that's missing, the card shows
 * a plain colored circle instead (see createCard). Nothing crashes or
 * looks broken before real art exists; it just looks like it does today.
 */
export type PortraitState = 'idle' | 'attack' | 'hit' | 'cast' | 'healed' | 'downed' | 'dodge';
const PORTRAIT_STATES: PortraitState[] = ['idle', 'attack', 'hit', 'cast', 'healed', 'downed', 'dodge'];

export interface ReplayUnit {
  id: string;
  name: string;
  /** Archetype template name (e.g. "Fighter", "Grunt") — see sim/adventurer.ts's `archetype` field. Used for portrait lookup. */
  archetype: string;
  /** HP at the start of this room's replay. */
  hp: number;
  maxHp: number;
  side: 'party' | 'enemy';
  /** Front/back formation row — see sim/formation.ts. Fixed for the whole room replay; no in-combat repositioning exists (yet). */
  row: Row;
  /** Whether this unit has RAGE_TRAIT (see sim/traits.ts) — shows a live "Raging +N%" readout on the HUD card, recomputed as HP changes during the replay. */
  hasRageTrait?: boolean;
}

export type ReplayEvent =
  | { type: 'attack'; actorId: string; targetId: string; damage: number; hit: boolean }
  | { type: 'heal'; actorId: string; targetId: string; amount: number }
  /** A status effect (e.g. Burn, Poison) dealing its per-turn damage — see sim/statusEffects.ts. No actor: it's self-inflicted, not landed by another unit's turn. */
  | { type: 'status-tick'; targetId: string; damage: number; effectId: StatusEffectId }
  /** The die roll that decided this turn's action (see sim/turnEngine.ts's rolledActionId) — played before that turn's other event(s). */
  | { type: 'roll'; actorId: string; actionName: string }
  /**
   * A one-shot floating announcement over `actorId`'s card — not a
   * persistent per-ally readout (a buff's own effect, e.g. mitigated
   * damage, still shows up in future hits normally). Used by Glint's
   * Rallying Strike, Fallacy's Empower, and Fallacy's Command
   * (roadmap item 11) to narrate a support effect that has no attack/heal
   * animation of its own to piggyback on.
   */
  | { type: 'announce'; actorId: string; text: string; color: string };

export interface RoomReplaySceneData {
  units: ReplayUnit[];
  events: ReplayEvent[];
  /** e.g. "Room 2 / 5" — shown on the intro title card. */
  roomLabel: string;
  onComplete: () => void;
  /** Playback speed to start at (see state/battleSpeed.ts) — 1 if omitted. Live-adjustable after via setSpeedMultiplier. */
  speedMultiplier?: number;
  /**
   * Called from `init()` with `this` scene instance. `game.scene.add(...)`'s own return value
   * can't be trusted for this: immediately after `new Phaser.Game(...)`, the SceneManager isn't
   * booted yet (it boots once the Game's async texture setup fires its own READY event), so
   * `add()` queues the scene and returns null instead of the instance. `init()` always runs once
   * the scene actually initializes, whenever that ends up being, so it's used as the handoff
   * point instead.
   */
  onSceneReady?: (scene: RoomReplayScene) => void;
}

// Lane layout (static front/back formation view, between the two HUD strips — see formation.ts).
// Four columns left-to-right: party back, party front, enemy front, enemy back — the two front
// rows meet in the middle (where the actual fighting reads as happening), backs sit outside them.
const CELL_SIZE = 80;
/** Native dimensions of a body sprite PNG — anchored at feet, scaled to CELL_SIZE wide. */
const BODY_SPRITE_WIDTH = 64;
const BODY_SPRITE_HEIGHT = 96;
const LANE_SIDE_PADDING = 40;
const LANE_COLUMN_COUNT = 4;
/**
 * Extra headroom above the top row: a body sprite is anchored at its feet (lane-cell center) and
 * extends upward by its full display height, so the top row needs more clearance above it than
 * LANE_SIDE_PADDING alone gives, or heads get clipped by the canvas edge. Sized for the tallest
 * sprite (CELL_SIZE * BODY_SPRITE_HEIGHT/BODY_SPRITE_WIDTH) above its cell's vertical center, plus
 * a small buffer.
 */
const LANE_TOP_PADDING = Math.ceil(CELL_SIZE * (BODY_SPRITE_HEIGHT / BODY_SPRITE_WIDTH) - CELL_SIZE / 2 + 10);
/**
 * Fixed headroom reserved above the lane rows, on top of LANE_TOP_PADDING's own (much smaller)
 * sprite-clipping margin — guarantees every room's formation sits low enough to read as standing
 * on the backdrop's stone floor rather than up in the archway, even a minimal 1v1 room where the
 * HUD cards alone wouldn't force the canvas tall enough to push it down on their own (see
 * replayCanvasSize, which folds this into its own height floor so the two stay in sync). Also
 * doubles as open space for a future "who rolled what" readout above the fight.
 */
const LANE_FLOOR_MARGIN = 180;
/** Extra downward push applied to whatever additional vertical room the canvas has beyond LANE_FLOOR_MARGIN's guaranteed minimum (e.g. a tall HUD card stack) — 0 would leave that extra room centered above the margin, 1 would push it all the way into the margin. */
const LANE_VERTICAL_BIAS_FRACTION = 0.7;
const DOWNED_ALPHA = 0.3;

// HUD card layout (fixed strips: party left, enemy right — HP/status live here, not on the grid).
// Cards are a vertical stack (portrait on top, text rows below) so the portrait can be big and
// portrait-scaled rather than a small square — source art is authored at 720x1080 (2:3), the same
// ratio used here, so it also works unscaled in a future full-size gallery view.
const PORTRAIT_ASPECT = 1080 / 720;
const PORTRAIT_WIDTH = 120;
const PORTRAIT_HEIGHT = PORTRAIT_WIDTH * PORTRAIT_ASPECT;
const CARD_WIDTH = PORTRAIT_WIDTH + 16;
const PORTRAIT_TOP_PADDING = 8;
const ROW_GAP = 4;
const NAME_ROW_HEIGHT = 16;
const HP_TEXT_ROW_HEIGHT = 14;
const HP_BAR_HEIGHT = 7;
const STATUS_ROW_HEIGHT = 14;
/** Reserved unconditionally (like STATUS_ROW_HEIGHT) so a card's layout doesn't shift depending on whether this unit has RAGE_TRAIT — only populated with text for units that do. */
const RAGE_ROW_HEIGHT = 14;
const CARD_BOTTOM_PADDING = 8;
const CARD_HEIGHT =
  PORTRAIT_TOP_PADDING +
  PORTRAIT_HEIGHT +
  ROW_GAP +
  NAME_ROW_HEIGHT +
  ROW_GAP +
  HP_TEXT_ROW_HEIGHT +
  ROW_GAP +
  HP_BAR_HEIGHT +
  ROW_GAP +
  STATUS_ROW_HEIGHT +
  ROW_GAP +
  RAGE_ROW_HEIGHT +
  CARD_BOTTOM_PADDING;
const CARD_GAP = 8;
const CARD_MARGIN = 12;
/** Each side's cards form a 2-column grid (rather than one tall column) so a full 4-member party fits in 2 rows. */
const CARDS_PER_ROW = 2;
const HUD_STRIP_WIDTH = CARD_MARGIN * 2 + CARDS_PER_ROW * CARD_WIDTH + (CARDS_PER_ROW - 1) * CARD_GAP;
const HP_BAR_WIDTH = 110;

const INTRO_HOLD_MS = 700;
const INTRO_FADE_MS = 400;
/** How long an attack/hit/cast/healed portrait shows before reverting to idle. Downed never reverts. */
const REACTION_HOLD_MS = 500;

// Impact juice: a brief pause at the peak of a landed attack's lunge (via the tween's own `hold`,
// not a global timeScale freeze — keeps this consistent with the rest of the file's `scaled()`
// convention instead of introducing a second, competing way to slow down time) plus a camera
// shake, both scaled up for a killing blow so it reads as more significant than a regular hit.
const HIT_HOLD_MS = 90;
const LETHAL_HIT_HOLD_MS = 220;
const SHAKE_DURATION_MS = 140;
const SHAKE_INTENSITY = 0.006;
const LETHAL_SHAKE_DURATION_MS = 260;
const LETHAL_SHAKE_INTENSITY = 0.014;

// Death: the grid sprite topples away from the fight (party falls toward its own back line, enemy
// mirrored) rather than just fading in place.
const DEATH_FALL_ANGLE_DEG = 75;
const DEATH_FALL_DURATION_MS = 420;

// Die-roll animation (roadmap item 7 Phase 5) — a small badge on the acting unit's HUD card that
// tumbles through random faces before settling on the action that actually fired.
const DIE_SIZE = 26;
/** Badge center, relative to the card's own center — top-right corner, just inside the card edge. */
const DIE_OFFSET_X = CARD_WIDTH / 2 - DIE_SIZE / 2 - 4;
const DIE_OFFSET_Y = -CARD_HEIGHT / 2 + DIE_SIZE / 2 + 4;
const DIE_TUMBLE_STEPS = 5;
const DIE_TUMBLE_STEP_MS = 70;
const DIE_SETTLE_HOLD_MS = 350;
const DIE_FADE_MS = 200;

/**
 * Roll banner — a big "Name rolled Action!" readout centered in the headroom LANE_FLOOR_MARGIN
 * reserves above the formation, replacing the old small floating label that used to appear over
 * just the acting unit's card. The die badge itself still tumbles on the card as the "who's
 * acting" cue; this is the "what did they roll" half, made legible at a glance instead of easy to
 * miss in the middle of a fight.
 */
const ROLL_BANNER_FONT_SIZE = 22;
const ROLL_BANNER_FADE_MS = 220;
const ROLL_BANNER_HOLD_MS = 450;

/** Canvas size that fits the 4-lane formation view (sized to whichever row has the most members) plus both HUD strips (sized to the larger side's roster). */
export function replayCanvasSize(
  partyFrontCount: number,
  partyBackCount: number,
  enemyFrontCount: number,
  enemyBackCount: number,
): { width: number; height: number } {
  const laneAreaWidth = LANE_SIDE_PADDING * 2 + LANE_COLUMN_COUNT * CELL_SIZE;
  const maxLaneRows = Math.max(partyFrontCount, partyBackCount, enemyFrontCount, enemyBackCount, 1);
  // Includes LANE_FLOOR_MARGIN so the canvas is always tall enough for create() to ground the
  // formation on the floor without having to borrow room from the HUD cards' own height — see that
  // constant's doc comment. Must stay in sync with create()'s own identical laneContentHeight calc.
  const laneAreaHeight = LANE_FLOOR_MARGIN + LANE_TOP_PADDING + LANE_SIDE_PADDING + maxLaneRows * CELL_SIZE;

  const partyCount = partyFrontCount + partyBackCount;
  const enemyCount = enemyFrontCount + enemyBackCount;
  const maxCards = Math.max(partyCount, enemyCount, 1);
  const maxCardRows = Math.ceil(maxCards / CARDS_PER_ROW);
  const cardsHeight = CARD_MARGIN * 2 + maxCardRows * CARD_HEIGHT + (maxCardRows - 1) * CARD_GAP;

  return {
    width: HUD_STRIP_WIDTH * 2 + laneAreaWidth,
    height: Math.max(cardsHeight, laneAreaHeight),
  };
}

/** Converts a Phaser numeric color (e.g. COLORS.attackFlash) to a CSS hex string for use in a Text object's style. */
function colorToCss(color: number): string {
  return `#${color.toString(16).padStart(6, '0')}`;
}

/** Lowercases and replaces spaces with underscores (e.g. "Kobold Skirmisher" -> "kobold_skirmisher") so a multi-word archetype name still resolves to a valid asset filename. Mirrors ui/portraits.ts's own copy. */
function slugifyArchetype(archetype: string): string {
  return archetype.toLowerCase().replace(/\s+/g, '_');
}

function portraitTextureKey(archetype: string, state: PortraitState): string {
  return `portrait:${slugifyArchetype(archetype)}:${state}`;
}

function portraitAssetPath(archetype: string, state: PortraitState): string {
  return `/portraits/${slugifyArchetype(archetype)}-${state}.png`;
}

/**
 * Grid body sprite for a unit — a static 64x96 image per archetype (see
 * public/sprites/), keyed separately from portraits since they're a
 * different asset. Every archetype/monster is expected to have a real file
 * in place (a copy of default_adventurer.png/default_monster.png as a
 * stand-in until real art exists) — unlike portraits, there's no
 * missing-file fallback here.
 */
function bodyTextureKey(archetype: string): string {
  return `body:${slugifyArchetype(archetype)}`;
}

function bodyAssetPath(side: 'party' | 'enemy', archetype: string): string {
  const folder = side === 'party' ? 'adventurers' : 'monsters';
  return `/sprites/${folder}/${slugifyArchetype(archetype)}.png`;
}

/** Single shared backdrop behind the whole replay canvas (HUD strips and lane view alike) — not per-archetype, since it's the room's environment, not a unit's own art. Missing file (no art yet) just leaves Phaser's own flat `backgroundColor` showing, same graceful-degradation convention as portraits/sprites. */
const BACKGROUND_TEXTURE_KEY = 'background:dungeon-room';
const BACKGROUND_ASSET_PATH = '/backgrounds/dungeon-room.png';

/**
 * Replays one room's flattened action log: a spatial grid view in the
 * middle (units at their real grid positions, sliding on `move` events)
 * flanked by two fixed HUD strips (party left, enemy right) carrying each
 * unit's portrait, name, HP bar, and status — attacks/heals pulse the
 * relevant portraits' mood (see PortraitState) and update HP on the card,
 * not on the grid. Opens with a brief fade-in "Room N / total" title
 * card, then calls `onComplete` once every event has played.
 */
export class RoomReplayScene extends Phaser.Scene {
  static readonly KEY = 'RoomReplayScene';

  private sceneData!: RoomReplaySceneData;
  private gridContainers = new Map<string, Phaser.GameObjects.Container>();
  private gridSprites = new Map<string, Phaser.GameObjects.Image>();
  private cardPortraits = new Map<string, Phaser.GameObjects.Image | Phaser.GameObjects.Arc>();
  private cardHealthBars = new Map<string, Phaser.GameObjects.Rectangle>();
  private cardHpTexts = new Map<string, Phaser.GameObjects.Text>();
  private cardRageTexts = new Map<string, Phaser.GameObjects.Text>();
  private cardPositions = new Map<string, { x: number; y: number }>();
  private currentHp = new Map<string, number>();
  private speedMultiplier = 1;
  private desiredPaused = false;
  /** Extra vertical offset applied to lane positions when the canvas is taller than the lane area needs — see create()'s comment. */
  private laneVerticalOffset = 0;

  constructor() {
    super(RoomReplayScene.KEY);
  }

  init(data: RoomReplaySceneData): void {
    this.sceneData = data;
    data.onSceneReady?.(this);
    this.gridContainers.clear();
    this.gridSprites.clear();
    this.cardPortraits.clear();
    this.cardHealthBars.clear();
    this.cardHpTexts.clear();
    this.cardRageTexts.clear();
    this.cardPositions.clear();
    this.currentHp.clear();
    this.speedMultiplier = data.speedMultiplier ?? 1;
    this.desiredPaused = false;
    for (const unit of data.units) {
      this.currentHp.set(unit.id, unit.hp);
    }
    // Status only actually becomes RUNNING right before this fires (see applyDesiredPausedState's
    // doc comment) — this is what makes a Pause request made during LOADING/CREATING stick.
    this.events.once(Phaser.Scenes.Events.CREATE, () => this.applyDesiredPausedState());
  }

  /** Live playback speed change — takes effect on the next tween/delay scheduled (already-running ones finish at their original speed). */
  setSpeedMultiplier(multiplier: number): void {
    this.speedMultiplier = multiplier;
  }

  /**
   * Pauses/resumes the whole scene (tweens and timers included) via Phaser's own scene pause.
   * `Scene.pause()`/`resume()` silently no-op (only a console.warn) if the scene isn't RUNNING at
   * the moment the queued op is processed — no retry. A request made while still LOADING/CREATING
   * (e.g. clicking Pause right as a new room starts, during preload) would otherwise be dropped
   * and never applied. `applyDesiredPausedState` re-checks once `create()` finishes, so an early
   * request still takes effect the instant the scene actually starts running.
   */
  setPaused(paused: boolean): void {
    this.desiredPaused = paused;
    this.applyDesiredPausedState();
  }

  private applyDesiredPausedState(): void {
    const status = this.sys.settings.status;
    if (status !== Phaser.Scenes.RUNNING && status !== Phaser.Scenes.PAUSED) {
      return; // not running yet — create() calls this again once it is
    }
    if (this.desiredPaused) {
      this.scene.pause();
    } else {
      this.scene.resume();
    }
  }

  /** Scales a duration/delay (ms) by the current playback speed — higher speed means shorter waits. */
  private scaled(durationMs: number): number {
    return durationMs / this.speedMultiplier;
  }

  preload(): void {
    this.load.image(BACKGROUND_TEXTURE_KEY, BACKGROUND_ASSET_PATH);

    const archetypes = new Set(this.sceneData.units.map((unit) => unit.archetype));
    for (const archetype of archetypes) {
      for (const state of PORTRAIT_STATES) {
        this.load.image(portraitTextureKey(archetype, state), portraitAssetPath(archetype, state));
      }
    }
    // Missing files 404 individually via Phaser's own error handling — expected until portrait art
    // exists for a given archetype/state; textures.exists() below is how callers detect that.

    const bodySeen = new Set<string>();
    for (const unit of this.sceneData.units) {
      const key = bodyTextureKey(unit.archetype);
      if (bodySeen.has(key)) continue;
      bodySeen.add(key);
      this.load.image(key, bodyAssetPath(unit.side, unit.archetype));
    }
  }

  create(): void {
    const { width, height } = this.scale;

    this.createBackground(width, height);

    const partyUnits = this.sceneData.units.filter((unit) => unit.side === 'party');
    const enemyUnits = this.sceneData.units.filter((unit) => unit.side === 'enemy');
    partyUnits.forEach((unit, index) =>
      this.createCard(unit, this.cardX(0, index % CARDS_PER_ROW), this.cardY(Math.floor(index / CARDS_PER_ROW))),
    );
    enemyUnits.forEach((unit, index) =>
      this.createCard(
        unit,
        this.cardX(width - HUD_STRIP_WIDTH, index % CARDS_PER_ROW),
        this.cardY(Math.floor(index / CARDS_PER_ROW)),
      ),
    );

    // Column order left-to-right: party back, party front, enemy front, enemy back — the two
    // front rows meet in the middle, backs sit outside them (see the layout comment above).
    const lanes: { units: ReplayUnit[]; column: number }[] = [
      { units: partyUnits.filter((u) => u.row === 'back'), column: 0 },
      { units: partyUnits.filter((u) => u.row === 'front'), column: 1 },
      { units: enemyUnits.filter((u) => u.row === 'front'), column: 2 },
      { units: enemyUnits.filter((u) => u.row === 'back'), column: 3 },
    ];
    // The canvas's actual height is often taller than the lane area alone needs (it's sized to fit
    // whichever side has more HUD cards — see replayCanvasSize) — without this, units stay pinned
    // to their top-padding offset and end up looking stranded near the top of a tall background
    // instead of sitting mid-scene. Centers the lane block's natural height (mirrors
    // replayCanvasSize's own laneAreaHeight formula) in whatever extra vertical room the canvas has.
    const maxLaneRows = Math.max(...lanes.map((lane) => lane.units.length), 1);
    // Must match replayCanvasSize's own laneAreaHeight formula — see LANE_FLOOR_MARGIN's doc
    // comment for why the canvas is guaranteed at least this tall.
    const laneContentHeight = LANE_FLOOR_MARGIN + LANE_TOP_PADDING + LANE_SIDE_PADDING + maxLaneRows * CELL_SIZE;
    // LANE_FLOOR_MARGIN alone already grounds the formation even in the smallest room; any extra
    // room the canvas has beyond that (e.g. a tall HUD card stack) pushes it down further still,
    // rather than sitting centered in that extra space.
    this.laneVerticalOffset = LANE_FLOOR_MARGIN + Math.max(0, height - laneContentHeight) * LANE_VERTICAL_BIAS_FRACTION;

    this.drawLaneDivider(maxLaneRows);

    for (const lane of lanes) {
      // Centers a lane with fewer occupants than the tallest lane within that shared row span
      // (e.g. 3 in front, 1 in back -> the lone back-row unit sits at the middle row, not pinned
      // to the top) rather than every lane top-aligning independently.
      const rowOffset = (maxLaneRows - lane.units.length) / 2;
      lane.units.forEach((unit, index) => {
        const pos = this.laneScreenPosition(lane.column, index + rowOffset);
        this.createGridUnit(unit, pos.x, pos.y);
      });
    }

    this.playIntro();
  }

  /**
   * Fills the whole canvas with the shared dungeon backdrop, if its art exists — a no-op leaving
   * Phaser's flat `backgroundColor` visible otherwise. Drawn first so every other object (cards,
   * lane divider, grid units) paints on top of it. Scaled to cover (like CSS `object-fit: cover`)
   * rather than stretched: the canvas's width is fixed but its height varies with room size
   * (~290-560px), so a uniform scale-and-crop keeps the source art's own proportions correct in
   * every room instead of squashing/stretching it differently each time. Overflow past the canvas
   * edge is simply never rendered — Phaser doesn't draw outside the canvas bounds — so no mask is
   * needed.
   */
  private createBackground(width: number, height: number): void {
    if (!this.textures.exists(BACKGROUND_TEXTURE_KEY)) {
      return;
    }
    const image = this.add.image(width / 2, height / 2, BACKGROUND_TEXTURE_KEY).setOrigin(0.5, 0.5);
    const scale = Math.max(width / image.width, height / image.height);
    image.setScale(scale);
  }

  /** Card center x within a strip starting at `stripLeft` (0 for the party strip, `width - HUD_STRIP_WIDTH` for the enemy strip). */
  private cardX(stripLeft: number, col: number): number {
    return stripLeft + CARD_MARGIN + CARD_WIDTH / 2 + col * (CARD_WIDTH + CARD_GAP);
  }

  private cardY(row: number): number {
    return CARD_MARGIN + CARD_HEIGHT / 2 + row * (CARD_HEIGHT + CARD_GAP);
  }

  /** A single vertical line between the two front columns — the only visual cue for "this is where the fighting happens." Spans just the actual lane rows (offset the same way as the units themselves) rather than stretching to the canvas edges, which would otherwise dangle past a vertically-centered formation. */
  private drawLaneDivider(maxLaneRows: number): void {
    const x = HUD_STRIP_WIDTH + LANE_SIDE_PADDING + 2 * CELL_SIZE;
    const top = this.laneVerticalOffset + LANE_TOP_PADDING;
    const bottom = top + maxLaneRows * CELL_SIZE;
    const graphics = this.add.graphics();
    graphics.lineStyle(1, COLORS.gridLine, 1);
    graphics.lineBetween(x, top, x, bottom);
  }

  /** Screen position for the `index`-th unit (top to bottom, can be fractional — see create()'s rowOffset) in lane `column` (0-3, see the create() comment). */
  private laneScreenPosition(column: number, index: number): { x: number; y: number } {
    return {
      x: HUD_STRIP_WIDTH + LANE_SIDE_PADDING + column * CELL_SIZE + CELL_SIZE / 2,
      y: this.laneVerticalOffset + LANE_TOP_PADDING + index * CELL_SIZE + CELL_SIZE / 2,
    };
  }

  /** A body sprite in its formation lane, anchored at the feet (cell center) — no name/health bar here, both live on the HUD card. Faces toward the opposing side: party faces right, enemy faces left (sprites are drawn facing right by convention). */
  private createGridUnit(unit: ReplayUnit, x: number, y: number): void {
    const displayHeight = CELL_SIZE * (BODY_SPRITE_HEIGHT / BODY_SPRITE_WIDTH);
    const sprite = this.add
      .image(0, 0, bodyTextureKey(unit.archetype))
      .setOrigin(0.5, 1)
      .setDisplaySize(CELL_SIZE, displayHeight)
      .setFlipX(unit.side === 'enemy');
    const container = this.add.container(x, y, [sprite]);
    this.gridContainers.set(unit.id, container);
    this.gridSprites.set(unit.id, sprite);
  }

  /** Resolves the best available portrait texture key for `state`, falling back to `idle`, or null if neither exists. */
  private resolvePortraitTextureKey(archetype: string, state: PortraitState): string | null {
    const key = portraitTextureKey(archetype, state);
    if (this.textures.exists(key)) return key;
    const idleKey = portraitTextureKey(archetype, 'idle');
    return this.textures.exists(idleKey) ? idleKey : null;
  }

  /** Vertical stack from the card's top edge: portrait, name, HP text, HP bar, status — see the layout constants above. */
  private createCard(unit: ReplayUnit, x: number, y: number): void {
    this.cardPositions.set(unit.id, { x, y });
    const color = unit.side === 'party' ? COLORS.attacker : COLORS.target;
    const top = -CARD_HEIGHT / 2;
    let cursor = top;

    // Near-opaque rather than the semi-transparent look this used to have — over the dungeon
    // backdrop art, a lightly-tinted box read as hard to skim at a glance.
    const cardBg = this.add.rectangle(0, 0, CARD_WIDTH, CARD_HEIGHT, COLORS.background, 0.92);
    cardBg.setStrokeStyle(1, COLORS.gridLine);

    cursor += PORTRAIT_TOP_PADDING;
    const portraitY = cursor + PORTRAIT_HEIGHT / 2;
    const initialKey = this.resolvePortraitTextureKey(unit.archetype, 'idle');
    const portrait: Phaser.GameObjects.Image | Phaser.GameObjects.Arc = initialKey
      ? this.add.image(0, portraitY, initialKey).setDisplaySize(PORTRAIT_WIDTH, PORTRAIT_HEIGHT)
      : this.add.circle(0, portraitY, PORTRAIT_WIDTH / 2, color);
    this.cardPortraits.set(unit.id, portrait);
    cursor += PORTRAIT_HEIGHT + ROW_GAP;

    const nameText = this.add
      .text(0, cursor + NAME_ROW_HEIGHT / 2, unit.name, { fontSize: '13px', color: '#ffffff' })
      .setOrigin(0.5, 0.5);
    cursor += NAME_ROW_HEIGHT + ROW_GAP;

    const hpText = this.add
      .text(0, cursor + HP_TEXT_ROW_HEIGHT / 2, `${unit.hp}/${unit.maxHp}`, { fontSize: '11px', color: '#cccccc' })
      .setOrigin(0.5, 0.5);
    this.cardHpTexts.set(unit.id, hpText);
    cursor += HP_TEXT_ROW_HEIGHT + ROW_GAP;

    const barY = cursor + HP_BAR_HEIGHT / 2;
    const healthBarBg = this.add.rectangle(0, barY, HP_BAR_WIDTH, HP_BAR_HEIGHT, COLORS.healthBarBack);
    const healthBarFill = this.add
      .rectangle(0, barY, HP_BAR_WIDTH * (unit.hp / unit.maxHp), HP_BAR_HEIGHT, COLORS.healthBarFill)
      .setOrigin(0, 0.5);
    healthBarFill.x = -HP_BAR_WIDTH / 2;
    this.cardHealthBars.set(unit.id, healthBarFill);
    cursor += HP_BAR_HEIGHT + ROW_GAP;

    const children: Phaser.GameObjects.GameObject[] = [cardBg, portrait, nameText, hpText, healthBarBg, healthBarFill];

    // STATUS_ROW_HEIGHT's vertical space stays reserved (unused now that Adventurer.status is gone,
    // roadmap: roguelite draft rework) so RAGE_ROW_HEIGHT below doesn't need a layout re-derivation.
    cursor += STATUS_ROW_HEIGHT + ROW_GAP;

    if (unit.hasRageTrait) {
      const rageText = this.add
        .text(0, cursor + RAGE_ROW_HEIGHT / 2, this.rageLabel(unit.hp, unit.maxHp), {
          fontSize: '10px',
          color: '#ff6666',
        })
        .setOrigin(0.5, 0.5);
      this.cardRageTexts.set(unit.id, rageText);
      children.push(rageText);
    }

    this.add.container(x, y, children);
  }

  /** "Raging +N%" once the bonus is non-zero, blank at full HP — see traits.ts's RAGE_TRAIT. */
  private rageLabel(hp: number, maxHp: number): string {
    const bonusPercent = Math.round(rageDamageBonusFraction(hp, maxHp) * 100);
    return bonusPercent > 0 ? `Raging +${bonusPercent}%` : '';
  }

  /** Sets a card's portrait to `state`'s texture (falling back to idle, or leaving a circle-fallback portrait untouched). */
  private setPortraitState(unitId: string, state: PortraitState): void {
    const unit = this.sceneData.units.find((u) => u.id === unitId);
    const portrait = this.cardPortraits.get(unitId);
    if (!unit || !portrait || !(portrait instanceof Phaser.GameObjects.Image)) {
      return; // no portrait art at all for this archetype — nothing to swap, the circle fallback just sits still
    }

    const key = this.resolvePortraitTextureKey(unit.archetype, state);
    if (key) {
      portrait.setTexture(key);
    }
  }

  /** Shows `state` on the portrait, then reverts to idle after REACTION_HOLD_MS — used for every state except 'downed', which persists. */
  private pulsePortrait(unitId: string, state: PortraitState): void {
    this.setPortraitState(unitId, state);
    this.time.delayedCall(this.scaled(REACTION_HOLD_MS), () => this.setPortraitState(unitId, 'idle'));
  }

  /** Fades in a "Room N / total" title card over the (already-visible) units, holds briefly, then starts the event log. */
  private playIntro(): void {
    const { width, height } = this.scale;
    const overlay = this.add.rectangle(width / 2, height / 2, width, height, 0x000000, 1);
    const label = this.add
      .text(width / 2, height / 2, this.sceneData.roomLabel, { fontSize: '20px', color: '#ffffff' })
      .setOrigin(0.5, 0.5);

    this.time.delayedCall(this.scaled(INTRO_HOLD_MS), () => {
      this.tweens.add({
        targets: [overlay, label],
        alpha: 0,
        duration: this.scaled(INTRO_FADE_MS),
        onComplete: () => {
          overlay.destroy();
          label.destroy();
          this.playEvent(0);
        },
      });
    });
  }

  private playEvent(index: number): void {
    const event = this.sceneData.events[index];
    if (!event) {
      this.time.delayedCall(this.scaled(300), () => this.sceneData.onComplete());
      return;
    }

    const next = () => this.playEvent(index + 1);

    if (event.type === 'roll') {
      this.playRoll(event.actorId, event.actionName, next);
      return;
    }
    if (event.type === 'attack') {
      this.playAttack(event.actorId, event.targetId, event.damage, event.hit, next);
      return;
    }
    if (event.type === 'status-tick') {
      this.playStatusTick(event.targetId, event.damage, event.effectId, next);
      return;
    }
    if (event.type === 'announce') {
      this.playAnnounce(event.actorId, event.text, event.color, next);
      return;
    }
    this.playHeal(event.actorId, event.targetId, event.amount, next);
  }

  /** Floats a one-shot text announcement over `actorId`'s card — see the 'announce' ReplayEvent doc comment for what uses this. */
  private playAnnounce(actorId: string, text: string, color: string, onDone: () => void): void {
    const cardPos = this.cardPositions.get(actorId);
    if (!cardPos) {
      onDone();
      return;
    }

    this.floatText(cardPos.x, cardPos.y - CARD_HEIGHT / 2, text, color);
    this.time.delayedCall(this.scaled(220), onDone);
  }

  /**
   * A small die badge appears on the acting unit's HUD card, tumbles through a few random faces,
   * then settles — the die itself never grows to fit a long action name (it's a fixed small
   * square), so once it lands, what actually fired is announced separately via the roll banner
   * (see playRollBanner) instead of a label squeezed onto the card.
   */
  private playRoll(actorId: string, actionName: string, onDone: () => void): void {
    const cardPos = this.cardPositions.get(actorId);
    if (!cardPos) {
      onDone();
      return;
    }
    const actorName = this.sceneData.units.find((unit) => unit.id === actorId)?.name ?? actorId;

    const dieX = cardPos.x + DIE_OFFSET_X;
    const dieY = cardPos.y + DIE_OFFSET_Y;
    const bg = this.add.rectangle(dieX, dieY, DIE_SIZE, DIE_SIZE, 0x000000, 0.85).setStrokeStyle(1, COLORS.gridLine);
    const label = this.add.text(dieX, dieY, '?', { fontSize: '13px', color: '#ffffff' }).setOrigin(0.5, 0.5);

    const tumble = (stepsLeft: number): void => {
      if (stepsLeft === 0) {
        // Landed: the die itself just freezes on its last face (the number is decorative, not
        // meaningful) — see playRollBanner for what actually fired.
        this.playRollBanner(actorName, actionName);
        this.time.delayedCall(this.scaled(DIE_SETTLE_HOLD_MS), () => {
          this.tweens.add({
            targets: [bg, label],
            alpha: 0,
            duration: this.scaled(DIE_FADE_MS),
            onComplete: () => {
              bg.destroy();
              label.destroy();
              onDone();
            },
          });
        });
        return;
      }

      label.setText(String(1 + Math.floor(Math.random() * 6)));
      this.tweens.add({
        targets: [bg, label],
        angle: stepsLeft % 2 === 0 ? 12 : -12,
        duration: this.scaled(DIE_TUMBLE_STEP_MS),
        yoyo: true,
        onComplete: () => tumble(stepsLeft - 1),
      });
    };

    tumble(DIE_TUMBLE_STEPS);
  }

  /**
   * Fades in "Name rolled Action!" centered in the headroom LANE_FLOOR_MARGIN reserves above the
   * formation (see that constant's doc comment), holds long enough to read, then fades back out —
   * a non-blocking overlay, not gated by its own onDone, since playRoll's own die-tumble timing
   * already paces the turn.
   */
  private playRollBanner(actorName: string, actionName: string): void {
    const { width } = this.scale;
    const x = width / 2;
    // Centered in LANE_FLOOR_MARGIN's guaranteed headroom band specifically, not the raw canvas
    // top and not the full laneVerticalOffset (which also includes any *extra* push-down a tall
    // HUD stack adds on top of the margin — this stays put regardless of that).
    const y = LANE_FLOOR_MARGIN / 2;

    const text = this.add
      .text(x, y, `${actorName} rolled ${actionName}!`, {
        fontSize: `${ROLL_BANNER_FONT_SIZE}px`,
        fontStyle: 'bold',
        color: '#f0e4c8',
        stroke: '#000000',
        strokeThickness: 4,
      })
      .setOrigin(0.5, 0.5)
      .setAlpha(0);

    this.tweens.add({
      targets: text,
      alpha: 1,
      duration: this.scaled(ROLL_BANNER_FADE_MS),
      onComplete: () => {
        this.time.delayedCall(this.scaled(ROLL_BANNER_HOLD_MS), () => {
          this.tweens.add({
            targets: text,
            alpha: 0,
            duration: this.scaled(ROLL_BANNER_FADE_MS),
            onComplete: () => text.destroy(),
          });
        });
      },
    });
  }

  /** No actor lunge (it's self-inflicted) — just the HP hit and a brief pause so it reads as its own beat. */
  private playStatusTick(targetId: string, damage: number, effectId: StatusEffectId, onDone: () => void): void {
    const flashColor = effectId === 'poison' ? COLORS.poisonFlash : COLORS.burnFlash;
    this.applyHpDelta(targetId, -damage, flashColor, 'hit');
    this.time.delayedCall(this.scaled(220), onDone);
  }

  private playAttack(actorId: string, targetId: string, damage: number, hit: boolean, onDone: () => void): void {
    const actor = this.gridContainers.get(actorId);
    const target = this.gridContainers.get(targetId);
    if (!actor || !target) {
      onDone();
      return;
    }

    const originX = actor.x;
    const originY = actor.y;
    const lungeX = originX + (target.x - originX) * 0.3;
    const lungeY = originY + (target.y - originY) * 0.3;
    const isLethal = hit && (this.currentHp.get(targetId) ?? Infinity) <= damage;

    this.pulsePortrait(actorId, 'attack');

    // The lunge tween animates both x and y on the same target, so Phaser creates one TweenData
    // per property and calls onYoyo once per property — i.e. twice per bounce, not once. Without
    // this guard, a landed hit's damage (and the miss reaction) would be applied twice.
    let impactApplied = false;
    this.tweens.add({
      targets: actor,
      x: lungeX,
      y: lungeY,
      duration: this.scaled(160),
      yoyo: true,
      // A brief hold at the peak of the lunge, right as the hit lands, reads as a hit-stop beat
      // without freezing anything else in the scene — see the constants' comment above.
      hold: hit ? this.scaled(isLethal ? LETHAL_HIT_HOLD_MS : HIT_HOLD_MS) : 0,
      ease: 'Quad.easeOut',
      onYoyo: () => {
        if (impactApplied) return;
        impactApplied = true;
        if (hit) {
          this.applyHpDelta(targetId, -damage, COLORS.attackFlash, 'hit');
        } else {
          this.pulsePortrait(targetId, 'dodge');
          this.showMissText(targetId);
        }
      },
      onComplete: onDone,
    });
  }

  private playHeal(actorId: string, targetId: string, amount: number, onDone: () => void): void {
    const actor = this.gridContainers.get(actorId);
    if (!actor) {
      onDone();
      return;
    }

    this.pulsePortrait(actorId, 'cast');
    this.applyHpDelta(targetId, amount, COLORS.healFlash, 'healed');

    this.tweens.add({
      targets: actor,
      scale: 1.25,
      duration: this.scaled(180),
      yoyo: true,
      ease: 'Quad.easeOut',
      onComplete: onDone,
    });
  }

  /** Updates HP (card bar + text), flashes the grid icon, and pulses the card portrait — 'downed' instead of `reactionState` and no revert if this brings HP to 0. Also floats a damage/heal number and, for damage, shakes the camera (more for a killing blow) and plays a death-fall on the grid sprite if this brings HP to 0. */
  private applyHpDelta(unitId: string, delta: number, flashColor: number, reactionState: PortraitState): void {
    const unit = this.sceneData.units.find((u) => u.id === unitId);
    const bar = this.cardHealthBars.get(unitId);
    const hpText = this.cardHpTexts.get(unitId);
    const gridSprite = this.gridSprites.get(unitId);
    const gridContainer = this.gridContainers.get(unitId);
    if (!unit || !bar || !hpText) {
      return;
    }

    const newHp = Math.max(0, Math.min(unit.maxHp, (this.currentHp.get(unitId) ?? unit.hp) + delta));
    this.currentHp.set(unitId, newHp);
    const ratio = unit.maxHp > 0 ? newHp / unit.maxHp : 0;
    const isLethal = delta < 0 && newHp <= 0;

    this.tweens.add({ targets: bar, width: HP_BAR_WIDTH * ratio, duration: this.scaled(220) });
    hpText.setText(`${newHp}/${unit.maxHp}`);

    const rageText = this.cardRageTexts.get(unitId);
    if (rageText) {
      rageText.setText(this.rageLabel(newHp, unit.maxHp));
    }

    if (gridContainer && delta !== 0) {
      this.showDamageNumber(gridContainer.x, gridContainer.y - CELL_SIZE * 0.6, delta, colorToCss(flashColor));
    }

    if (delta < 0) {
      this.cameras.main.shake(
        this.scaled(isLethal ? LETHAL_SHAKE_DURATION_MS : SHAKE_DURATION_MS),
        isLethal ? LETHAL_SHAKE_INTENSITY : SHAKE_INTENSITY,
      );
    }

    if (newHp <= 0) {
      this.setPortraitState(unitId, 'downed');
      if (gridSprite) {
        const fallAngle = unit.side === 'party' ? -DEATH_FALL_ANGLE_DEG : DEATH_FALL_ANGLE_DEG;
        this.tweens.add({
          targets: gridSprite,
          angle: fallAngle,
          alpha: DOWNED_ALPHA,
          duration: this.scaled(DEATH_FALL_DURATION_MS),
          ease: 'Cubic.easeIn',
        });
      }
    } else {
      this.pulsePortrait(unitId, reactionState);
    }

    if (gridSprite) {
      // FILL tint mode (not the MULTIPLY default) so the flash reads as a solid color against the
      // sprite's alpha shape, matching the old flat-circle flash instead of a no-op over white.
      gridSprite.setTintMode(Phaser.TintModes.FILL).setTint(flashColor);
      this.time.delayedCall(this.scaled(180), () => gridSprite.clearTint());
    }
  }

  /** Floats a bold "+N"/"-N" amount up from a grid position — bigger than the shared floatText so it reads clearly mid-fight. */
  private showDamageNumber(x: number, y: number, delta: number, color: string): void {
    const text = delta > 0 ? `+${delta}` : `${delta}`;
    const label = this.add.text(x, y, text, { fontSize: '18px', color, fontStyle: 'bold' }).setOrigin(0.5, 0.5);

    this.tweens.add({
      targets: label,
      y: label.y - 26,
      alpha: 0,
      duration: this.scaled(650),
      onComplete: () => label.destroy(),
    });
  }

  /** Floats a "Miss" label up from the target's grid position and fades it out — the only feedback a dodge gets on the grid itself. */
  private showMissText(unitId: string): void {
    const container = this.gridContainers.get(unitId);
    if (!container) return;

    this.floatText(container.x, container.y - CELL_SIZE * 0.6, 'Miss', '#cccccc');
  }

  /** Floats `text` upward from `(x, y)` and fades it out — shared by the Miss popup and the die-roll result announcement. */
  private floatText(x: number, y: number, text: string, color: string): void {
    const label = this.add.text(x, y, text, { fontSize: '14px', color }).setOrigin(0.5, 0.5);

    this.tweens.add({
      targets: label,
      y: label.y - 20,
      alpha: 0,
      duration: this.scaled(500),
      onComplete: () => label.destroy(),
    });
  }
}
