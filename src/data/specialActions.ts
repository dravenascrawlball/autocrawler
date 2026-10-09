import type { SpecialAction } from '../sim/specialActions';
import {
  MourningStrikeAction,
  GildedStrikeAction,
  AttackLowestHpAction,
  AttackNearestAction,
  PowerAttackAction,
  RangedShotAction,
  VenomStingAction,
  FocusedShotAction,
  LifestealStrikeAction,
  ExecuteStrikeAction,
  ChainStrikeAction,
  ScatterShotAction,
  FearAction,
  CardThrowAction,
  RallyingStrikeAction,
  PickpocketStrikeAction,
  SneakStrikeAction,
  VolleyAction,
  HellfireAction,
} from '../sim/actions/attack';
import { SelfHealAction, HealAction, CleanseAction, ReviveAction, MendingChargeAction, SplashHealAction, RegenerateAction } from '../sim/actions/heal';
import {
  CommandAction,
  PotionTossAllyAction,
  InspireAction,
  EmpowerAction,
  ShieldWallAction,
  GuardiansVowAction,
  VengeanceAction,
  TauntAction,
  MarkAction,
  SilenceAction,
  StunAction,
  GuardiansWardAction,
  VanishAction,
  BattleOrdersAction,
  WarBannerAction,
} from '../sim/actions/support';
import { EmberBurnAction } from '../sim/actions/itemEffects';
import { SummonImpAction } from './summons';

/**
 * Named player characters' Special Actions (see characterPool.ts) —
 * retheme of a signature mechanic that used to just occupy some of a
 * character's 6 die faces alongside their new Basic Action (see
 * data/characters.ts). Each wraps an existing, already-implemented Action
 * unchanged — only the trigger is new.
 */
export const DAWNETH_MOURNING_STRIKE_SPECIAL: SpecialAction = {
  id: 'dawneth-mourning-strike',
  name: 'Mourning Strike',
  trigger: 'on-turn-start',
  action: MourningStrikeAction,
};

/**
 * Dawneth's former second Special (docs/kit-trait-tag-framework.md's
 * second-Special pass — the Cleanse ability type). Replaced in her pool by
 * Guardian's Vow in the healer redesign (enemies inflict too few status
 * effects for it to matter yet); kept registered so saves that still
 * reference it load, and for a future kit once enemy variety adds statuses.
 */
export const DAWNETH_CLEANSE_SPECIAL: SpecialAction = {
  id: 'dawneth-cleanse',
  name: 'Cleanse',
  trigger: 'on-turn-start',
  action: CleanseAction,
};

/**
 * Dawneth's always-on heal (the healer redesign — an innate Special, see
 * AdventurerTemplate.innateSpecialActions): Mending Charge every turn,
 * alongside her attacking Basic Action and her pool Special.
 */
export const DAWNETH_MENDING_CHARGE_SPECIAL: SpecialAction = {
  id: 'dawneth-mending-charge',
  name: 'Mending Charge',
  trigger: 'on-turn-start',
  action: MendingChargeAction,
};

/** Dawneth's lane-guardian pool Special (the healer redesign, replacing Cleanse): shields the ally in front of her, scaled by her energy. */
export const DAWNETH_GUARDIANS_VOW_SPECIAL: SpecialAction = {
  id: 'dawneth-guardians-vow',
  name: "Guardian's Vow",
  trigger: 'on-turn-start',
  action: GuardiansVowAction,
};

/** Mira's always-on heal (the healer redesign — an innate Special): Splash Heal every turn, alongside her attacking Basic Action and her pool Special. */
export const MIRA_SPLASH_HEAL_SPECIAL: SpecialAction = {
  id: 'mira-splash-heal',
  name: 'Splash Heal',
  trigger: 'on-turn-start',
  action: SplashHealAction,
};

