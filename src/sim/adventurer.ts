import type { Action, ActionId } from './action';
import type { Row, RowOrPosition, GridPosition } from './formation';
import { resolvePosition } from './formation';
import type { StatModifier } from './stats';
import { getEffectiveStat } from './stats';
import type { EquipmentSlots, LootTableEntry } from './items';
import { createEmptyEquipmentSlots } from './items';
import type { GoldDropTable } from './gold';
import type { Trait } from './traits';
import { rollTraits, UNIVERSAL_TRAIT_ROLL_CAP } from './traits';
import type { TagId } from './tags';
import type { Aura, AppliedAura } from './auras';
import type { Kit } from './kits';
import { pickKit, applyKit } from './kits';
import type { ActiveShield } from './shields';
import type { DieFace } from './dieFace';
import { dominantFaceIndex } from './dieFace';
import type { ActiveStatusEffect } from './statusEffects';
import type { ActiveBuff } from './buffs';
import type { SpecialAction } from './specialActions';
import type { CharacterPoolEntry } from './characterPool';
import { pickPoolEntry } from './characterPool';
import type { RngSource } from './rng';

export interface Adventurer {
  id: string;
  name: string;
  /** Asset-lookup key for portraits/sprites — a character's own slug identity (e.g. "gudrun"), stable for life since named characters are never renamed. Also just `name` itself for enemies, which share art across every instance of their kind. */
  archetype: string;
  /** Display class/role label (e.g. "Fighter"), shown alongside `name` as "Gudrun the Fighter". Empty for enemies, which have no separate role from their name. */
  role: string;
  /** Where this combatant stands on its side's 3x3 grid — see formation.ts. Player-assignable for party members (state/townActions.ts's setAdventurerPosition); fixed per room composition for enemies. */
  position: GridPosition;
  /**
   * The action the turn engine always resolves, deterministically, every
   * turn — see turnEngine.ts's resolveTurn. Set once at creation from
   * `template.basicAction` if declared, else derived from whichever action
   * dominates `dieFaces` (see dieFace.ts's dominantFaceIndex) — stable for
   * the adventurer's lifetime regardless of later face swaps via equipment
   * or leveling, unlike the old per-turn dice roll it replaced.
   */
  basicAction: Action;
  hp: number;
  maxHp: number;
  attackPower: number;
  speed: number;
  /** Percentage chance a landed hit is a critical (see actions/attack.ts's applyAttackToTarget) — a universal stat, small baseline for everyone (roadmap item 11's Tharavel raises it, but every character/enemy already has some). */
  critChance: number;
  /** Base heal amount for HealAction — separate from attackPower so a dual-role unit's attack and heal output can be tuned independently (see actions/heal.ts). 0 for anything without a heal action. */
  healPower: number;
  actions: ActionId[];
  modifiers: StatModifier[];
  /**
   * Exactly 6 die faces; the turn engine rolls one uniformly at random each
   * turn and attempts whatever action is on it. The same action can occupy
   * multiple faces for weighted odds — see data/characters.ts/enemies.ts
   * for each character/archetype's split. Each face can independently carry an
   * enchantment (see dieFace.ts/enchantments.ts) — always its own object,
   * never shared across faces or adventurer instances (see createAdventurer).
   */
  dieFaces: DieFace[];
  /**
   * Every Face this adventurer owns, as a multiset (duplicate entries mean
   * multiple copies) — the supply swapInAction draws from. The 6 currently
   * on `dieFaces` are themselves owned copies; a Face not currently slotted
   * anywhere is a spare, available to swap in. Grown via a 'new-face'
   * level-up choice (see leveling.ts's resolveUpgradeChoice) — there's no
   * other source yet (loot doesn't grant actions).
   */
  ownedFaces: Action[];
  /** Currently active damage-over-time-style afflictions (e.g. Burn from the Burning enchantment) — see statusEffects.ts. */
  statusEffects: ActiveStatusEffect[];
  /** Currently active timed StatModifier grants (e.g. Glint's Rallying Strike armor buff) — see buffs.ts. */
  buffs: ActiveBuff[];
  /** Currently active depletable damage-absorb pools (e.g. Glint's Shield Wall) — see shields.ts. */
  shields: ActiveShield[];
  /**
   * Trigger+effect kit granted at join time, evaluated by the turn engine
   * alongside (never instead of) the deterministic Basic Action every turn
   * — see specialActions.ts. Just one entry everywhere today (nothing
   * populates more than one yet; multi-slot support is a later concern),
   * kept as an array since resolveSpecialActionTriggers already fires every
   * matching entry rather than assuming exactly one.
   */
  activeSpecialActions: SpecialAction[];
  /** Bumped by levelUpAdventurer (see leveling.ts) when the between-room shop's Recruit section draws a duplicate of this adventurer — scoped to the run, reset by resetToTemplateBaseline. */
  level: number;
  /** Per-action level counters — see leveling.ts's actionLevelPercentBonus, read directly by actions/attack.ts and heal.ts. */
  actionLevels: Partial<Record<ActionId, number>>;
  /** Permanent narrative-flavored markers granted by game events (e.g. SURVIVOR_TRAIT on rescue) — see traits.ts. */
  traits: Trait[];
  /**
   * Labels carried by this unit — species/archetype/element/physical/
   * personality, a mix of mechanical-synergy and pure-flavor (see
   * tags.ts). Sourced from the template's innate tags plus (once built)
   * whatever Kit/Trait is active; not mutated mid-run except by an
   * effect that explicitly grants/removes one.
   */
  tags: TagId[];
  /** Continuous party-wide effects this unit grants to tagged allies (including itself) — see auras.ts. Empty until Kits/Traits can carry one. */
  auras: Aura[];
  /** Aura modifiers currently applied to this unit, tracked for tickAuras to cleanly remove before recomputing — see auras.ts. */
  appliedAuras: AppliedAura[];
  /** The Kit (see kits.ts) drawn from the template's kitPool at creation, if any — undefined for a character with no kitPool (behaves exactly as before Kit existed). Rerolled on every resetToTemplateBaseline, same lifecycle as activeSpecialActions. */
  activeKit?: Kit;
  /** XP awarded to the party when this unit dies in a room win. Meaningful only for enemies. */
  xpReward?: number;
  /** Loot rolled independently on room win when this unit dies. Meaningful only for enemies. */
  lootTable?: LootTableEntry[];
  /** Gold rolled independently on room win when this unit dies. Meaningful only for enemies. */
  goldDrop?: GoldDropTable;
  /** One item per slot; swapping populates/vacates a run inventory, never town storage. The only thing that survives resetToTemplateBaseline — see its own doc comment. */
  equipment: EquipmentSlots;
  /** Cumulative damage this adventurer has dealt/taken and healing it has done this run. Meaningful only during an active run; zeroed by resetToTemplateBaseline once it ends. */
  runDamageDealt: number;
  runDamageTaken: number;
  runHealingDone: number;
  /**
   * Set the first time this adventurer's hp hits 0 during a run — captures
   * what happened for the post-room Downed popup (see DownedModal.svelte).
   * Never overwritten within a run (hp === 0 now lasts for the rest of the
   * run — see dungeonRun.ts's healBetweenRooms), and cleared by
   * resetToTemplateBaseline once the run ends, so a future down gets a
   * fresh summary.
   */
  downedSummary?: DownedSummary;
}

