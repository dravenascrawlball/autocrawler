import type { AdventurerTemplate } from '../sim/adventurer';
import {
  AttackNearestAction,
  AttackLowestHpAction,
  PowerAttackAction,
  RangedShotAction,
  CleaveAction,
  RallyingStrikeAction,
  PiercingStrikeAction,
  PickpocketStrikeAction,
  GildedStrikeAction,
  BlindingBoltAction,
  CardThrowAction,
  MourningStrikeAction,
  SneakStrikeAction,
  FocusedShotAction,
} from '../sim/actions/attack';
import { HealAction, SelfHealAction, MendingChargeAction } from '../sim/actions/heal';
import { PotionTossAllyAction, PotionTossEnemyAction } from '../sim/actions/support';
import { plainFaces } from '../sim/dieFace';
import { RAGE_TRAIT, THORNS_TRAIT, DODGE_TRAIT } from '../sim/traits';
import {
  DAWNETH_MOURNING_STRIKE_SPECIAL,
  DAWNETH_GUARDIANS_VOW_SPECIAL,
  DAWNETH_MENDING_CHARGE_SPECIAL,
  BODIL_SECOND_WIND_SPECIAL,
  BODIL_TAUNT_SPECIAL,
  FALLACY_EMPOWER_SPECIAL,
  FALLACY_COMMAND_SPECIAL,
  FALLACY_SILENCE_SPECIAL,
  NERISSA_GILDED_STRIKE_SPECIAL,
  NERISSA_CHAIN_STRIKE_SPECIAL,
  MIRA_POTION_TOSS_ALLY_SPECIAL,
  MIRA_REVIVE_SPECIAL,
  MIRA_SPLASH_HEAL_SPECIAL,
  CALADWEN_VENOM_STING_SPECIAL,
  CALADWEN_LIFESTEAL_SPECIAL,
  ISILWEN_LUCKY_DRAW_SPECIAL,
  ISILWEN_MARK_SPECIAL,
  GLINT_GUARD_UP_SPECIAL,
  GLINT_SHIELD_WALL_SPECIAL,
  MIRKA_LAST_STAND_SPECIAL,
  MIRKA_STUN_SPECIAL,
  MIRKA_FEAR_SPECIAL,
  DRAVENA_ARCANE_BARRAGE_SPECIAL,
  DRAVENA_VANISH_SPECIAL,
  MELPOMENE_HUNTERS_INSTINCT_SPECIAL,
  MELPOMENE_SCATTER_SHOT_SPECIAL,
  THARAVEL_COORDINATED_STRIKE_SPECIAL,
  THARAVEL_GUARDIANS_WARD_SPECIAL,
  THARAVEL_INSPIRE_SPECIAL,
  DRIFTA_OPENING_STRIKE_SPECIAL,
  DRIFTA_EXECUTE_STRIKE_SPECIAL,
} from './specialActions';

/**
 * Named, hand-authored player characters — replaces the old randomly
 * generated archetype system. Each is a fixed individual: stats, die
 * faces, and recruit cost never vary between playthroughs, and their
 * `name` doubles as their asset-lookup key (see Adventurer.archetype) —
 * portrait/sprite files are named after them directly (e.g.
 * `gudrun-idle.png`, `gudrun.png`), not their `role`. Add new recruitable
 * characters here as they're designed; `unlocked` is a stub until real
 * unlock conditions exist.
 */

/**
 * 6 die faces, 3 Power Attack / 3 Attack Nearest — a coin-flip between a
 * heavy hit on the weakest enemy and a cheap hit on the nearest one each
 * turn. Deliberately mirrors the ~48-52% Power Attack rate measured under
 * the old energy-deck system (roadmap item 6), so the starter feel doesn't
 * shift just from the dice migration itself. One Power Attack face is
 * enchanted Burning — a proof-of-concept example for the enchantment system
 * (roadmap item 7 Phase 4), not a balance choice; players can freely
 * re-enchant/un-enchant any face via the Dice Faces view.
 *
 * Signature mechanic (roadmap item 11): RAGE_TRAIT — every attack she makes
 * hits harder the lower her own HP drops, up to +50% at the brink of being
 * downed. See traits.ts/actions/attack.ts. Seeded unconditionally via
 * `traits` (not pool-drawn) since it's her defining identity, not meant to
 * be a coin-flip against her second ability. Second ability
 * (docs/kit-trait-tag-framework.md's second-Special pass — the
 * Reflect/Thorns ability type): THORNS_TRAIT, a true passive like Rage, so
 * it's a trait-kind pool entry rather than a triggered Special Action —
 * see traits.ts's THORNS_TRAIT doc comment for why. Single-entry pool
 * today (always granted), same as every other character's sole first
 * ability before a real second pool entry exists.
 */