/** Bodil's Self-Heal reframed as reactive — fires when she's hit, not on a fixed schedule, matching SelfHealAction's own "only when hurt" targeting. */
export const BODIL_SECOND_WIND_SPECIAL: SpecialAction = {
  id: 'bodil-second-wind',
  name: 'Second Wind',
  trigger: 'on-hit-taken',
  action: SelfHealAction,
};

/**
 * Bodil's second Special (docs/kit-trait-tag-framework.md's second-Special
 * pass — the Taunt ability type): proactively keeps the enemy's attacks
 * locked onto her, the "Tank" archetype gap flagged in part 3 of that doc
 * — genuine variety from Second Wind's reactive self-heal, not a reskin.
 */
export const BODIL_TAUNT_SPECIAL: SpecialAction = {
  id: 'bodil-taunt',
  name: 'Taunt',
  trigger: 'on-turn-start',
  action: TauntAction,
};

/**
 * Fallacy's former Basic Action (the "every Basic Action must deal
 * damage" cleanup pass — see docs/roadmap.md's Autobattle Revision
 * Cleanup): a timed attackPower buff to whichever living ally currently
 * hits hardest, no attack of her own — moved to a Special Action pool
 * candidate once her Basic Action became a guaranteed Attack Nearest.
 */
export const FALLACY_EMPOWER_SPECIAL: SpecialAction = {
  id: 'fallacy-empower',
  name: 'Empower',
  trigger: 'on-turn-start',
  action: EmpowerAction,
};

export const FALLACY_COMMAND_SPECIAL: SpecialAction = {
  id: 'fallacy-command',
  name: 'Command',
  trigger: 'on-turn-start',
  action: CommandAction,
};

/**
 * Fallacy's second Special (docs/kit-trait-tag-framework.md's
 * second-Special pass — the Silence ability type): shuts down a single
 * enemy's own Special Action kit for a duration, a more surgical control
 * tool than Command's party-wide buff/bonus-attack flavor.
 */
export const FALLACY_SILENCE_SPECIAL: SpecialAction = {
  id: 'fallacy-silence',
  name: 'Silence',
  trigger: 'on-turn-start',
  action: SilenceAction,
};

export const NERISSA_GILDED_STRIKE_SPECIAL: SpecialAction = {
  id: 'nerissa-gilded-strike',
  name: 'Gilded Strike',
  trigger: 'on-turn-start',
  action: GildedStrikeAction,
};

/**
 * Nerissa's second Special (docs/kit-trait-tag-framework.md's
 * second-Special pass — the Chain ability type): spreads damage across
 * multiple enemies at once, distinct from Pickpocket/Gilded Strike's
 * single-target gold-flavored damage.
 */
export const NERISSA_CHAIN_STRIKE_SPECIAL: SpecialAction = {
  id: 'nerissa-chain-strike',
  name: 'Chain Strike',
  trigger: 'on-turn-start',
  action: ChainStrikeAction,
};

export const MIRA_POTION_TOSS_ALLY_SPECIAL: SpecialAction = {
  id: 'mira-potion-toss-ally',
  name: 'Potion Toss (Ally)',
  trigger: 'on-turn-start',
  action: PotionTossAllyAction,
};

/**
 * Mira's second Special (docs/kit-trait-tag-framework.md's second-Special
 * pass — the Revive ability type): brings a Downed ally back into the
 * fight, the strongest support tool on the roster — distinct from Potion
 * Toss's randomized buff/debuff chaos.
 */
export const MIRA_REVIVE_SPECIAL: SpecialAction = {
  id: 'mira-revive',
  name: 'Revive',
  trigger: 'on-turn-start',
  action: ReviveAction,
};

/**
 * Meta-progression unlocks (see data/characterUnlocks.ts) — granted once a
 * character has cleared at least one run (state/runHistory.ts's
 * clearedWithIds), proving the "clear a run, grow the pool" mechanism.
 * Tharavel and Drifta also have a starting ability of their own now (see
 * THARAVEL_COORDINATED_STRIKE_SPECIAL/DRIFTA_OPENING_STRIKE_SPECIAL below)
 * — these unlocks are a real second pool entry for them, not their only
 * one, so clearing a run with either genuinely grows their pool to 2 (and
 * makes the join-time pick actually random) rather than just turning on
 * their first ability late.
 */
