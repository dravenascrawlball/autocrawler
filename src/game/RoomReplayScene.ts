import Phaser from 'phaser';
import type { GridPosition } from '../sim/formation';
import type { StatusEffectId } from '../sim/statusEffects';
import { rageDamageBonusFraction } from '../sim/traits';
import { CHARGE_MAX, CHARGE_START } from '../sim/charge';
import { COLORS } from './constants';

export interface ReplayUnit {
  id: string;
  name: string;
  /** Archetype template name (e.g. "Fighter", "Grunt") — see sim/adventurer.ts's `archetype` field. Used for the grid body sprite lookup. */
  archetype: string;
  /** HP at the start of this room's replay. */
  hp: number;
  maxHp: number;
  side: 'party' | 'enemy';
  /** Position on this unit's side's 3x3 grid — see sim/formation.ts. Starts at the formation the room began with; a 'move' event (displacement) updates it mid-replay. */
  position: GridPosition;
  /** The unit's active Kit art key, if any (see sim/kits.ts's artKeyFor) — its costume sprite is used when that file exists, else the base archetype sprite. */
  kitArtKey?: string;
  /** A summoned unit (sim/summons.ts): invisible until its 'spawn' event. */
  hiddenUntilSpawn?: boolean;
  /** Whether this unit has RAGE_TRAIT (see sim/traits.ts) — shows a live "Raging +N%" readout on its status badge, recomputed as HP changes during the replay. */
  hasRageTrait?: boolean;
  /** Has a charge-meter Special (sim/charge.ts) — gets a charge bar under the HP bar. */
  hasChargedSpecial?: boolean;
}

export type ReplayEvent =
  | { type: 'attack'; actorId: string; targetId: string; damage: number; hit: boolean }
  | { type: 'heal'; actorId: string; targetId: string; amount: number }
  /** A status effect (e.g. Burn, Poison) dealing its per-turn damage — see sim/statusEffects.ts. No actor: it's self-inflicted, not landed by another unit's turn. */
  | { type: 'status-tick'; targetId: string; damage: number; effectId: StatusEffectId }
  /** Announces the action about to fire this turn (see sim/turnEngine.ts's rolledActionId — deterministic now, not actually rolled; the field/event names are a holdover from the old dice system) — played before that turn's other event(s). */
  | { type: 'roll'; actorId: string; actionName: string }
  /**
   * A one-shot floating announcement over `actorId`'s grid position — not a
   * persistent per-ally readout (a buff's own effect, e.g. mitigated
   * damage, still shows up in future hits normally). Used by Glint's
   * Rallying Strike, Fallacy's Empower, and Fallacy's Command
   * (roadmap item 11) to narrate a support effect that has no attack/heal
   * animation of its own to piggyback on.
   */
  | { type: 'announce'; actorId: string; text: string; color: string }
  /** A unit sliding to a new grid cell mid-fight — e.g. the Chain Warden's Hook Chain dragging a hero forward. */
  | { type: 'move'; unitId: string; to: GridPosition }
  /** A summoned unit appearing (fades in) — see sim/summons.ts. */
  | { type: 'spawn'; unitId: string }
  /** Summoned units vanishing with their summoner (fade out). */
  | { type: 'banish'; unitIds: string[] }
  /** Every unit's Special Action charge at the end of a turn (sim/turnEngine.ts's chargeAfter) — updates the charge bars without pausing playback. */
  | { type: 'charge'; values: Record<string, number> };

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

// Lane layout: a static 3x3-grid-per-side formation view fills the whole canvas now — there's no
// separate HUD card strip anymore (dungeon HUD rework, roadmap item 1): with party size now
// ranging 1-9 over a run's life, a side panel sized for "always exactly 4" broke at both ends
// (sparse at 1, didn't fit at 7-9). HP/status now lives as a compact badge attached directly to
// each unit's grid position instead, which scales for free with however many slots are occupied.
// Six columns left-to-right: party rank 2/1/0 (back to front), then enemy rank 0/1/2 (front to
// back) — the two front ranks meet in the middle, back ranks sit outermost. Each column has
// exactly 3 fixed lane slots (top to bottom) — an unoccupied lane just renders empty.
const CELL_SIZE = 80;
/** Native dimensions of a body sprite PNG — anchored at feet. */
const BODY_SPRITE_WIDTH = 64;
const BODY_SPRITE_HEIGHT = 96;
/**
 * Rendered narrower than CELL_SIZE (the column's own width/spacing), not the full column width —
 * scaling sprites to fill CELL_SIZE made each occupied lane's vertical band (LANE_STEP, driven by
 * this height) dominate the canvas, flipping the whole formation view from landscape to portrait
 * once the old HUD card strips (which used to add width on both sides) were removed. Shrinking
 * just the sprite (not the column grid itself) buys back a landscape shape without touching lane
 * spacing/positioning math, which still keys off CELL_SIZE.
 */
const BODY_SPRITE_RENDER_WIDTH = 60;
const BODY_SPRITE_DISPLAY_HEIGHT = BODY_SPRITE_RENDER_WIDTH * (BODY_SPRITE_HEIGHT / BODY_SPRITE_WIDTH);
const LANE_SIDE_PADDING = 40;
const LANE_COLUMN_COUNT = 6;
/** Every side's grid is exactly 3 lanes deep — fixed, not dependent on how many units occupy it. */
const GRID_LANES = 3;