export const GUDRUN_TEMPLATE: AdventurerTemplate = {
  name: 'Gudrun',
  role: 'Fighter',
  maxHp: 20,
  attackPower: 5,
  speed: 5,
  actions: ['power-attack', 'attack-nearest'],
  dieFaces: [
    { action: PowerAttackAction, enchantmentId: 'burning' },
    ...plainFaces(PowerAttackAction, 2),
    ...plainFaces(AttackNearestAction, 3),
  ],
  bonusFaces: [AttackLowestHpAction],
  recruitCost: 50,
  unlocked: true,
  basicAction: PowerAttackAction,
  traits: [RAGE_TRAIT],
  specialActionPool: [{ kind: 'trait', trait: THORNS_TRAIT }],
};

/**
 * Dawneth — Healer, a "lane guardian" (the healer redesign — see
 * docs/roadmap.md). Basic Action is a plain Attack Nearest, so she always
 * contributes damage like everyone else; her heal is an always-on Special
 * instead (innateSpecialActions): Mending Charge every turn heals her
 * guard — the ally standing directly in front of her in her lane — or the
 * lowest-HP hurt ally, and banks energy (see actions/heal.ts). Pool
 * Special, one drawn at join: Mourning Strike (spends that energy as
 * damage) or Guardian's Vow (shields her guard, scaled by energy —
 * replaced Cleanse). Best placed directly behind a tank.
 */
export const DAWNETH_TEMPLATE: AdventurerTemplate = {
  name: 'Dawneth',
  role: 'Healer',
  maxHp: 21,
  attackPower: 4,
  speed: 4,
  healPower: 10,
  actions: ['mending-charge', 'mourning-strike'],
  dieFaces: [...plainFaces(MendingChargeAction, 4), ...plainFaces(MourningStrikeAction, 2)],
  recruitCost: 65,
  unlocked: true,
  basicAction: AttackNearestAction,
  innateSpecialActions: [DAWNETH_MENDING_CHARGE_SPECIAL],
  specialActionPool: [
    { kind: 'special-action', specialAction: DAWNETH_MOURNING_STRIKE_SPECIAL },
    { kind: 'special-action', specialAction: DAWNETH_GUARDIANS_VOW_SPECIAL },
  ],
};

/**
 * Isilwen — Rogue (roadmap item 11's tenth bespoke kit; a role
 * reassignment flagged back when the target roster was first recorded —
 * she used to be a plain Ranger). "Chaotic ranged rogue": Card Throw hits
 * a uniformly random living enemy, front or back row alike, with a much
 * wider damage swing than a normal attack (see actions/attack.ts's
 * CardThrowAction). Kept her original Ranger stats — the reassignment is
 * about her kit, not a stat rework. Second Special
 * (docs/kit-trait-tag-framework.md's second-Special pass): Mark, a pure
 * vulnerability debuff — distinct from Lucky Draw's bonus-shot flavor.
 */
export const ISILWEN_TEMPLATE: AdventurerTemplate = {
  name: 'Isilwen',
  role: 'Rogue',
  maxHp: 14,
  attackPower: 4,
  speed: 6,
  actions: ['card-throw', 'ranged-shot'],
  dieFaces: [...plainFaces(CardThrowAction, 4), ...plainFaces(RangedShotAction, 2)],
  recruitCost: 55,
  unlocked: true,
  // Rogue otherwise defaults front (see formation.ts's resolveDefaultRow), but her whole kit is
  // ranged (reach: 'ranged' on both Card Throw and Ranged Shot) — a front-line placement would
  // expose her to melee for no benefit.
  defaultRow: 'back',
  basicAction: CardThrowAction,
  specialActionPool: [
    { kind: 'special-action', specialAction: ISILWEN_LUCKY_DRAW_SPECIAL },
    { kind: 'special-action', specialAction: ISILWEN_MARK_SPECIAL },
  ],
};