export interface DownedSummary {
  roomIndex: number;
  /** The enemy archetype (e.g. "Brute") whose attack landed the killing blow — null if a status effect (e.g. Burn) downed them instead, since that has no single attacker to credit. */
  killerArchetype: string | null;
  damageDone: number;
  damageTaken: number;
  healed: number;
  /** Whether the player has dismissed the popup for this down yet — see DungeonPauseView.svelte's one-at-a-time queue. */
  acknowledged: boolean;
}

export interface AdventurerTemplate {
  name: string;
  /** Display class/role label (e.g. "Fighter") — see Adventurer.role. Only meaningful for player characters; omitted for enemies. */
  role?: string;
  maxHp: number;
  attackPower: number;
  speed: number;
  /** Percentage chance a landed hit is a critical. Defaults to DEFAULT_CRIT_CHANCE if omitted — placeholder pending the balance pass (roadmap item 6/11). */
  critChance?: number;
  /** Base heal amount for HealAction. Defaults to DEFAULT_HEAL_POWER (0) if omitted — only archetypes/enemies with 'heal' in their deck need to set this. */
  healPower?: number;
  actions: ActionId[];
  /** Exactly 6 entries — see Adventurer.dieFaces. */
  dieFaces: DieFace[];
  /** Explicit, deliberately-authored Basic Action — see Adventurer.basicAction. Omit only for a template not yet retheme'd (e.g. an enemy), which falls back to dieFaces' dominant action. */
  basicAction?: Action;
  /** Candidates this character can be granted at join time — see characterPool.ts. Omit (or leave empty) for a character with no Special Action/Trait yet; a future meta-progression unlock grows this list over time. */
  specialActionPool?: CharacterPoolEntry[];
  /** Special Actions this character always has, on top of the one drawn from specialActionPool — e.g. a healer's every-turn heal alongside an attacking Basic Action (the healer redesign, docs/roadmap.md). */
  innateSpecialActions?: SpecialAction[];
  startingLevel?: number;
  xpReward?: number;
  lootTable?: LootTableEntry[];
  goldDrop?: GoldDropTable;
  /** Extra owned Faces from the start, beyond whatever already occupies a die face — see Adventurer.ownedFaces. */
  bonusFaces?: Action[];
  /** Fixed gold cost the town charges to recruit this character. Meaningful only for player character templates, not enemies. */
  recruitCost?: number;
  /** Whether this character can currently show up in the recruitment pool at all — a stub for future unlock conditions (e.g. story/quest gates); always `true` if omitted. Meaningful only for player character templates. */
  unlocked?: boolean;
  /** Innate traits this character starts every instance with (e.g. Gudrun's Rage) — distinct from SURVIVOR_TRAIT, which is granted by a game event rather than seeded on a template. */
  traits?: Trait[];
  /** Innate tags this character/archetype starts every instance with (e.g. a species tag) — see Adventurer.tags. */
  tags?: TagId[];
  /** Innate auras this character/archetype grants every instance — see Adventurer.auras. */
  auras?: Aura[];
  /** Candidates this character can be granted at join time, rerolled on every reset — see kits.ts. Omit (or leave empty) for a character with no Kit variety yet. */
  kitPool?: Kit[];
  /** Explicit starting formation row, overriding the role-based default (see formation.ts's resolveDefaultRow) — for a character whose kit doesn't fit their role's usual line (e.g. Isilwen, a fully-ranged Rogue). Omit to use the role default. */
  defaultRow?: Row;
}