export const THARAVEL_RALLY_CRY_SPECIAL: SpecialAction = {
  id: 'tharavel-rally-cry',
  name: 'Rally Cry',
  trigger: 'on-ally-downed',
  action: InspireAction,
};

/** Reactive retaliation: Drifta lashes out at whoever's already weakest the moment she's hit. */
export const DRIFTA_ADRENALINE_RUSH_SPECIAL: SpecialAction = {
  id: 'drifta-adrenaline-rush',
  name: 'Adrenaline Rush',
  trigger: 'on-hit-taken',
  action: AttackLowestHpAction,
};

// --- Unlock content pass (docs/roadmap.md): one earned Special per character ---
// Conditions live in data/characterUnlocks.ts. Most reuse an existing action on a new trigger
// (sidegrades); Fallacy's Battle Orders and Melpomene's Volley are slightly stronger new actions
// for two trailing picks.

/**
 * Gudrun: when an enemy falls, a bonus Power Attack — feeds her Rage theme.
 * (A first version countered every hit taken; on a front-line tank that
 * fired constantly and tested far too strong.)
 */
export const GUDRUN_BLOODLUST_SPECIAL: SpecialAction = {
  id: 'gudrun-bloodlust',
  name: 'Bloodlust',
  trigger: 'on-enemy-downed',
  action: PowerAttackAction,
};

/** Isilwen: when her attack lands, flings a bonus Card Throw (on-enemy-downed fired too rarely to matter). */
export const ISILWEN_WILD_CARD_SPECIAL: SpecialAction = {
  id: 'isilwen-wild-card',
  name: 'Wild Card',
  trigger: 'on-hit-landed',
  action: CardThrowAction,
};

/** Bodil: when an ally falls, Taunts to draw fire off the rest of the party. */
export const BODIL_BULWARK_SPECIAL: SpecialAction = {
  id: 'bodil-bulwark',
  name: 'Bulwark',
  trigger: 'on-ally-downed',
  action: TauntAction,
};

/** Glint: when an ally falls, a Rallying Strike — a hit plus party-wide armor. */
export const GLINT_HOLD_THE_LINE_SPECIAL: SpecialAction = {
  id: 'glint-hold-the-line',
  name: 'Hold the Line',
  trigger: 'on-ally-downed',
  action: RallyingStrikeAction,
};

/** Fallacy: every turn, two allies make a bonus attack (Command does one). */
export const FALLACY_BATTLE_ORDERS_SPECIAL: SpecialAction = {
  id: 'fallacy-battle-orders',
  name: 'Battle Orders',
  trigger: 'on-turn-start',
  action: BattleOrdersAction,
};

/** Mirka: when hit, Fear on the enemy front — they take more damage for a few turns. */
export const MIRKA_SHOCKWAVE_SPECIAL: SpecialAction = {
  id: 'mirka-shockwave',
  name: 'Shockwave',
  trigger: 'on-hit-taken',
  action: FearAction,
};

/** Nerissa: when an enemy falls, a Pickpocket Strike — damage plus gold. */
export const NERISSA_FENCE_THE_LOOT_SPECIAL: SpecialAction = {
  id: 'nerissa-fence-the-loot',
  name: 'Fence the Loot',
  trigger: 'on-enemy-downed',
  action: PickpocketStrikeAction,
};

/** Dravena: when hit, Vanishes — untargetable for a short while. */
export const DRAVENA_BLINK_SPECIAL: SpecialAction = {
  id: 'dravena-blink',
  name: 'Blink',
  trigger: 'on-hit-taken',
  action: VanishAction,
};

/** Caladwen: when an enemy falls, slips in a Sneak Strike. */
export const CALADWEN_AMBUSH_SPECIAL: SpecialAction = {
  id: 'caladwen-ambush',
  name: 'Ambush',
  trigger: 'on-enemy-downed',
  action: SneakStrikeAction,
};