/**
 * Tharavel — Tactician (roadmap item 11's twelfth bespoke kit). Her old
 * kit (1 Retreat / 5 Attack Nearest, the safety-net Tactician from
 * roadmap item 4) is fully replaced here. Basic Action is a plain Attack
 * Nearest (the "every Basic Action must deal damage" cleanup pass — see
 * docs/roadmap.md's Autobattle Revision Cleanup — moved her off Inspire,
 * which never damaged anything and could stalemate forever against a
 * sustain-only opponent). Inspire (raises the whole living party's
 * critChance at once — consolidated from a separate accuracy + crit pair
 * once Accuracy was removed as a baseline stat, the "pure auto-battler"
 * pass — see actions/support.ts's InspireAction) is now a Special Action
 * pool candidate instead, alongside Coordinated Strike and Guardian's Ward
 * (second-Special pass — a stand-in for her originally-intended
 * resource-denial pick, blocked on the charge-meter system not existing
 * yet). RetreatAction itself stays in the registry for any future
 * Tactician who wants it — it's just not on her die anymore.
 */
export const THARAVEL_TEMPLATE: AdventurerTemplate = {
  name: 'Tharavel',
  role: 'Tactician',
  maxHp: 15,
  attackPower: 3,
  speed: 5,
  actions: ['attack-nearest'],
  dieFaces: plainFaces(AttackNearestAction),
  recruitCost: 60,
  unlocked: true,
  basicAction: AttackNearestAction,
  specialActionPool: [
    { kind: 'special-action', specialAction: THARAVEL_INSPIRE_SPECIAL },
    { kind: 'special-action', specialAction: THARAVEL_COORDINATED_STRIKE_SPECIAL },
    { kind: 'special-action', specialAction: THARAVEL_GUARDIANS_WARD_SPECIAL },
  ],
};

/**
 * Bodil — Fighter (roadmap item 11's second bespoke kit). Tanky: more HP,
 * less attackPower than Gudrun. Signature mechanic: Cleave replaces Power
 * Attack (hits every living enemy in her target's row, each for full
 * damage — see actions/attack.ts's CleaveAction), plus a small Self-Heal
 * face that only fires once she's actually hurt (see actions/heal.ts's
 * SelfHealAction, sharing HealAction's 50%-HP threshold). Second Special
 * (docs/kit-trait-tag-framework.md's second-Special pass): Taunt, locking
 * enemy targeting onto her — the Tank archetype gap from that doc's part 3.
 */
export const BODIL_TEMPLATE: AdventurerTemplate = {
  name: 'Bodil',
  role: 'Fighter',
  maxHp: 30,
  attackPower: 4,
  speed: 4,
  healPower: 3,
  actions: ['cleave', 'attack-nearest', 'self-heal'],
  dieFaces: [
    ...plainFaces(CleaveAction, 2),
    ...plainFaces(AttackNearestAction, 3),
    ...plainFaces(SelfHealAction, 1),
  ],
  recruitCost: 55,
  unlocked: true,
  basicAction: CleaveAction,
  specialActionPool: [
    { kind: 'special-action', specialAction: BODIL_SECOND_WIND_SPECIAL },
    { kind: 'special-action', specialAction: BODIL_TAUNT_SPECIAL },
  ],
};

/**
 * Glint — Fighter (roadmap item 11's third bespoke kit). High-defense
 * sword-and-board, near-Paladin build: highest HP of the Fighter roster,
 * modest attackPower. Signature mechanic: Rallying Strike — a
 * normal melee hit on her target, plus a timed armor buff
 * (RALLY_ARMOR_BONUS for RALLY_BUFF_DURATION_TURNS turns) granted to the
 * whole living party at once, herself included (see actions/attack.ts's
 * RallyingStrikeAction / buffs.ts). Weighted 3/6 faces rather than 1-2 like
 * other signature moves, since it's not a pure support move at the cost of
 * her own damage output — it still lands a hit every time it fires.
 * Second Special (docs/kit-trait-tag-framework.md's second-Special pass):
 * Shield Wall, proactively granting Shield to whoever's weakest each turn
 * — a different flavor of protectiveness than Guard Up's reactive buff.
 */