// Status badge — HP bar + HP text (+ a Rage readout when present), anchored directly below each
// unit's feet. Compact and minimal on purpose (no name, no portrait — see the file's own doc
// comment on what this intentionally dropped) so it stays legible at the grid's full 9-per-side
// density, not just at today's lighter rosters.
const BADGE_WIDTH = CELL_SIZE - 10;
const BADGE_HP_BAR_HEIGHT = 5;
const BADGE_HP_BAR_WIDTH = BADGE_WIDTH - 8;
const BADGE_HP_TEXT_HEIGHT = 12;
const BADGE_CHARGE_BAR_HEIGHT = 2;
const BADGE_RAGE_TEXT_HEIGHT = 11;
const BADGE_ROW_GAP = 2;
/** Gap between a unit's feet and the top of its badge. */
const BADGE_TOP_GAP = 4;
const BADGE_HEIGHT = BADGE_HP_BAR_HEIGHT + BADGE_CHARGE_BAR_HEIGHT + BADGE_ROW_GAP + BADGE_HP_TEXT_HEIGHT + BADGE_ROW_GAP + BADGE_RAGE_TEXT_HEIGHT;

/**
 * Vertical spacing between lane slots. Deliberately NOT just CELL_SIZE (which only governs
 * horizontal column width and sprite width): a body sprite's display height
 * (BODY_SPRITE_DISPLAY_HEIGHT) is 1.5x CELL_SIZE on its own, before the badge below it even enters
 * the picture — spacing lanes by CELL_SIZE alone would make every occupied lane's sprite overlap
 * the lane below it. Each lane instead gets a self-contained vertical band exactly tall enough for
 * one sprite plus its badge, so nothing overlaps regardless of how densely the grid is populated
 * (up to the full 3x3).
 */
const LANE_STEP = BODY_SPRITE_DISPLAY_HEIGHT + BADGE_TOP_GAP + BADGE_HEIGHT;
/** Flat clearance above the topmost lane band. */
const LANE_TOP_MARGIN = 16;
/**
 * Fixed headroom reserved above the lane rows — guarantees every room's formation sits low enough
 * to read as standing on the backdrop's stone floor rather than up in the archway, even a minimal
 * 1v1 room (see replayCanvasSize, which folds this into its own height floor so the two stay in
 * sync). Also doubles as open space for the roll banner. Trimmed down alongside
 * BODY_SPRITE_RENDER_WIDTH (see its own doc comment) — still comfortably enough room for the
 * banner text and some breathing room above the formation, just not as much as a card-strip-era
 * canvas could spare.
 */
const LANE_FLOOR_MARGIN = 120;
/** Extra downward push applied to whatever additional vertical room the canvas has beyond LANE_FLOOR_MARGIN's guaranteed minimum — 0 would leave that extra room centered above the margin, 1 would push it all the way into the margin. */
const LANE_VERTICAL_BIAS_FRACTION = 0.7;
const DOWNED_ALPHA = 0.3;

/**
 * Which of the 6 lane-view columns (0-5, left to right) `unit` belongs in: the party's 3 ranks
 * back-to-front (columns 0-2), then the enemy's 3 ranks front-to-back (columns 3-5) — the two
 * front ranks (party rank 0, enemy rank 0) meet in the middle, back ranks sit outermost. A free
 * function (not a scene method) so replayCanvasSize can share it without a scene instance.
 */
function columnForUnit(unit: ReplayUnit): number {
  return unit.side === 'party' ? 2 - unit.position.rank : 3 + unit.position.rank;
}

/**
 * How many lane slots each column actually needs to render `units` without anyone overlapping —
 * GRID_LANES (3) under normal circumstances (one unit per cell — see formation.ts's
 * assignUniquePositions), but more if a single column somehow ends up with more occupants than
 * that. Every column uses this same slot count, not just the crowded one, so lanes stay
 * row-aligned across the whole grid.
 */
function requiredLaneSlots(units: ReplayUnit[]): number {
  const counts = new Map<number, number>();
  for (const unit of units) {
    const column = columnForUnit(unit);
    counts.set(column, (counts.get(column) ?? 0) + 1);
  }
  return Math.max(GRID_LANES, ...counts.values());
}

/** The lane grid's total height for this room's actual units — shared by replayCanvasSize and create() so the two never drift apart. */
function laneAreaHeight(units: ReplayUnit[]): number {
  return LANE_FLOOR_MARGIN + LANE_TOP_MARGIN + requiredLaneSlots(units) * LANE_STEP;
}

const INTRO_HOLD_MS = 700;
const INTRO_FADE_MS = 400;

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

/**
 * Turn-start banner — a big "Name uses Action!" readout centered in the headroom
 * LANE_FLOOR_MARGIN reserves above the formation. Used to be paired with a tumbling die badge
 * over the acting unit's head (a literal roll animation) — removed once Basic Action became
 * deterministic (the combat overhaul) made the "rolled" framing actively misleading; this banner
 * is now the only per-turn announcement of what's about to fire.
 */