/** Melpomene: every turn, full damage to three random enemies (Scatter Shot hits two). */
export const MELPOMENE_VOLLEY_SPECIAL: SpecialAction = {
  id: 'melpomene-volley',
  name: 'Volley',
  trigger: 'on-turn-start',
  action: VolleyAction,
};

/** Mira: the moment an ally falls, Revives them. */
export const MIRA_SECOND_CHANCE_SPECIAL: SpecialAction = {
  id: 'mira-second-chance',
  name: 'Second Chance',
  trigger: 'on-ally-downed',
  action: ReviveAction,
};

/**
 * Drifta's second Special (docs/kit-trait-tag-framework.md's
 * second-Special pass — the Execute ability type): finishes off a target
 * already below EXECUTE_THRESHOLD_FRACTION, distinct from Opening
 * Strike/Adrenaline Rush's plain lowest-HP-targeted damage.
 */
export const DRIFTA_EXECUTE_STRIKE_SPECIAL: SpecialAction = {
  id: 'drifta-execute-strike',
  name: 'Execute Strike',
  trigger: 'on-turn-start',
  action: ExecuteStrikeAction,
};

/**
 * Starting abilities (base pool, active from the start — not gated behind
 * the meta-progression unlocks above) for the last 2 characters who had
 * nothing at all until their first run clear.
 */
export const THARAVEL_COORDINATED_STRIKE_SPECIAL: SpecialAction = {
  id: 'tharavel-coordinated-strike',
  name: 'Coordinated Strike',
  trigger: 'on-turn-start',
  action: CommandAction,
};

/**
 * Tharavel's second Special (docs/kit-trait-tag-framework.md's
 * second-Special pass — the Invulnerability ability type, a stand-in for
 * her originally-intended resource-denial pick, blocked on the
 * charge-meter system not existing yet): a full-immunity window for
 * whoever's weakest, the strongest single-target defensive tool on the
 * roster — fits her protective/support identity alongside Inspire.
 */
export const THARAVEL_GUARDIANS_WARD_SPECIAL: SpecialAction = {
  id: 'tharavel-guardians-ward',
  name: "Guardian's Ward",
  trigger: 'on-turn-start',
  action: GuardiansWardAction,
};

/**
 * Tharavel's former Basic Action (the "every Basic Action must deal
 * damage" cleanup pass — see docs/roadmap.md's Autobattle Revision
 * Cleanup): raises the whole living party's critChance, no attack of her
 * own — moved to a Special Action pool candidate once her Basic Action
 * became a guaranteed Attack Nearest. Distinct from Rally Cry (the
 * meta-progression unlock below), which also uses InspireAction but on
 * the 'on-ally-downed' trigger instead.
 */
export const THARAVEL_INSPIRE_SPECIAL: SpecialAction = {
  id: 'tharavel-inspire',
  name: 'Inspire',
  trigger: 'on-turn-start',
  action: InspireAction,
};

/** Drifta's agility translates into a free extra attack on whoever's already weakest, every turn — distinct from (and stacks with) Adrenaline Rush's reactive version once that's unlocked. */
export const DRIFTA_OPENING_STRIKE_SPECIAL: SpecialAction = {
  id: 'drifta-opening-strike',
  name: 'Opening Strike',
  trigger: 'on-turn-start',
  action: AttackLowestHpAction,
};

/**
 * "Do the existing characters have the abilities they need?" pass — 6 of
 * the 15 characters came out of the step-3 retheme with only a Basic
 * Action and nothing else (their old signature mechanic either didn't
 * have a real second half, or — Caladwen's case — lost one when per-face
 * enchantments were retired in step 2 and it was never ported). These are
 * their new Special Actions, granted in their base pool (not gated behind
 * a meta-progression unlock — see data/characterUnlocks.ts — since this
 * is restoring/completing baseline identity, not new unlockable content).
 */