export const GLINT_TEMPLATE: AdventurerTemplate = {
  name: 'Glint',
  role: 'Fighter',
  maxHp: 28,
  attackPower: 4,
  speed: 4,
  actions: ['rallying-strike', 'attack-nearest'],
  dieFaces: [...plainFaces(RallyingStrikeAction, 3), ...plainFaces(AttackNearestAction, 3)],
  recruitCost: 60,
  unlocked: true,
  basicAction: RallyingStrikeAction,
  specialActionPool: [
    { kind: 'special-action', specialAction: GLINT_GUARD_UP_SPECIAL },
    { kind: 'special-action', specialAction: GLINT_SHIELD_WALL_SPECIAL },
  ],
};

/**
 * Drifta — Fighter (roadmap item 11's fourth bespoke kit). High dodge:
 * seeded with DODGE_TRAIT (the "pure auto-battler" pass's replacement for
 * the old universal evasion stat — see traits.ts's doc comment) rather
 * than a baseline evasion number, same unconditional-seed convention as
 * Gudrun's Rage. Signature mechanic: Piercing Strike — while she's
 * assigned to the front row, reaches every living enemy (front or back)
 * and finishes off the lowest-HP one; a live check of her own row (see
 * actions/attack.ts's PiercingStrikeAction), so reassigning her to the
 * back row via Formation turns the special reach off (it falls back to a
 * normal front-row-restricted lowest-HP attack). Second Special
 * (docs/kit-trait-tag-framework.md's second-Special pass): Execute
 * Strike, finishing off already-weakened targets outright.
 */
export const DRIFTA_TEMPLATE: AdventurerTemplate = {
  name: 'Drifta',
  role: 'Fighter',
  maxHp: 20,
  attackPower: 4,
  speed: 5,
  actions: ['piercing-strike', 'attack-nearest'],
  dieFaces: [...plainFaces(PiercingStrikeAction, 3), ...plainFaces(AttackNearestAction, 3)],
  recruitCost: 55,
  unlocked: true,
  basicAction: PiercingStrikeAction,
  traits: [DODGE_TRAIT],
  specialActionPool: [
    { kind: 'special-action', specialAction: DRIFTA_OPENING_STRIKE_SPECIAL },
    { kind: 'special-action', specialAction: DRIFTA_EXECUTE_STRIKE_SPECIAL },
  ],
};

/**
 * Fallacy — Tactician (roadmap item 11's fifth bespoke kit). Support-first:
 * lowest attackPower of anyone, leans entirely on her signature moves.
 * Basic Action is a plain Attack Nearest (the "every Basic Action must deal
 * damage" cleanup pass — see docs/roadmap.md's Autobattle Revision
 * Cleanup — moved her off Empower, which never damaged anything and could
 * stalemate forever against a sustain-only opponent with nobody left to
 * buff). Empower (a timed attackPower buff to whichever living ally
 * currently hits hardest — see actions/support.ts's EmpowerAction), Command
 * (a bonus attack for a random living ally, never herself — see
 * CommandAction), and Silence (second-Special pass) are now all
 * Special Action pool candidates instead — one drawn at join, same as
 * every other character's pool.
 */
export const FALLACY_TEMPLATE: AdventurerTemplate = {
  name: 'Fallacy',
  role: 'Tactician',
  maxHp: 18,
  attackPower: 3,
  speed: 5,
  actions: ['attack-nearest'],
  dieFaces: plainFaces(AttackNearestAction),
  recruitCost: 60,
  unlocked: true,
  basicAction: AttackNearestAction,
  specialActionPool: [
    { kind: 'special-action', specialAction: FALLACY_EMPOWER_SPECIAL },
    { kind: 'special-action', specialAction: FALLACY_COMMAND_SPECIAL },
    { kind: 'special-action', specialAction: FALLACY_SILENCE_SPECIAL },
  ],
};