const ROLL_BANNER_FONT_SIZE = 22;
const ROLL_BANNER_FADE_MS = 220;
const ROLL_BANNER_HOLD_MS = 450;

/** Canvas size that fits `units`' lane grid — width is always fixed (6 columns), height grows past the normal 3-lane minimum if any single column ends up more crowded than that (see requiredLaneSlots). */
export function replayCanvasSize(units: ReplayUnit[]): { width: number; height: number } {
  return {
    width: LANE_SIDE_PADDING * 2 + LANE_COLUMN_COUNT * CELL_SIZE,
    height: laneAreaHeight(units),
  };
}

/** Converts a Phaser numeric color (e.g. COLORS.attackFlash) to a CSS hex string for use in a Text object's style. */
function colorToCss(color: number): string {
  return `#${color.toString(16).padStart(6, '0')}`;
}

/** Inverse of colorToCss — the announce events' colors are authored as CSS hex strings (see DungeonPhaseView's buildRoomData), but the Glow filter wants a numeric color. */
function cssColorToNumber(color: string): number {
  return parseInt(color.replace('#', ''), 16);
}

/** Lowercases and replaces spaces with underscores (e.g. "Kobold Skirmisher" -> "kobold_skirmisher") so a multi-word archetype name still resolves to a valid asset filename. Mirrors ui/portraits.ts's own copy. */
function slugifyArchetype(archetype: string): string {
  return archetype.toLowerCase().replace(/\s+/g, '_');
}

/**
 * Grid body sprite for a unit — a static 64x96 image per archetype (see
 * public/sprites/), the unit's only on-canvas art now that the HUD
 * card strip (and the portrait mood art it carried — attack/hit/cast/
 * healed/downed/dodge faces) is gone. Combat feedback now reads through
 * the sprite's own tint flash, lunge, death-fall, and the floating damage
 * numbers/sparks, rather than a separate face swapping expression.
 * Every archetype/monster is expected to have a real file in place (a
 * copy of default_adventurer.png/default_monster.png as a stand-in until
 * real art exists) — no missing-file fallback here.
 */
function bodyTextureKey(archetype: string): string {
  return `body:${slugifyArchetype(archetype)}`;
}

function bodyAssetPath(side: 'party' | 'enemy', archetype: string): string {
  const folder = side === 'party' ? 'adventurers' : 'monsters';
  return `/sprites/${folder}/${slugifyArchetype(archetype)}.png`;
}

/** Single shared backdrop behind the whole replay canvas. Missing file (no art yet) just leaves Phaser's own flat `backgroundColor` showing, same graceful-degradation convention as the body sprites. */
const BACKGROUND_TEXTURE_KEY = 'background:dungeon-room';
const BACKGROUND_ASSET_PATH = '/backgrounds/dungeon-room.png';

// Impact/heal sparks — a generated (not loaded) texture, since it's a plain tinted dot rather than
// real art, reused across every burst by tinting per-call instead of per-archetype assets.
const SPARK_TEXTURE_KEY = 'fx:spark';
const HIT_BURST_COUNT = 10;
const LETHAL_BURST_COUNT = 24;
const HEAL_BURST_COUNT = 14;
const BURST_LIFESPAN_MS = 380;
const LETHAL_BURST_LIFESPAN_MS = 520;

// A killing blow also pulses a whole-screen glow (see create()'s lethalGlow filter) on top of the
// existing camera shake — makes a kill read as more significant than a regular hit without
// touching the shake itself.
const LETHAL_GLOW_STRENGTH = 10;
const LETHAL_GLOW_PULSE_MS = 180;

// Heals, casts, and buff/support announcements get the same glow filter but much softer — ambient
// warmth rather than another impact beat.
const SOFT_GLOW_STRENGTH = 3;
const SOFT_GLOW_PULSE_MS = 240;

/**
 * Replays one room's flattened action log: every unit stands at its real
 * grid position with a compact HP/status badge beneath its feet (see the
 * file's own doc comment on why this replaced the old fixed-size HUD card
 * strip) — attacks/heals flash and shake the relevant sprite and update
 * its badge, rather than a separate portrait's mood. Opens with a brief
 * fade-in "Room N / total" title card, then calls `onComplete` once every
 * event has played.
 */
export class RoomReplayScene extends Phaser.Scene {
  static readonly KEY = 'RoomReplayScene';

  private sceneData!: RoomReplaySceneData;
  private gridContainers = new Map<string, Phaser.GameObjects.Container>();
  private gridSprites = new Map<string, Phaser.GameObjects.Image>();
  private badgeHealthBars = new Map<string, Phaser.GameObjects.Rectangle>();
  private badgeHpTexts = new Map<string, Phaser.GameObjects.Text>();
  private badgeChargeBars = new Map<string, Phaser.GameObjects.Rectangle>();
  private badgeRageTexts = new Map<string, Phaser.GameObjects.Text>();
  /** A unit's feet position — the shared anchor every per-unit effect (badge, floating text, sparks) positions itself relative to. */
  private feetPositions = new Map<string, { x: number; y: number }>();
  /** Each unit's status-badge container — kept so a mid-fight 'move' can slide the badge along with the sprite. */
  private badgeContainers = new Map<string, Phaser.GameObjects.Container>();
  private currentHp = new Map<string, number>();
  private speedMultiplier = 1;
  private desiredPaused = false;
  /** Extra vertical offset applied to lane positions when the canvas is taller than the lane area needs — see create()'s comment. */
  private laneVerticalOffset = 0;
  /** How many lane slots each column renders this room — see requiredLaneSlots; computed once in create(). */
  private laneSlotCount = GRID_LANES;
  /** Whole-camera glow filter, held at outerStrength 0 until a lethal hit pulses it — see LETHAL_GLOW_STRENGTH. */
  private lethalGlow: Phaser.Filters.Glow | null = null;