export const CALADWEN_VENOM_STING_SPECIAL: SpecialAction = {
  id: 'caladwen-venom-sting',
  name: 'Venom Sting',
  trigger: 'on-hit-landed',
  action: VenomStingAction,
};

/**
 * Caladwen's second Special (docs/kit-trait-tag-framework.md's
 * second-Special pass — the Lifesteal ability type): a melee attack that
 * sustains her own HP, distinct from Venom Sting's damage-over-time/
 * debuff flavor — genuine variety, not a reskin.
 */
export const CALADWEN_LIFESTEAL_SPECIAL: SpecialAction = {
  id: 'caladwen-lifesteal',
  name: 'Lifesteal Strike',
  trigger: 'on-turn-start',
  action: LifestealStrikeAction,
};

/** Isilwen's chaotic-rogue flavor extended to a free bonus shot every turn, on top of whatever Card Throw rolls up. */
export const ISILWEN_LUCKY_DRAW_SPECIAL: SpecialAction = {
  id: 'isilwen-lucky-draw',
  name: 'Lucky Draw',
  trigger: 'on-turn-start',
  action: RangedShotAction,
};

/**
 * Isilwen's second Special (docs/kit-trait-tag-framework.md's
 * second-Special pass — the Mark ability type): sets up a target to take
 * extra damage from the chaos that follows, distinct from Lucky Draw's
 * pure bonus-shot flavor.
 */
export const ISILWEN_MARK_SPECIAL: SpecialAction = {
  id: 'isilwen-mark',
  name: 'Mark',
  trigger: 'on-turn-start',
  action: MarkAction,
};

/** Glint's "near-Paladin" protectiveness: when she's struck, she rallies whichever ally currently hits hardest. */
export const GLINT_GUARD_UP_SPECIAL: SpecialAction = {
  id: 'glint-guard-up',
  name: 'Guard Up',
  trigger: 'on-hit-taken',
  action: EmpowerAction,
};

/**
 * Glint's second Special (docs/kit-trait-tag-framework.md's second-Special
 * pass — the Shield ability type): proactively shields whoever's weakest
 * every turn, rather than reacting to being hit herself like Guard Up —
 * genuine variety between the two, not just a reskin.
 */
export const GLINT_SHIELD_WALL_SPECIAL: SpecialAction = {
  id: 'glint-shield-wall',
  name: 'Shield Wall',
  trigger: 'on-turn-start',
  action: ShieldWallAction,
};

/** Mirka's front-row protectiveness: when an ally falls, she lashes out at whoever's nearest. */
export const MIRKA_LAST_STAND_SPECIAL: SpecialAction = {
  id: 'mirka-last-stand',
  name: 'Last Stand',
  trigger: 'on-ally-downed',
  action: AttackNearestAction,
};

/**
 * Mirka's second Special (docs/kit-trait-tag-framework.md's
 * second-Special pass — the Stun ability type): shuts down a single
 * enemy's entire next turn, distinct from Fear's row-wide vulnerability
 * debuff and Last Stand's reactive damage.
 */
export const MIRKA_STUN_SPECIAL: SpecialAction = {
  id: 'mirka-stun',
  name: 'Stun',
  trigger: 'on-turn-start',
  action: StunAction,
};

/**
 * Mirka's former Basic Action (the "every Basic Action must deal damage"
 * cleanup pass — see docs/roadmap.md's Autobattle Revision Cleanup): a
 * pure row-wide vulnerability debuff, no attack of her own — moved to a
 * Special Action pool candidate once her Basic Action became a
 * guaranteed Attack Nearest.
 */
export const MIRKA_FEAR_SPECIAL: SpecialAction = {
  id: 'mirka-fear',
  name: 'Fear',
  trigger: 'on-turn-start',
  action: FearAction,
};

/** A landed Blinding Bolt opens a window for Dravena to loose a free follow-up shot. */
export const DRAVENA_ARCANE_BARRAGE_SPECIAL: SpecialAction = {
  id: 'dravena-arcane-barrage',
  name: 'Arcane Barrage',
  trigger: 'on-hit-landed',
  action: RangedShotAction,
};