/**
 * Mirka — Fighter (roadmap item 11's sixth bespoke kit; also a role
 * reassignment flagged back when the target roster was first recorded —
 * she used to be a plain Healer clone). Front-row tank: highest HP of
 * anyone recruitable so far — her durability comes from raw HP rather
 * than dodging (that's Drifta's niche, see traits.ts's DODGE_TRAIT). Basic
 * Action is a plain Attack Nearest (the "every Basic Action must deal
 * damage" cleanup pass — see docs/roadmap.md's Autobattle Revision
 * Cleanup — moved her off Fear, which never damaged anything and could
 * stalemate forever against a sustain-only opponent). Fear (a pure debuff,
 * no attack of her own, applying a timed positive 'vulnerability'
 * StatModifier — the Mark ability type — to every living enemy in her
 * target's row at once, see actions/attack.ts's FearAction) is now a
 * Special Action pool candidate instead, alongside Last Stand and Stun
 * (second-Special pass).
 */
export const MIRKA_TEMPLATE: AdventurerTemplate = {
  name: 'Mirka',
  role: 'Fighter',
  maxHp: 28,
  attackPower: 4,
  speed: 3,
  actions: ['attack-nearest'],
  dieFaces: plainFaces(AttackNearestAction),
  recruitCost: 60,
  unlocked: true,
  basicAction: AttackNearestAction,
  specialActionPool: [
    { kind: 'special-action', specialAction: MIRKA_LAST_STAND_SPECIAL },
    { kind: 'special-action', specialAction: MIRKA_STUN_SPECIAL },
    { kind: 'special-action', specialAction: MIRKA_FEAR_SPECIAL },
  ],
};

/**
 * Nerissa — Rogue (roadmap item 11's seventh bespoke kit; also the first
 * use of the Rogue role label — a role reassignment flagged back when the
 * target roster was first recorded, she used to be a plain Ranger clone.
 * `role` is purely a display label at the sim level, so introducing it
 * needed no new infrastructure). "Econ rogue": Pickpocket Strike is a
 * normal attack that also rolls bonus gold on a landed hit (banked into
 * the run's gold regardless of outcome); Gilded Strike is a normal attack
 * whose damage scales with the town's banked gold, snapshotted at run
 * start (see actions/attack.ts's PickpocketStrikeAction/GildedStrikeAction
 * and battle.ts's BattleState.partyGold). Second Special
 * (docs/kit-trait-tag-framework.md's second-Special pass): Chain Strike,
 * spreading damage across multiple enemies at once.
 */
export const NERISSA_TEMPLATE: AdventurerTemplate = {
  name: 'Nerissa',
  role: 'Rogue',
  maxHp: 16,
  attackPower: 4,
  speed: 6,
  actions: ['pickpocket-strike', 'gilded-strike', 'attack-nearest'],
  dieFaces: [
    ...plainFaces(PickpocketStrikeAction, 2),
    ...plainFaces(GildedStrikeAction, 2),
    ...plainFaces(AttackNearestAction, 2),
  ],
  recruitCost: 60,
  unlocked: true,
  basicAction: PickpocketStrikeAction,
  specialActionPool: [
    { kind: 'special-action', specialAction: NERISSA_GILDED_STRIKE_SPECIAL },
    { kind: 'special-action', specialAction: NERISSA_CHAIN_STRIKE_SPECIAL },
  ],
};

/**
 * Dravena — Mage (roadmap item 11's ninth bespoke kit; also the first use
 * of the Mage role label — a wholly new recruitable character, not a role
 * reassignment. `role` is purely a display label at the sim level, so
 * introducing it needed no new infrastructure). Squishy caster: lowest HP
 * of anyone recruitable so far, highest base attackPower to compensate.
 * Signature mechanic: Blinding Bolt — a ranged single-target attack that
 * also applies a timed negative-attackPower StatModifier (Blind) to that
 * same target, but only on a landed hit (see actions/attack.ts's
 * BlindingBoltAction and buffs.ts). Second Special
 * (docs/kit-trait-tag-framework.md's second-Special pass — a stand-in for
 * her originally-intended elemental/damage-type pick, blocked on that
 * system not existing yet): Vanish, removing her from enemy targeting
 * entirely for a duration — a squishy caster's "blink away" trick.
 */