  constructor() {
    super(RoomReplayScene.KEY);
  }

  init(data: RoomReplaySceneData): void {
    this.sceneData = data;
    data.onSceneReady?.(this);
    this.gridContainers.clear();
    this.gridSprites.clear();
    this.badgeHealthBars.clear();
    this.badgeHpTexts.clear();
    this.badgeChargeBars.clear();
    this.badgeRageTexts.clear();
    this.feetPositions.clear();
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

    const bodySeen = new Set<string>();
    for (const unit of this.sceneData.units) {
      // Base sprite always; Kit costume sprite too when the unit wears one. A missing Kit file just
      // fails to load (Phaser logs it and moves on) and bodyTextureFor falls back to the base.
      for (const artKey of [unit.archetype, ...(unit.kitArtKey ? [unit.kitArtKey] : [])]) {
        const key = bodyTextureKey(artKey);
        if (bodySeen.has(key)) continue;
        bodySeen.add(key);
        this.load.image(key, bodyAssetPath(unit.side, artKey));
      }
    }
  }

  /** The texture to draw `unit` with: its Kit costume if that sprite actually loaded, else its base archetype sprite. */
  private bodyTextureFor(unit: ReplayUnit): string {
    if (unit.kitArtKey && this.textures.exists(bodyTextureKey(unit.kitArtKey))) {
      return bodyTextureKey(unit.kitArtKey);
    }
    return bodyTextureKey(unit.archetype);
  }

  create(): void {
    const { width, height } = this.scale;

    this.createBackground(width, height);
    this.ensureSparkTexture();
    this.lethalGlow = this.cameras.main.filters.internal.addGlow(0xffffff, 0, 0, 1);

    // The canvas's actual height is often taller than the lane area alone needs — without this,
    // units stay pinned to their top-margin offset and end up looking stranded near the top of a
    // tall background instead of sitting mid-scene. Centers the lane grid's fixed height in
    // whatever extra vertical room the canvas has.
    // LANE_FLOOR_MARGIN alone already grounds the formation even in the smallest room; any extra
    // room the canvas has beyond that pushes it down further still, rather than sitting centered
    // in that extra space.
    this.laneSlotCount = requiredLaneSlots(this.sceneData.units);
    this.laneVerticalOffset =
      LANE_FLOOR_MARGIN + Math.max(0, height - laneAreaHeight(this.sceneData.units)) * LANE_VERTICAL_BIAS_FRACTION;

    this.drawLaneDivider();

    // Grouped by column (rank) so layoutColumn can fall back to centering a column whose units share
    // a lane (old saves, or a party larger than 9) — normally every unit has its own cell (see
    // formation.ts's assignUniquePositions) and lands at its literal lane.
    const byColumn = new Map<number, ReplayUnit[]>();
    for (const unit of this.sceneData.units) {
      const column = columnForUnit(unit);
      const existing = byColumn.get(column);
      if (existing) existing.push(unit);
      else byColumn.set(column, [unit]);
    }
    for (const [column, units] of byColumn) {
      this.layoutColumn(column, units);
    }

    this.playIntro();
  }

  /**
   * Places every unit in one column at its own literal lane slot — the normal case, since positions
   * are unique per side (see formation.ts's assignUniquePositions), so a unit in lane 0 and one in
   * lane 2 render top and bottom with the middle slot empty, exactly as placed on the formation
   * board. Only if two units share a lane (or the column needs more than 3 slots — see
   * requiredLaneSlots) does it fall back to sorting by lane and centering the group within
   * `laneSlotCount`, so nobody overlaps.
   */
  private layoutColumn(column: number, units: ReplayUnit[]): void {
    const sorted = [...units].sort((a, b) => a.position.lane - b.position.lane);
    const lanesDistinct = new Set(sorted.map((unit) => unit.position.lane)).size === sorted.length;
    if (lanesDistinct && this.laneSlotCount === GRID_LANES) {
      for (const unit of sorted) {
        const pos = this.laneFeetPosition(column, unit.position.lane);
        this.createGridUnit(unit, pos.x, pos.y);
      }
      return;
    }
    const offset = (this.laneSlotCount - sorted.length) / 2;
    sorted.forEach((unit, index) => {
      const pos = this.laneFeetPosition(column, index + offset);
      this.createGridUnit(unit, pos.x, pos.y);
    });
  }