/**
 * Dravena's second Special (docs/kit-trait-tag-framework.md's
 * second-Special pass — the Stealth/untargetable ability type, a stand-in
 * for her originally-intended elemental/damage-type pick, blocked on that
 * system not existing yet): a squishy Mage's "blink away" trick, removing
 * her from enemy targeting entirely for a duration — fits a glass-cannon
 * caster's need to avoid being focused down.
 */
export const DRAVENA_VANISH_SPECIAL: SpecialAction = {
  id: 'dravena-vanish',
  name: 'Vanish',
  trigger: 'on-turn-start',
  action: VanishAction,
};

/** Melpomene's hunter instincts: once an enemy falls, she immediately draws a bead on the next weakest. */
export const MELPOMENE_HUNTERS_INSTINCT_SPECIAL: SpecialAction = {
  id: 'melpomene-hunters-instinct',
  name: "Hunter's Instinct",
  trigger: 'on-enemy-downed',
  action: FocusedShotAction,
};

/**
 * Melpomene's second Special (docs/kit-trait-tag-framework.md's
 * second-Special pass — the AoE-beyond-rank ability type): spreads full
 * damage across multiple random enemies regardless of rank, distinct from
 * Focused Shot/Hunter's Instinct's single-target lowest-HP flavor.
 */
export const MELPOMENE_SCATTER_SHOT_SPECIAL: SpecialAction = {
  id: 'melpomene-scatter-shot',
  name: 'Scatter Shot',
  trigger: 'on-turn-start',
  action: ScatterShotAction,
};

/**
 * Enemy Special Actions (step 10 of the combat overhaul: enemy kit
 * parity) — same retheme treatment as the 15 player characters (see
 * data/enemies.ts): each enemy's secondary die-weighted action becomes a
 * Special Action alongside their new Basic Action, reusing the existing
 * Action unchanged.
 */
export const KOBOLD_SKIRMISHER_EXECUTE_SPECIAL: SpecialAction = {
  id: 'kobold-skirmisher-execute',
  name: 'Opportunist',
  trigger: 'on-turn-start',
  action: AttackLowestHpAction,
};

/** Bone Sentinel's reactive Special (enemy variety pass): gains a big attack buff for the rest of the fight when an ally falls. */
export const SENTINEL_VENGEANCE_SPECIAL: SpecialAction = {
  id: 'sentinel-vengeance',
  name: 'Vengeance',
  trigger: 'on-ally-downed',
  action: VengeanceAction,
};

/** Troll Warlord's always-on Special (enemy variety pass): heals itself a little at the start of each turn. */
export const TROLL_REGENERATE_SPECIAL: SpecialAction = {
  id: 'troll-regenerate',
  name: 'Regenerate',
  trigger: 'on-turn-start',
  action: RegenerateAction,
};

/** Succubus (floor 2 boss): when hit, Charms — stuns the nearest hero, who skips their next turn. */
export const SUCCUBUS_CHARM_SPECIAL: SpecialAction = {
  id: 'succubus-charm',
  name: 'Charm',
  trigger: 'on-hit-taken',
  action: StunAction,
};

/** Demon King (floor 3 boss): Hellfire every turn — half-damage hits on several heroes that set them Burning. */
export const DEMON_KING_HELLFIRE_SPECIAL: SpecialAction = {
  id: 'demon-king-hellfire',
  name: 'Hellfire',
  trigger: 'on-turn-start',
  action: HellfireAction,
};

/** Demon King (floor 3 boss): Raise Dead every turn — revives one fallen demon if any are down. */
export const DEMON_KING_RAISE_DEAD_SPECIAL: SpecialAction = {
  id: 'demon-king-raise-dead',
  name: 'Raise Dead',
  trigger: 'on-turn-start',
  action: ReviveAction,
};