export const DRAVENA_TEMPLATE: AdventurerTemplate = {
  name: 'Dravena',
  role: 'Mage',
  maxHp: 12,
  attackPower: 6,
  speed: 5,
  actions: ['blinding-bolt', 'ranged-shot'],
  dieFaces: [...plainFaces(BlindingBoltAction, 3), ...plainFaces(RangedShotAction, 3)],
  recruitCost: 65,
  unlocked: true,
  basicAction: BlindingBoltAction,
  specialActionPool: [
    { kind: 'special-action', specialAction: DRAVENA_ARCANE_BARRAGE_SPECIAL },
    { kind: 'special-action', specialAction: DRAVENA_VANISH_SPECIAL },
  ],
};

/**
 * Caladwen — Rogue (roadmap item 3's remaining bespoke kit; a role
 * reassignment from a plain Healer clone — she used to be a
 * `healerTemplate()` instance). Quick, unpredictable attacker: Sneak
 * Strike usually lands a normal front-row hit, but has a chance to slip
 * past the front line and strike a random back-row enemy directly instead
 * (see actions/attack.ts's SneakStrikeAction). Used to also carry a
 * per-face Poison enchant (the dieFaces entry below still shows it, now
 * inert — per-face enchantments stopped mattering once the turn engine
 * stopped reading dieFaces at all, step 2 of the combat overhaul) — Venom
 * Sting restores that identity as a proper Special Action instead (see
 * data/specialActions.ts). Second Special
 * (docs/kit-trait-tag-framework.md's second-Special pass): Lifesteal
 * Strike, a melee attack that sustains her own HP — genuine variety from
 * Venom Sting's damage-over-time flavor, not a reskin.
 */
export const CALADWEN_TEMPLATE: AdventurerTemplate = {
  name: 'Caladwen',
  role: 'Rogue',
  maxHp: 15,
  attackPower: 4,
  speed: 6,
  actions: ['sneak-strike', 'attack-nearest'],
  dieFaces: [
    { action: SneakStrikeAction, enchantmentId: 'poison' },
    ...plainFaces(SneakStrikeAction, 3),
    ...plainFaces(AttackNearestAction, 2),
  ],
  recruitCost: 55,
  unlocked: true,
  basicAction: SneakStrikeAction,
  specialActionPool: [
    { kind: 'special-action', specialAction: CALADWEN_VENOM_STING_SPECIAL },
    { kind: 'special-action', specialAction: CALADWEN_LIFESTEAL_SPECIAL },
  ],
};

/**
 * Melpomene — Ranger (roadmap item 3's final bespoke kit; the first use of
 * the Ranger role label — a wholly new recruitable character, not a role
 * reassignment). Focuses down whoever's already weakest: Focused Shot
 * reaches either row directly like a normal ranged attack, but targets the
 * lowest-HP living enemy instead of the nearest one, at plain
 * (unmultiplied) attackPower rather than a Power-Attack-style bonus — see
 * actions/attack.ts's FocusedShotAction doc comment for why that's the
 * "lower-damage" trade-off. Ranger defaults to the back row (see
 * formation.ts's resolveDefaultRow), matching her fully-ranged kit. Second
 * Special (docs/kit-trait-tag-framework.md's second-Special pass): Scatter
 * Shot, full-damage AoE across multiple random enemies regardless of rank.
 */
export const MELEMNOPE_TEMPLATE: AdventurerTemplate = {
  name: 'Melpomene',
  role: 'Ranger',
  maxHp: 14,
  attackPower: 4,
  speed: 5,
  actions: ['focused-shot', 'ranged-shot'],
  dieFaces: [...plainFaces(FocusedShotAction, 4), ...plainFaces(RangedShotAction, 2)],
  recruitCost: 60,
  unlocked: true,
  basicAction: FocusedShotAction,
  specialActionPool: [
    { kind: 'special-action', specialAction: MELPOMENE_HUNTERS_INSTINCT_SPECIAL },
    { kind: 'special-action', specialAction: MELPOMENE_SCATTER_SHOT_SPECIAL },
  ],
};