  /**
   * Fills the whole canvas with the shared dungeon backdrop, if its art exists — a no-op leaving
   * Phaser's flat `backgroundColor` visible otherwise. Drawn first so every other object paints on
   * top of it. Scaled to cover (like CSS `object-fit: cover`) rather than stretched: the canvas's
   * width is fixed but its height varies with room size, so a uniform scale-and-crop keeps the
   * source art's own proportions correct in every room instead of squashing/stretching it
   * differently each time. Overflow past the canvas edge is simply never rendered — Phaser doesn't
   * draw outside the canvas bounds — so no mask is needed.
   */
  private createBackground(width: number, height: number): void {
    if (!this.textures.exists(BACKGROUND_TEXTURE_KEY)) {
      return;
    }
    const image = this.add.image(width / 2, height / 2, BACKGROUND_TEXTURE_KEY).setOrigin(0.5, 0.5);
    const scale = Math.max(width / image.width, height / image.height);
    image.setScale(scale);
  }

  /** Generates the shared spark dot texture once (textures persist across scene restarts on the same Game, so a re-check is enough — no per-room regeneration). Tinted per-burst rather than per-archetype, since it's a plain effect, not real art. */
  private ensureSparkTexture(): void {
    if (this.textures.exists(SPARK_TEXTURE_KEY)) return;
    const graphics = this.make.graphics({}, false);
    graphics.fillStyle(0xffffff, 1);
    graphics.fillCircle(4, 4, 4);
    graphics.generateTexture(SPARK_TEXTURE_KEY, 8, 8);
    graphics.destroy();
  }

  /** One-shot particle burst (hit sparks, heal sparkle) — spawns its own short-lived emitter and destroys it once its particles finish, rather than keeping a shared emitter alive for the whole replay. */
  private burstSparks(x: number, y: number, tint: number, quantity: number, lifespanMs: number): void {
    const scaledLifespan = this.scaled(lifespanMs);
    const emitter = this.add.particles(x, y, SPARK_TEXTURE_KEY, {
      lifespan: scaledLifespan,
      speed: { min: 60, max: 220 },
      angle: { min: 0, max: 360 },
      scale: { start: 1.4, end: 0 },
      alpha: { start: 1, end: 0 },
      tint,
      blendMode: 'ADD',
      emitting: false,
    });
    emitter.explode(quantity);
    this.time.delayedCall(scaledLifespan + 50, () => emitter.destroy());
  }

  /**
   * Pulses the whole-screen glow filter (see create()'s lethalGlow) up and back down, in `color`
   * — reset to white once the pulse finishes so the next (possibly uncolored) pulse doesn't
   * inherit it. Shared by the strong white pulse on a killing blow and the softer, event-tinted
   * pulses on heals/casts/buff announcements (see pulseLethalGlow/pulseSoftGlow below).
   */
  private pulseGlow(strength: number, durationMs: number, color: number): void {
    if (!this.lethalGlow) return;
    this.lethalGlow.color = color;
    this.tweens.add({
      targets: this.lethalGlow,
      outerStrength: strength,
      duration: this.scaled(durationMs),
      yoyo: true,
      ease: 'Quad.easeOut',
      onComplete: () => {
        if (this.lethalGlow) this.lethalGlow.color = 0xffffff;
      },
    });
  }

  /** The strong white pulse on a killing blow — the screen-wide complement to the camera shake already applied for a killing blow. */
  private pulseLethalGlow(): void {
    this.pulseGlow(LETHAL_GLOW_STRENGTH, LETHAL_GLOW_PULSE_MS, 0xffffff);
  }

  /** A soft, event-tinted glow pulse for heals/casts/buff announcements — much weaker than the lethal-hit pulse so it reads as ambient warmth rather than another impact. */
  private pulseSoftGlow(color: number): void {
    this.pulseGlow(SOFT_GLOW_STRENGTH, SOFT_GLOW_PULSE_MS, color);
  }

  /** A single vertical line between the two front-rank columns (party rank 0, enemy rank 0) — the only visual cue for "this is where the fighting happens." Spans just the fixed lane grid height (offset the same way as the units themselves) rather than stretching to the canvas edges, which would otherwise dangle past a vertically-centered formation. */
  private drawLaneDivider(): void {
    const x = LANE_SIDE_PADDING + 3 * CELL_SIZE;
    const top = this.laneVerticalOffset + LANE_TOP_MARGIN;
    const bottom = top + this.laneSlotCount * LANE_STEP;
    const graphics = this.add.graphics();
    graphics.lineStyle(1, COLORS.gridLine, 1);
    graphics.lineBetween(x, top, x, bottom);
  }

  /** Feet position for lane `lane` (0-2, top to bottom — a fixed slot, not occupant-dependent) within column `column` (0-5, see columnForUnit). Each lane's own self-contained band (LANE_STEP tall) means this never needs to know how densely-occupied neighboring lanes are. */
  private laneFeetPosition(column: number, lane: number): { x: number; y: number } {
    return {
      x: LANE_SIDE_PADDING + column * CELL_SIZE + CELL_SIZE / 2,
      y: this.laneVerticalOffset + LANE_TOP_MARGIN + lane * LANE_STEP + BODY_SPRITE_DISPLAY_HEIGHT,
    };
  }