/** Infernal Bannerman (monster pass): War Banner every turn — all its allies hit harder. */
export const BANNERMAN_WAR_BANNER_SPECIAL: SpecialAction = {
  id: 'bannerman-war-banner',
  name: 'War Banner',
  trigger: 'on-turn-start',
  action: WarBannerAction,
};

/** Hellforged Guardian (monster pass): shields its most-hurt ally every turn. */
export const GUARDIAN_WARD_SPECIAL: SpecialAction = {
  id: 'hellforged-ward',
  name: 'Hellforged Ward',
  trigger: 'on-turn-start',
  action: ShieldWallAction,
};

/** Mirka's adjacency ability: when an ally standing next to her falls, she gains a big attack buff for the rest of the fight. */
export const MIRKA_AVENGER_SPECIAL: SpecialAction = {
  id: 'mirka-avenger',
  name: 'Avenger',
  trigger: 'on-adjacent-ally-downed',
  action: VengeanceAction,
};

/** Hellcaller (summoner): every 3rd turn, calls an Ember Imp (max 2 alive) — see data/summons.ts. */
export const HELLCALLER_SUMMON_SPECIAL: SpecialAction = {
  id: 'hellcaller-summon',
  name: 'Summon Imp',
  trigger: 'on-turn-start',
  action: SummonImpAction,
};

export const GRUNT_POWER_ATTACK_SPECIAL: SpecialAction = {
  id: 'grunt-power-attack',
  name: 'Heavy Swing',
  trigger: 'on-turn-start',
  action: PowerAttackAction,
};

export const SHAMAN_ATTACK_SPECIAL: SpecialAction = {
  id: 'shaman-attack',
  name: 'Lash Out',
  trigger: 'on-turn-start',
  action: AttackNearestAction,
};

/** Ring of Embers' granted Special Action (see data/items.ts) — equipment, not a character, so it isn't part of any character's join-time pool draw. */
export const RING_OF_EMBERS_BURN_SPECIAL: SpecialAction = {
  id: 'ring-of-embers-burn',
  name: 'Ember Burn',
  trigger: 'on-hit-landed',
  action: EmberBurnAction,
};