/**
 * Mira — Healer, "splash potions" (the healer redesign — see
 * docs/roadmap.md). Basic Action is a plain Attack Nearest, so she always
 * contributes damage like everyone else; her heal is an always-on Special
 * instead (innateSpecialActions): Splash Heal heals the lowest-HP hurt
 * ally and splashes half as much onto every ally adjacent to them on the
 * grid (see actions/heal.ts) — stronger the bigger and tighter the party.
 * Pool Special, one drawn at join: Potion Toss (Ally) (a random buff on a
 * random ally) or Revive (brings a Downed ally back).
 */
export const MIRA_TEMPLATE: AdventurerTemplate = {
  name: 'Mira',
  role: 'Healer',
  maxHp: 16,
  attackPower: 3,
  speed: 4,
  healPower: 8,
  actions: ['heal', 'potion-toss-ally', 'potion-toss-enemy'],
  dieFaces: [
    ...plainFaces(HealAction, 2),
    ...plainFaces(PotionTossAllyAction, 2),
    ...plainFaces(PotionTossEnemyAction, 2),
  ],
  recruitCost: 65,
  unlocked: true,
  basicAction: AttackNearestAction,
  innateSpecialActions: [MIRA_SPLASH_HEAL_SPECIAL],
  specialActionPool: [
    { kind: 'special-action', specialAction: MIRA_POTION_TOSS_ALLY_SPECIAL },
    { kind: 'special-action', specialAction: MIRA_REVIVE_SPECIAL },
  ],
};

/**
 * Dee — secret bonus character, unlocked via the "Enter Code" redemption
 * flow in Settings rather than gold (see state/roster.ts's
 * redeemSecretCode). A wooden training mannequin dressed like an
 * adventurer; her name is short for "Default" — she reuses the game's
 * literal default-idle/default-town portraits and default_adventurer
 * sprite as her actual art (copied to dee-idle.png/dee-town.png/dee.png),
 * which is the joke, not a placeholder standing in for missing art.
 *
 * Kit is deliberately "one of everything": a plain face from each of the
 * game's most generic actions rather than a bespoke signature move — she's
 * the platonic default adventurer, with no specialization to speak of.
 * Highest maxHp in the roster and no Dodge/Thorns/other defensive
 * trait, leaning into "she's a slab of wood" — sturdy because she just
 * stands there and eats hits, not because she's skilled at avoiding them. An
 * easter egg, not a balance-tuned addition; `unlocked: false` keeps her out
 * of createStarterRoster and the recruitment pool until redeemed.
 */
export const DEE_TEMPLATE: AdventurerTemplate = {
  name: 'Dee',
  role: 'Adventurer',
  maxHp: 32,
  attackPower: 3,
  speed: 4,
  healPower: 2,
  actions: ['attack-nearest', 'power-attack', 'ranged-shot', 'self-heal'],
  dieFaces: [
    ...plainFaces(AttackNearestAction, 3),
    ...plainFaces(PowerAttackAction, 1),
    ...plainFaces(RangedShotAction, 1),
    ...plainFaces(SelfHealAction, 1),
  ],
  unlocked: false,
  basicAction: AttackNearestAction,
};

/** Every named character currently defined, recruitable or already in the starter roster. */
export const CHARACTER_TEMPLATES: AdventurerTemplate[] = [
  GUDRUN_TEMPLATE,
  DAWNETH_TEMPLATE,
  ISILWEN_TEMPLATE,
  THARAVEL_TEMPLATE,
  NERISSA_TEMPLATE,
  CALADWEN_TEMPLATE,
  BODIL_TEMPLATE,
  GLINT_TEMPLATE,
  DRIFTA_TEMPLATE,
  FALLACY_TEMPLATE,
  MIRKA_TEMPLATE,
  DRAVENA_TEMPLATE,
  MELEMNOPE_TEMPLATE,
  MIRA_TEMPLATE,
  DEE_TEMPLATE,
];