  /** A body sprite in its formation lane, anchored at the feet, plus its status badge just below. Faces toward the opposing side: party faces right, enemy faces left (sprites are drawn facing right by convention). */
  private createGridUnit(unit: ReplayUnit, feetX: number, feetY: number): void {
    this.feetPositions.set(unit.id, { x: feetX, y: feetY });

    const sprite = this.add
      .image(0, 0, this.bodyTextureFor(unit))
      .setOrigin(0.5, 1)
      .setDisplaySize(BODY_SPRITE_RENDER_WIDTH, BODY_SPRITE_DISPLAY_HEIGHT)
      .setFlipX(unit.side === 'enemy');
    const container = this.add.container(feetX, feetY, [sprite]);
    if (unit.hiddenUntilSpawn) container.setAlpha(0);
    this.gridContainers.set(unit.id, container);
    this.gridSprites.set(unit.id, sprite);

    this.createStatusBadge(unit, feetX, feetY);
  }

  /** Compact HP bar + HP text (+ Rage readout when present) centered just below `unit`'s feet — see the file's own doc comment on why this replaces the old HUD card. */
  private createStatusBadge(unit: ReplayUnit, feetX: number, feetY: number): void {
    const badgeCenterY = feetY + BADGE_TOP_GAP + BADGE_HEIGHT / 2;
    const bg = this.add.rectangle(0, 0, BADGE_WIDTH, BADGE_HEIGHT, COLORS.background, 0.8);
    let cursor = -BADGE_HEIGHT / 2;

    const barY = cursor + BADGE_HP_BAR_HEIGHT / 2;
    const healthBarBg = this.add.rectangle(0, barY, BADGE_HP_BAR_WIDTH, BADGE_HP_BAR_HEIGHT, COLORS.healthBarBack);
    const healthBarFill = this.add
      .rectangle(0, barY, BADGE_HP_BAR_WIDTH * (unit.hp / unit.maxHp), BADGE_HP_BAR_HEIGHT, COLORS.healthBarFill)
      .setOrigin(0, 0.5);
    healthBarFill.x = -BADGE_HP_BAR_WIDTH / 2;
    this.badgeHealthBars.set(unit.id, healthBarFill);
    cursor += BADGE_HP_BAR_HEIGHT;

    const barChildren: Phaser.GameObjects.GameObject[] = [];
    if (unit.hasChargedSpecial) {
      const chargeY = cursor + BADGE_CHARGE_BAR_HEIGHT / 2;
      const chargeBg = this.add.rectangle(0, chargeY, BADGE_HP_BAR_WIDTH, BADGE_CHARGE_BAR_HEIGHT, COLORS.healthBarBack);
      const chargeFill = this.add
        .rectangle(-BADGE_HP_BAR_WIDTH / 2, chargeY, BADGE_HP_BAR_WIDTH * (CHARGE_START / CHARGE_MAX), BADGE_CHARGE_BAR_HEIGHT, COLORS.chargeBarFill)
        .setOrigin(0, 0.5);
      this.badgeChargeBars.set(unit.id, chargeFill);
      barChildren.push(chargeBg, chargeFill);
    }
    cursor += BADGE_CHARGE_BAR_HEIGHT + BADGE_ROW_GAP;

    const hpText = this.add
      .text(0, cursor + BADGE_HP_TEXT_HEIGHT / 2, `${unit.hp}/${unit.maxHp}`, { fontSize: '10px', color: '#cccccc' })
      .setOrigin(0.5, 0.5);
    this.badgeHpTexts.set(unit.id, hpText);
    cursor += BADGE_HP_TEXT_HEIGHT + BADGE_ROW_GAP;

    const children: Phaser.GameObjects.GameObject[] = [bg, healthBarBg, healthBarFill, ...barChildren, hpText];

    if (unit.hasRageTrait) {
      const rageText = this.add
        .text(0, cursor + BADGE_RAGE_TEXT_HEIGHT / 2, this.rageLabel(unit.hp, unit.maxHp), {
          fontSize: '9px',
          color: '#ff6666',
        })
        .setOrigin(0.5, 0.5);
      this.badgeRageTexts.set(unit.id, rageText);
      children.push(rageText);
    }

    const badge = this.add.container(feetX, badgeCenterY, children);
    if (unit.hiddenUntilSpawn) badge.setAlpha(0);
    this.badgeContainers.set(unit.id, badge);
  }

  /** "Raging +N%" once the bonus is non-zero, blank at full HP — see traits.ts's RAGE_TRAIT. */
  private rageLabel(hp: number, maxHp: number): string {
    const bonusPercent = Math.round(rageDamageBonusFraction(hp, maxHp) * 100);
    return bonusPercent > 0 ? `Raging +${bonusPercent}%` : '';
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
      this.playAttack(event.actorId, event.targetId, event.damage, next);
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
    if (event.type === 'move') {
      this.playMove(event.unitId, event.to, next);
      return;
    }
    if (event.type === 'spawn') {
      this.playFade([event.unitId], 1, next);
      return;
    }
    if (event.type === 'banish') {
      this.playFade(event.unitIds, 0, next);
      return;
    }
    if (event.type === 'charge') {
      this.updateChargeBars(event.values);
      next();
      return;
    }
    this.playHeal(event.actorId, event.targetId, event.amount, next);
  }