/** Looked up by id on save load — see state/persistence.ts's deserializeAdventurer. */
export const SPECIAL_ACTION_REGISTRY: Record<string, SpecialAction> = {
  'dawneth-mourning-strike': DAWNETH_MOURNING_STRIKE_SPECIAL,
  'dawneth-cleanse': DAWNETH_CLEANSE_SPECIAL,
  'dawneth-mending-charge': DAWNETH_MENDING_CHARGE_SPECIAL,
  'dawneth-guardians-vow': DAWNETH_GUARDIANS_VOW_SPECIAL,
  'bodil-second-wind': BODIL_SECOND_WIND_SPECIAL,
  'bodil-taunt': BODIL_TAUNT_SPECIAL,
  'fallacy-empower': FALLACY_EMPOWER_SPECIAL,
  'fallacy-command': FALLACY_COMMAND_SPECIAL,
  'fallacy-silence': FALLACY_SILENCE_SPECIAL,
  'nerissa-gilded-strike': NERISSA_GILDED_STRIKE_SPECIAL,
  'nerissa-chain-strike': NERISSA_CHAIN_STRIKE_SPECIAL,
  'mira-potion-toss-ally': MIRA_POTION_TOSS_ALLY_SPECIAL,
  'mira-revive': MIRA_REVIVE_SPECIAL,
  'mira-splash-heal': MIRA_SPLASH_HEAL_SPECIAL,
  'ring-of-embers-burn': RING_OF_EMBERS_BURN_SPECIAL,
  'tharavel-rally-cry': THARAVEL_RALLY_CRY_SPECIAL,
  'drifta-adrenaline-rush': DRIFTA_ADRENALINE_RUSH_SPECIAL,
  'drifta-execute-strike': DRIFTA_EXECUTE_STRIKE_SPECIAL,
  'tharavel-coordinated-strike': THARAVEL_COORDINATED_STRIKE_SPECIAL,
  'tharavel-guardians-ward': THARAVEL_GUARDIANS_WARD_SPECIAL,
  'tharavel-inspire': THARAVEL_INSPIRE_SPECIAL,
  'drifta-opening-strike': DRIFTA_OPENING_STRIKE_SPECIAL,
  'kobold-skirmisher-execute': KOBOLD_SKIRMISHER_EXECUTE_SPECIAL,
  'grunt-power-attack': GRUNT_POWER_ATTACK_SPECIAL,
  'shaman-attack': SHAMAN_ATTACK_SPECIAL,
  'caladwen-venom-sting': CALADWEN_VENOM_STING_SPECIAL,
  'caladwen-lifesteal': CALADWEN_LIFESTEAL_SPECIAL,
  'isilwen-lucky-draw': ISILWEN_LUCKY_DRAW_SPECIAL,
  'isilwen-mark': ISILWEN_MARK_SPECIAL,
  'glint-guard-up': GLINT_GUARD_UP_SPECIAL,
  'glint-shield-wall': GLINT_SHIELD_WALL_SPECIAL,
  'mirka-last-stand': MIRKA_LAST_STAND_SPECIAL,
  'mirka-stun': MIRKA_STUN_SPECIAL,
  'mirka-fear': MIRKA_FEAR_SPECIAL,
  'dravena-arcane-barrage': DRAVENA_ARCANE_BARRAGE_SPECIAL,
  'dravena-vanish': DRAVENA_VANISH_SPECIAL,
  'melpomene-hunters-instinct': MELPOMENE_HUNTERS_INSTINCT_SPECIAL,
  'melpomene-scatter-shot': MELPOMENE_SCATTER_SHOT_SPECIAL,
  'sentinel-vengeance': SENTINEL_VENGEANCE_SPECIAL,
  'troll-regenerate': TROLL_REGENERATE_SPECIAL,
  'gudrun-bloodlust': GUDRUN_BLOODLUST_SPECIAL,
  'isilwen-wild-card': ISILWEN_WILD_CARD_SPECIAL,
  'bodil-bulwark': BODIL_BULWARK_SPECIAL,
  'glint-hold-the-line': GLINT_HOLD_THE_LINE_SPECIAL,
  'fallacy-battle-orders': FALLACY_BATTLE_ORDERS_SPECIAL,
  'mirka-shockwave': MIRKA_SHOCKWAVE_SPECIAL,
  'nerissa-fence-the-loot': NERISSA_FENCE_THE_LOOT_SPECIAL,
  'dravena-blink': DRAVENA_BLINK_SPECIAL,
  'caladwen-ambush': CALADWEN_AMBUSH_SPECIAL,
  'melpomene-volley': MELPOMENE_VOLLEY_SPECIAL,
  'mira-second-chance': MIRA_SECOND_CHANCE_SPECIAL,
  'succubus-charm': SUCCUBUS_CHARM_SPECIAL,
  'demon-king-hellfire': DEMON_KING_HELLFIRE_SPECIAL,
  'demon-king-raise-dead': DEMON_KING_RAISE_DEAD_SPECIAL,
  'bannerman-war-banner': BANNERMAN_WAR_BANNER_SPECIAL,
  'hellforged-ward': GUARDIAN_WARD_SPECIAL,
  'mirka-avenger': MIRKA_AVENGER_SPECIAL,
  'hellcaller-summon': HELLCALLER_SUMMON_SPECIAL,
};

/**
 * Pool Specials removed from a character's kit, mapped to what replaces
 * them — applied when loading a save that still references the old one
 * (see state/persistence.ts's deserializeAdventurer), so an existing
 * character picks up the new kit without a save wipe.
 */
export const RETIRED_SPECIAL_REPLACEMENTS: Record<string, SpecialAction> = {
  'dawneth-cleanse': DAWNETH_GUARDIANS_VOW_SPECIAL,
};