/** Baseline critical-hit chance for anyone who doesn't set their own — a real (if small) part of combat for everyone, not just characters/enemies Tharavel has buffed. Placeholder pending the balance pass. */
export const DEFAULT_CRIT_CHANCE = 5;
const DEFAULT_HEAL_POWER = 0;

export function createAdventurer(
  id: string,
  template: AdventurerTemplate,
  position: RowOrPosition,
  modifiers: StatModifier[] = [],
  /** Meta-progression unlocks (see data/characterUnlocks.ts) to merge into the template's own pool — empty for a character who hasn't unlocked anything yet (or isn't tracked by meta-progression at all, e.g. an enemy). */
  unlockedPoolEntries: CharacterPoolEntry[] = [],
  /** Universal Traits (see data/traits.ts's UNIVERSAL_TRAIT_POOL) to roll from, independent of unlockedPoolEntries/specialActionPool — empty for a character not meant to participate (e.g. Dee, or an enemy). */
  universalTraitPool: Trait[] = [],
  rng: RngSource = () => Math.random(),
  /** Kits bought from the Shop with Renown (see data/kitShop.ts, state/metaProgression.ts) to merge into the template's own kitPool — empty for a character with no Kit unlocks yet (or an enemy). */
  unlockedKits: Kit[] = [],
): Adventurer {
  const level = template.startingLevel ?? 1;
  const ownedFaces: Action[] = [...template.dieFaces.map((face) => face.action), ...(template.bonusFaces ?? [])];
  const basicAction = template.basicAction ?? template.dieFaces[dominantFaceIndex(template.dieFaces)].action;
  const poolEntry = pickPoolEntry([...(template.specialActionPool ?? []), ...unlockedPoolEntries], rng);
  const activeKit = pickKit([...(template.kitPool ?? []), ...unlockedKits], rng);
  const rolledTraits = rollTraits(universalTraitPool, UNIVERSAL_TRAIT_ROLL_CAP, rng);

  return {
    id,
    name: template.name,
    archetype: template.name,
    role: activeKit?.role ?? template.role ?? '',
    position: resolvePosition(position),
    basicAction,
    hp: template.maxHp,
    maxHp: template.maxHp,
    attackPower: template.attackPower,
    speed: template.speed,
    critChance: template.critChance ?? DEFAULT_CRIT_CHANCE,
    healPower: template.healPower ?? DEFAULT_HEAL_POWER,
    actions: [...template.actions],
    modifiers: [...modifiers, ...(activeKit?.modifiers ?? [])],
    // Cloned per face: enchanting one instance's face must never affect the template or another
    // instance built from the same template (e.g. every Grunt sharing GRUNT_TEMPLATE) — see dieFace.ts.
    dieFaces: template.dieFaces.map((face) => ({ ...face })),
    level,
    actionLevels: {},
    traits: [
      ...(template.traits ?? []),
      ...(poolEntry?.kind === 'trait' ? [poolEntry.trait] : []),
      ...rolledTraits,
    ],
    activeSpecialActions: [
      ...(template.innateSpecialActions ?? []),
      ...(poolEntry?.kind === 'special-action' ? [poolEntry.specialAction] : []),
    ],
    tags: [...(template.tags ?? []), ...(activeKit?.tags ?? [])],
    auras: [...(template.auras ?? [])],
    appliedAuras: [],
    activeKit: activeKit ?? undefined,
    xpReward: template.xpReward,
    lootTable: template.lootTable,
    goldDrop: template.goldDrop,
    equipment: createEmptyEquipmentSlots(),
    ownedFaces,
    statusEffects: [],
    buffs: [],
    shields: [],
    runDamageDealt: 0,
    runDamageTaken: 0,
    runHealingDone: 0,
    downedSummary: undefined,
  };
}