  /** Tweens each charge bar to its unit's new charge — gold once full (its Special fires next turn). */
  private updateChargeBars(values: Record<string, number>): void {
    for (const [unitId, charge] of Object.entries(values)) {
      const bar = this.badgeChargeBars.get(unitId);
      if (!bar) continue;
      const ratio = Math.max(0, Math.min(1, charge / CHARGE_MAX));
      bar.setFillStyle(ratio >= 1 ? COLORS.chargeBarFull : COLORS.chargeBarFill);
      this.tweens.add({ targets: bar, width: BADGE_HP_BAR_WIDTH * ratio, duration: this.scaled(200) });
    }
  }

  /** Fades the sprites and status badges of `unitIds` to `alpha` — a summon appearing (1) or being banished (0). */
  private playFade(unitIds: string[], alpha: number, onDone: () => void): void {
    const targets = unitIds.flatMap((id) => [this.gridContainers.get(id), this.badgeContainers.get(id)]).filter(
      (target): target is Phaser.GameObjects.Container => target !== undefined,
    );
    if (targets.length === 0) {
      onDone();
      return;
    }
    this.tweens.add({ targets, alpha, duration: this.scaled(320), ease: 'Quad.easeOut', onComplete: onDone });
  }

  /**
   * Slides `unitId`'s sprite and status badge to `to` — the cell it now stands in after being
   * displaced mid-fight. Updates the unit's stored position and feet position so later attacks
   * lunge from (and floating numbers appear at) the new spot.
   */
  private playMove(unitId: string, to: GridPosition, onDone: () => void): void {
    const unit = this.sceneData.units.find((candidate) => candidate.id === unitId);
    const container = this.gridContainers.get(unitId);
    if (!unit || !container) {
      onDone();
      return;
    }

    unit.position = { ...to };
    const target = this.laneFeetPosition(columnForUnit(unit), to.lane);
    this.feetPositions.set(unitId, target);
    const badge = this.badgeContainers.get(unitId);
    if (badge) {
      this.tweens.add({
        targets: badge,
        x: target.x,
        y: target.y + BADGE_TOP_GAP + BADGE_HEIGHT / 2,
        duration: this.scaled(260),
        ease: 'Quad.easeInOut',
      });
    }
    this.tweens.add({
      targets: container,
      x: target.x,
      y: target.y,
      duration: this.scaled(260),
      ease: 'Quad.easeInOut',
      onComplete: onDone,
    });
  }

  /** Floats a one-shot text announcement over `actorId`'s grid position, plus a soft glow pulse in the same color — see the 'announce' ReplayEvent doc comment for what uses this. */
  private playAnnounce(actorId: string, text: string, color: string, onDone: () => void): void {
    const feet = this.feetPositions.get(actorId);
    if (!feet) {
      onDone();
      return;
    }

    this.floatText(feet.x, feet.y - BODY_SPRITE_DISPLAY_HEIGHT, text, color);
    this.pulseSoftGlow(cssColorToNumber(color));
    this.time.delayedCall(this.scaled(220), onDone);
  }

