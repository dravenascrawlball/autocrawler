import type { Action, ActionId } from './action';
import type { Row } from './formation';
import type { StatModifier } from './stats';
import type { PassiveAbility, UpgradeChoice } from './leveling';
import { xpToNextLevel } from './leveling';
import type { EquipmentSlots, LootTableEntry } from './items';
import { createEmptyEquipmentSlots } from './items';
import { applyFaceEffect } from './partyManagement';
import type { GoldDropTable } from './gold';
import type { Trait } from './traits';
import type { DieFace } from './dieFace';
import type { ActiveStatusEffect } from './statusEffects';
import type { ActiveBuff } from './buffs';

export interface Adventurer {
  id: string;
  name: string;
  /** Asset-lookup key for portraits/sprites — a character's own slug identity (e.g. "gudrun"), stable for life since named characters are never renamed. Also just `name` itself for enemies, which share art across every instance of their kind. */
  archetype: string;
  /** Display class/role label (e.g. "Fighter"), shown alongside `name` as "Gudrun the Fighter". Empty for enemies, which have no separate role from their name. */
  role: string;
  /** Which line this combatant fights from — see formation.ts. Player-assignable for party members (state/townActions.ts's setAdventurerRow); fixed per room composition for enemies. */
  row: Row;
  hp: number;
  maxHp: number;
  attackPower: number;
  speed: number;
  /** Percentage points of base hit chance against a target's evasion (see actions/attack.ts's hitChance). */
  accuracy: number;
  /** Percentage points subtracted from an attacker's accuracy when this unit is the target. */
  evasion: number;
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
  xp: number;
  level: number;
  /** XP required, from the current `xp`, to reach `level + 1`. */
  xpToNextLevel: number;
  /** Unresolved upgrade points from level-ups; spent via resolveUpgradeChoice. */
  pendingUpgradeChoices: UpgradeChoice[];
  /** Per-action level counters, bumped by resolving an action-level upgrade choice. */
  actionLevels: Partial<Record<ActionId, number>>;
  passives: PassiveAbility[];
  /** Permanent narrative-flavored markers granted by game events (e.g. SURVIVOR_TRAIT on rescue) — see traits.ts. */
  traits: Trait[];
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
  xpGained: number;
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
  /** Percentage points of base hit chance against a target's evasion. Defaults to DEFAULT_ACCURACY if omitted — placeholder pending the balance pass (roadmap item 6). */
  accuracy?: number;
  /** Percentage points subtracted from an attacker's accuracy when this unit is the target. Defaults to DEFAULT_EVASION if omitted. */
  evasion?: number;
  /** Percentage chance a landed hit is a critical. Defaults to DEFAULT_CRIT_CHANCE if omitted — placeholder pending the balance pass (roadmap item 6/11). */
  critChance?: number;
  /** Base heal amount for HealAction. Defaults to DEFAULT_HEAL_POWER (0) if omitted — only archetypes/enemies with 'heal' in their deck need to set this. */
  healPower?: number;
  actions: ActionId[];
  /** Exactly 6 entries — see Adventurer.dieFaces. */
  dieFaces: DieFace[];
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
  /** Explicit starting formation row, overriding the role-based default (see formation.ts's resolveDefaultRow) — for a character whose kit doesn't fit their role's usual line (e.g. Isilwen, a fully-ranged Rogue). Omit to use the role default. */
  defaultRow?: Row;
}

/** Placeholder pending the balance pass (roadmap item 6) — used when a template omits accuracy/evasion. */
const DEFAULT_ACCURACY = 85;
const DEFAULT_EVASION = 0;
/** Baseline critical-hit chance for anyone who doesn't set their own — a real (if small) part of combat for everyone, not just characters/enemies Tharavel has buffed. Placeholder pending the balance pass. */
export const DEFAULT_CRIT_CHANCE = 5;
const DEFAULT_HEAL_POWER = 0;

export function createAdventurer(
  id: string,
  template: AdventurerTemplate,
  row: Row,
  modifiers: StatModifier[] = [],
): Adventurer {
  const level = template.startingLevel ?? 1;
  const ownedFaces: Action[] = [...template.dieFaces.map((face) => face.action), ...(template.bonusFaces ?? [])];

  return {
    id,
    name: template.name,
    archetype: template.name,
    role: template.role ?? '',
    row,
    hp: template.maxHp,
    maxHp: template.maxHp,
    attackPower: template.attackPower,
    speed: template.speed,
    accuracy: template.accuracy ?? DEFAULT_ACCURACY,
    evasion: template.evasion ?? DEFAULT_EVASION,
    critChance: template.critChance ?? DEFAULT_CRIT_CHANCE,
    healPower: template.healPower ?? DEFAULT_HEAL_POWER,
    actions: [...template.actions],
    modifiers: [...modifiers],
    // Cloned per face: enchanting one instance's face must never affect the template or another
    // instance built from the same template (e.g. every Grunt sharing GRUNT_TEMPLATE) — see dieFace.ts.
    dieFaces: template.dieFaces.map((face) => ({ ...face })),
    xp: 0,
    level,
    xpToNextLevel: xpToNextLevel(level),
    pendingUpgradeChoices: [],
    actionLevels: {},
    passives: [],
    traits: [...(template.traits ?? [])],
    xpReward: template.xpReward,
    lootTable: template.lootTable,
    goldDrop: template.goldDrop,
    equipment: createEmptyEquipmentSlots(),
    ownedFaces,
    statusEffects: [],
    buffs: [],
    runDamageDealt: 0,
    runDamageTaken: 0,
    runHealingDone: 0,
    downedSummary: undefined,
  };
}

/**
 * Rebuilds `adventurer` in place back to `template`'s fresh baseline —
 * level, XP, action-levels, earned Faces, passives, run-scoped stats,
 * everything a run can change resets; only `equipment` (and the row the
 * player last assigned) survives. Called when a drafted party member
 * returns to town (see state/dungeonOrchestrator.ts's finishDungeonRun),
 * so equipping gear is the only cross-run progression lever left — level-
 * ups are deliberately scoped to a single run.
 */
export function resetToTemplateBaseline(adventurer: Adventurer, template: AdventurerTemplate): void {
  const equipment = adventurer.equipment;
  Object.assign(adventurer, createAdventurer(adventurer.id, template, adventurer.row));

  adventurer.equipment = equipment;
  for (const item of Object.values(equipment)) {
    if (item) {
      adventurer.modifiers = [...adventurer.modifiers, ...item.modifiers];
      if (item.faceEffect) {
        // The rebuild above already produced a clean baseline, so the snapshot is simply
        // whatever that fresh baseline put on this face — no risk of it being stale.
        item.faceEffect.previousFace = { ...adventurer.dieFaces[item.faceEffect.faceIndex] };
        applyFaceEffect(adventurer, item.faceEffect);
      }
    }
  }
}