/**
 * Rebuilds `adventurer` in place back to `template`'s fresh baseline —
 * level (and any stat growth from it), equipment, every other run-scoped
 * stat — everything a run can change resets; only whatever
 * meta-progression has unlocked (see `unlockedPoolEntries`) survives.
 * Called when a drafted party member returns to town (see
 * state/dungeonOrchestrator.ts's finishDungeonRun) — equipment is
 * deliberately run-scoped now, same as level-ups (Town Storage Cleanup,
 * see docs/roadmap.md): gear found or bought mid-run never carries
 * forward, there's no town-side equip step anymore. The rebuild re-rolls
 * `activeSpecialActions`/`activeKit`/`traits` (both the special-action-pool
 * trait and the universal-pool ones) from the combined template +
 * unlocked pool (see createAdventurer), so a character who just unlocked
 * something new has a real chance of getting it on their very next run,
 * not just after their *next* reset.
 */
export function resetToTemplateBaseline(
  adventurer: Adventurer,
  template: AdventurerTemplate,
  unlockedPoolEntries: CharacterPoolEntry[] = [],
  universalTraitPool: Trait[] = [],
  rng: RngSource = () => Math.random(),
  unlockedKits: Kit[] = [],
): void {
  Object.assign(
    adventurer,
    createAdventurer(
      adventurer.id,
      template,
      adventurer.position,
      [],
      unlockedPoolEntries,
      universalTraitPool,
      rng,
      unlockedKits,
    ),
  );
}