  /**
   * Fades in "Name uses Action!" centered in the headroom LANE_FLOOR_MARGIN reserves above the
   * formation (see that constant's doc comment), holds long enough to read, then fades back out —
   * a non-blocking overlay; `onDone` fires once the hold+fade finishes, pacing the turn (there's no
   * die animation anymore to pace it instead — see this file's ROLL_BANNER_* doc comment).
   */
  private playRoll(actorId: string, actionName: string, onDone: () => void): void {
    const actorName = this.sceneData.units.find((unit) => unit.id === actorId)?.name ?? actorId;
    const { width } = this.scale;
    const x = width / 2;
    // Centered in LANE_FLOOR_MARGIN's guaranteed headroom band specifically, not the raw canvas
    // top and not the full laneVerticalOffset (which also includes any *extra* push-down a tall
    // canvas adds on top of the margin — this stays put regardless of that).
    const y = LANE_FLOOR_MARGIN / 2;

    const text = this.add
      .text(x, y, `${actorName} uses ${actionName}!`, {
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
            onComplete: () => {
              text.destroy();
              onDone();
            },
          });
        });
      },
    });
  }

  /** No actor lunge (it's self-inflicted) — just the HP hit and a brief pause so it reads as its own beat. */
  private playStatusTick(targetId: string, damage: number, effectId: StatusEffectId, onDone: () => void): void {
    const flashColor = effectId === 'poison' ? COLORS.poisonFlash : COLORS.burnFlash;
    this.applyHpDelta(targetId, -damage, flashColor);
    this.time.delayedCall(this.scaled(220), onDone);
  }

  private playAttack(actorId: string, targetId: string, damage: number, onDone: () => void): void {
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
    // `hit` is always true now (no more miss roll — see this file's ReplayEvent doc comment);
    // `damage` is what actually carries meaning, 0 meaning a Shield/Invulnerability/Dodge fully
    // blocked it.
    const dealtDamage = damage > 0;
    const isLethal = dealtDamage && (this.currentHp.get(targetId) ?? Infinity) <= damage;

    // The lunge tween animates both x and y on the same target, so Phaser creates one TweenData
    // per property and calls onYoyo once per property — i.e. twice per bounce, not once. Without
    // this guard, a landed hit's damage (and the blocked reaction) would be applied twice.
    let impactApplied = false;
    this.tweens.add({
      targets: actor,
      x: lungeX,
      y: lungeY,
      duration: this.scaled(160),
      yoyo: true,
      // A brief hold at the peak of the lunge, right as the hit lands, reads as a hit-stop beat
      // without freezing anything else in the scene — see the constants' comment above.
      hold: dealtDamage ? this.scaled(isLethal ? LETHAL_HIT_HOLD_MS : HIT_HOLD_MS) : 0,
      ease: 'Quad.easeOut',
      onYoyo: () => {
        if (impactApplied) return;
        impactApplied = true;
        if (dealtDamage) {
          this.applyHpDelta(targetId, -damage, COLORS.attackFlash);
        } else {
          this.showBlockedText(targetId);
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

    this.pulseSoftGlow(COLORS.healFlash);
    this.applyHpDelta(targetId, amount, COLORS.healFlash);

    this.tweens.add({
      targets: actor,
      scale: 1.25,
      duration: this.scaled(180),
      yoyo: true,
      ease: 'Quad.easeOut',
      onComplete: onDone,
    });
  }

  /** Updates the status badge (bar + text), flashes the grid sprite, and floats a damage/heal number — plus, for damage, shakes the camera (more for a killing blow) and plays a death-fall on the grid sprite if this brings HP to 0. */
  private applyHpDelta(unitId: string, delta: number, flashColor: number): void {
    const unit = this.sceneData.units.find((u) => u.id === unitId);
    const bar = this.badgeHealthBars.get(unitId);
    const hpText = this.badgeHpTexts.get(unitId);
    const gridSprite = this.gridSprites.get(unitId);
    const gridContainer = this.gridContainers.get(unitId);
    if (!unit || !bar || !hpText) {
      return;
    }

    const previousHp = this.currentHp.get(unitId) ?? unit.hp;
    const newHp = Math.max(0, Math.min(unit.maxHp, previousHp + delta));
    this.currentHp.set(unitId, newHp);
    const ratio = unit.maxHp > 0 ? newHp / unit.maxHp : 0;
    const isLethal = delta < 0 && newHp <= 0;

    this.tweens.add({ targets: bar, width: BADGE_HP_BAR_WIDTH * ratio, duration: this.scaled(220) });
    hpText.setText(`${newHp}/${unit.maxHp}`);

    const rageText = this.badgeRageTexts.get(unitId);
    if (rageText) {
      rageText.setText(this.rageLabel(newHp, unit.maxHp));
    }

    if (gridContainer && delta !== 0) {
      this.showDamageNumber(gridContainer.x, gridContainer.y - CELL_SIZE * 0.6, delta, colorToCss(flashColor));
      const burstY = gridContainer.y - CELL_SIZE * 0.5;
      if (delta < 0) {
        this.burstSparks(
          gridContainer.x,
          burstY,
          flashColor,
          isLethal ? LETHAL_BURST_COUNT : HIT_BURST_COUNT,
          isLethal ? LETHAL_BURST_LIFESPAN_MS : BURST_LIFESPAN_MS,
        );
      } else {
        this.burstSparks(gridContainer.x, burstY, flashColor, HEAL_BURST_COUNT, BURST_LIFESPAN_MS);
      }
    }

    if (delta < 0) {
      this.cameras.main.shake(
        this.scaled(isLethal ? LETHAL_SHAKE_DURATION_MS : SHAKE_DURATION_MS),
        isLethal ? LETHAL_SHAKE_INTENSITY : SHAKE_INTENSITY,
      );
      if (isLethal) {
        this.pulseLethalGlow();
      }
    }

    // Back on their feet (a Revive or Second Wind): undo the death-fall.
    if (previousHp <= 0 && newHp > 0 && gridSprite) {
      this.tweens.add({ targets: gridSprite, angle: 0, alpha: 1, duration: this.scaled(DEATH_FALL_DURATION_MS), ease: 'Cubic.easeOut' });
    }

    if (newHp <= 0 && gridSprite) {
      const fallAngle = unit.side === 'party' ? -DEATH_FALL_ANGLE_DEG : DEATH_FALL_ANGLE_DEG;
      this.tweens.add({
        targets: gridSprite,
        angle: fallAngle,
        alpha: DOWNED_ALPHA,
        duration: this.scaled(DEATH_FALL_DURATION_MS),
        ease: 'Cubic.easeIn',
      });
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

  /** Floats a "Blocked" label up from the target's grid position and fades it out — the only feedback a Shield/Invulnerability/Dodge that fully negated a hit gets (there's no more "Miss" — every attack always connects, see sim/action.ts's doc comments on the "pure auto-battler" pass). */
  private showBlockedText(unitId: string): void {
    const container = this.gridContainers.get(unitId);
    if (!container) return;

    this.floatText(container.x, container.y - CELL_SIZE * 0.6, 'Blocked', '#cccccc');
  }

  /** Floats `text` upward from `(x, y)` and fades it out — shared by the Blocked popup and the turn-start banner. */
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