/**
 * Re-draws `adventurer`'s random pool picks in place — their pool Special
 * Action/Trait (from the template's specialActionPool plus
 * `unlockedPoolEntries`) and their Kit (template kitPool plus
 * `unlockedKits`) — leaving everything else alone (innate Specials, seeded
 * and universal Traits, stats, level). Used when a character shows up in a
 * shop's recruit offers without being in the party (the unlock content
 * pass — see state/progression.ts's rerollOfferedCharacters): passing on
 * someone and seeing them again later gives a fresh roll, not the same one.
 * A no-op for a character with no pool and no Kits.
 */
export function rerollPoolPicks(
  adventurer: Adventurer,
  template: AdventurerTemplate,
  unlockedPoolEntries: CharacterPoolEntry[],
  unlockedKits: Kit[],
  rng: RngSource,
): void {
  const pool = [...(template.specialActionPool ?? []), ...unlockedPoolEntries];
  if (pool.length > 0) {
    const poolSpecialIds = new Set(pool.flatMap((entry) => (entry.kind === 'special-action' ? [entry.specialAction.id] : [])));
    const poolTraitIds = new Set(pool.flatMap((entry) => (entry.kind === 'trait' ? [entry.trait.id] : [])));
    const seededTraitIds = new Set((template.traits ?? []).map((trait) => trait.id));
    adventurer.activeSpecialActions = adventurer.activeSpecialActions.filter((special) => !poolSpecialIds.has(special.id));
    adventurer.traits = adventurer.traits.filter((trait) => seededTraitIds.has(trait.id) || !poolTraitIds.has(trait.id));

    const picked = pickPoolEntry(pool, rng);
    if (picked?.kind === 'special-action') adventurer.activeSpecialActions = [...adventurer.activeSpecialActions, picked.specialAction];
    if (picked?.kind === 'trait') adventurer.traits = [...adventurer.traits, picked.trait];
  }

  const kit = pickKit([...(template.kitPool ?? []), ...unlockedKits], rng);
  if (kit) applyKit(adventurer, template, kit);
}

/** `adventurer`'s max HP with every modifier applied (Kit, gear, relics, buffs) — what HP is actually capped at, and what HP displays should show as the max. */
export function effectiveMaxHp(adventurer: Adventurer): number {
  return getEffectiveStat(adventurer.maxHp, 'maxHp', adventurer.modifiers);
}


/**
 * Duplicate stars (roadmap item 6, in-run snowballing): when a duplicate
 * recruit takes `adventurer` to 2★ (see leveling.ts's levelUpAdventurer and
 * state/dungeonOrchestrator.ts's buyRecruitOffer), they draw a second,
 * different Special Action from `pool` (their template pool plus earned
 * unlocks) and keep both for the rest of the run. Returns the Special
 * gained, or null if the pool has no other Special to give.
 */
export function grantSecondPoolSpecial(
  adventurer: Adventurer,
  pool: CharacterPoolEntry[],
  rng: RngSource,
): SpecialAction | null {
  const activeIds = new Set(adventurer.activeSpecialActions.map((special) => special.id));
  const candidates = pool.flatMap((entry) =>
    entry.kind === 'special-action' && !activeIds.has(entry.specialAction.id) ? [entry.specialAction] : [],
  );
  if (candidates.length === 0) return null;
  const picked = candidates[Math.floor(rng() * candidates.length)];
  adventurer.activeSpecialActions = [...adventurer.activeSpecialActions, picked];
  return picked;
}
