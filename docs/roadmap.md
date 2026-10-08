# Roadmap

Following a change in scope, the roadmap is below. Please ensure that roadmap is updated as changes are made. 

**Process:** before coding any item on this list, Claude asks open
questions about it and we discuss the shape of the feature first — see
`CLAUDE.md`. This file is the queue, not a spec.

## Autobattle Revision Cleanup

A previous build of the game has been largely replaced with a new, less random autobattler system. 
The system aims to add more differences between characters, more flexibility of actions, and to
extend the overall system. The first step to take currently is cleanup of old system.

**Dungeon Cleanup**
1. **Dice Rolling Still Shown — done.** The tumbling die badge is gone;
   `RoomReplayScene.ts`'s turn-start banner now just reads "Name uses
   Action!" instead of "Name rolled Action!". Also fixed the same dead
   "Miss" popup logic while in there — `hit` has been vestigially
   always-`true` since the Accuracy/Evasion removal, so the old
   `if (hit) damage else "Miss"` branch never showed Miss anymore;
   switched to `damage > 0` and relabeled it "Blocked" (the only way to
   take 0 damage now is Shield/Invulnerability/Dodge, not a miss).
2. **Battle Super Zoomed In — done.** Two layered fixes:
   `.dungeon-canvas` caps at `max-width: 640px` (was `width: 100%`,
   which blew the canvas up to the page's full width). But the deeper
   issue was the scene's own geometry, from the HUD-card-strip removal
   (6-column grid + per-unit HP badges, same Autobattle Revision Cleanup
   pass): a body sprite rendered at full `CELL_SIZE` plus its badge made
   each lane row (`LANE_STEP`) tall enough that the 3-lane-deep grid
   computed out portrait (560x664) instead of landscape — "zoomed in"
   and "vertical instead of horizontal" were the same root cause. Fixed
   in `game/RoomReplayScene.ts` by rendering body sprites narrower than
   their column (`BODY_SPRITE_RENDER_WIDTH` = 60, column width stays 80)
   and trimming `LANE_FLOOR_MARGIN` (180 → 120); canvas now computes to
   560x514 — landscape again. Position-choice is covered by item 5
   below (the same merged "Prepare for Battle" scene), which this item
   was pointing at anyway.
3. **All Characters Must Attack — done.** Fallacy (Empower), Tharavel
   (Inspire), and Mirka (Fear) all had a Basic Action that never dealt
   damage — a real stalemate risk against a sustain-only opponent with
   nobody left to buff/debuff. All three now have a plain Attack Nearest
   Basic Action; their old signature move became a Special Action pool
   candidate instead (`fallacy-empower`/`tharavel-inspire`/`mirka-fear`,
   all `on-turn-start`), so the identity isn't lost, just repositioned —
   same pattern the second-Special pass already established. Mira and
   Dawneth stay pure-healer (no attack) by design — healing meaningfully
   contributes to winning, unlike a pure buff/debuff with nothing to
   finish a fight.
4. **Level Up Rework — done.** The old XP/die-face level-up system (XP bars,
   action-level offers, new-Face grants, LevelUpModal) is gone — combat no
   longer awards XP at all. In its place: a between-room Shop section in
   `DungeonPauseView.svelte` spending the run's own gold (same pool
   `sim/gold.ts` already rolled, just spendable mid-run now instead of only
   banked to town at run end), with three parts —
   - **Recruit**: rolls from the whole unlocked roster, including current
     party members. Buying a new face adds them to the party (capped at
     `MAX_PARTY_SIZE`); buying someone already in the party instead levels
     them up (`sim/leveling.ts`'s `levelUpAdventurer` — +25%
     maxHp/attackPower/healPower, full heal, scoped to the run like
     everything else here).
   - **Relics** (`sim/relics.ts`, `data/relics.ts`): a whole-party buff,
     active for the rest of the run, applied to every current member on
     purchase and to anyone recruited afterward.
   - **Equipment**: buys an existing `Item` straight into the run's
     inventory (reusing the loot/equip system as-is, just another way
     items enter it) — already acknowledged so it doesn't trigger
     LootModal, just sits in Run Inventory ready to equip.

   A second currency for meta-progression (tentatively "Renown") is **not**
   part of this pass — deliberately deferred, still being designed.
5. **Character Layout Choice — done.** `DungeonPauseView.svelte`'s existing
   between-rooms pause screen now includes a "Prepare for Battle" section
   (the "one merged screen" approach) with a single unified 6-column x
   3-row `PartyLayoutGrid.svelte` grid that mirrors the actual battle
   view's column convention (`game/RoomReplayScene.ts`'s `columnForUnit`):
   party on the left reading back-to-front, enemies on the right reading
   front-to-back, so both sides' front lines sit nearest the middle —
   exactly as they'll appear in the fight. Selecting a party member (via
   the existing party cards) and clicking a party-side cell moves them
   there, swapping with whoever's already in that cell. Full lane+rank
   placement is supported (not just row), even though lane has no
   mechanical effect yet — groundwork for later. Position persists via
   `setAdventurerPosition` (`state/townActions.ts`), built on
   `sim/partyManagement.ts`'s new `setPosition`.
6. **Heal Downed Characters Between Fights — done.** A Downed party member
   (hp <= 0) is no longer permanently out for the run — `dungeonRun.ts`'s
   `healBetweenRooms` revives them to `DOWNED_REVIVE_HP_FRACTION` (70%) of
   effective max HP before the next room, clean reset with no extra
   penalty, and clears their `downedSummary`. The run is still lost if
   every character is down at the end of a fight (handled already by
   `resolveRoom`'s existing loss outcome, before `healBetweenRooms` ever
   runs) — this item only changes what happens *between* fights. Downed
   art in the review screen was already covered by `CharacterCard.svelte`
   (`downed`/`downedArtPath`), reused as-is in `DungeonPauseView.svelte`'s
   party list.

**Town Cleanup**
1. **Character Sheet — done.** `CharacterSheetView.svelte`'s Dice Faces box
   and the Equipment slot-list/equip-from-storage UI are both gone (town
   equip is now only via loot/the between-room shop, during a run —
   `state/townActions.ts`'s `equipItemForAdventurer`/
   `unequipItemForAdventurer` are untouched for a later Town Storage
   Cleanup pass to pick back up, just no longer wired into this view).
   Formation choice was already handled by the Dungeon Cleanup pass (lives
   in `DungeonPauseView.svelte`'s "Prepare for Battle," not this sheet) —
   nothing to remove here. Traits got their own boxed section (name +
   mechanical description per trait, matching the Stats box's style,
   instead of one muted inline line) in a new "Kit & Specials" box
   alongside it — shows the active Kit's name/description (graceful
   "No Kit yet" today, since no character has kitPool content authored)
   and every active Special Action's name + description (reusing/extending
   `ui/actionDescriptions.ts`, which didn't cover every Special Action's
   underlying Action id yet — filled in the missing dozen). Icons are still
   on you to add whenever ready; nothing here blocks on them.
2. **Town Storage Cleanup — done.** Equipment is fully run-scoped now:
   `sim/adventurer.ts`'s `resetToTemplateBaseline` no longer preserves
   `equipment` across runs (it clears along with everything else a run
   changes), and `state/dungeonOrchestrator.ts`'s `finishDungeonRun` no
   longer merges the run's leftover inventory (gold or items) into town
   storage at all — both simply discarded now, town-side equip-in-town is
   genuinely gone (`ui/InventoryView.svelte` deleted,
   `equipItemForAdventurer`/`unequipItemForAdventurer` removed from
   `state/townActions.ts`). The town gold header is gone too, since
   nothing ever deposits into it anymore. The town Shop and Recruit
   screens are both now priced in Renown instead of gold — see
   **Renown / meta-progression currency — shipped**, below. The old top
   tab bar (Roster/Shop/Recruit/Embark/Settings) is replaced by a Hub
   screen (`ui/TownPhase.svelte`) of large card-buttons — Roster,
   Recruit, Embark, Settings, plus Meta Progression (no longer disabled)
   — each section now has its own "← Back to Town" instead of a
   persistent tab strip.
3. **Embark is kind of weird now — done.** The draft already only ever
   picked one character mechanically (`DRAFT_ROUND_COUNT = 1`,
   `sim/draft.ts`) — the weirdness was the interaction, not the party
   size: clicking a candidate's small card embarked immediately, no detail
   step. `ui/PartySelectionView.svelte` now splits that into two screens:
   the same offer grid (3 random unlocked + any recruited substitutes,
   unchanged pool logic) now just opens a detail view on click instead of
   picking — full-size portrait, Stats/Traits/Special boxes (same style as
   the Character Sheet rework), a "← Back" to return to the grid, and a
   "Go!" that actually embarks. Kit choice is wired in too (a "Choose a
   Kit" box, only shown when `template.kitPool.length > 1` — see
   `sim/kits.ts`'s new `applyKit`, which swaps the active Kit's
   modifiers/tags/role in place, same convention as unequip/equip) but
   stays a graceful no-op for every character today, since none has more
   than one authored Kit yet. Multi-dungeon seeding was explicitly left
   alone this pass — `startDungeon` still always uses the one starter
   dungeon (`data/rooms.ts`), no UI for choosing between dungeons yet.


## Kit / Trait / Tag Framework — shipped

Full design doc: `docs/kit-trait-tag-framework.md` (locked-in decisions,
sequencing, and a per-character mechanic breakdown — more detail than
this summary). What's actually in the codebase now:

1. **Tags + Auras** (`sim/tags.ts`, `sim/auras.ts`) — `Adventurer.tags`
   (a closed `TagId` registry mixing mechanical-synergy and pure-flavor
   labels) and `Adventurer.auras` (continuous party-wide effects, e.g.
   "+1 shield to all Bunny allies"), recomputed once per turn tick
   (`tickAuras`, alongside `tickBuffs`/`tickShields`). No content
   authored yet — the registry/mechanism is live, empty of real tags.
2. **Kit** (`sim/kits.ts`) — a character-specific "costume" variant
   (stats/tags/art, never Basic Action or die faces), drawn from a new
   `AdventurerTemplate.kitPool` the same way Special Action already
   works, rerolled on every reset. No character has a kitPool yet.
3. **Universal Trait pool** (`sim/traits.ts`'s `rollTraits`,
   `data/traits.ts`'s `UNIVERSAL_TRAIT_POOL`) — up to 2 traits rolled at
   creation from a pool any character can draw from, additive with a
   character's own seeded traits (e.g. Gudrun keeps Rage unconditionally).
   Pool is currently empty — wired into `createStarterRoster` and
   `finishDungeonRun`'s reset, so adding a Trait here goes live with no
   further plumbing.
4. **Shield** (`sim/shields.ts`) — a depletable damage-absorb pool,
   distinct from armor/healing; consumed in `applyAttackToTarget` after
   armor mitigation, before HP loss.
5. **Second Special Action pass** — every character except Dee now has
   two base-pool abilities (randomly drawn at join, same as before).
   Shipped mechanics: Shield, Lifesteal, Taunt, Cleanse, Mark, Execute,
   Silence, Stun, Chain damage, AoE-beyond-rank, Revive, and
   Reflect/Thorns (Gudrun's case — a second Trait, not a Special Action,
   since it's a true passive). Tharavel (Guardian's Ward) and Dravena
   (Vanish) both got a stand-in pick — their originally-intended
   abilities (resource denial, a damage-type layer) are still blocked on
   systems that don't exist (see item 6 below and the "still open" list
   at the end of the framework doc).

**Not yet built, deliberately deferred:**
- **Mid-run Trait growth** — gaining a Trait beyond the 2-at-creation
  cap, mid-run (e.g. a level-up choice). Proposed hook: `leveling.ts`'s
  `UpgradeChoice` machinery. Needs its own open-questions pass on the
  actual trigger (level-up? a room event? an item?) and whether a
  mid-run gain persists across runs or resets like levels do.
- **Kit art-key UI wiring** — `Kit.artKey` exists but none of the ~8
  UI/Phaser files that build portrait paths from `adventurer.archetype`
  (`CharacterCard.svelte`, `RoomReplayScene.ts`, etc.) consult it yet.
  No real Kit content exists to test against, so this was deliberately
  left until a Kit actually ships.
- **Fully missing archetypes** (part 3 of the framework doc) — Tank,
  Summoner, Controller/Debuffer, Elementalist, Positioner, and a
  Tag-synergy archetype. These are new *characters* to design once
  there's more Tag/Kit content to compose with, not systems to build.
- **`grantTag`-style Auras** — today an Aura can only grant a
  `StatModifier`; granting a Tag (e.g. a unit that makes allies count as
  a species they aren't) isn't wired up.

## Renown / meta-progression currency — shipped

The second currency flagged as deferred in the Dungeon Cleanup pass
(item 4) is now built: `sim/renown.ts`'s `calculateRunRenown` awards
`ROOM_CLEAR_RENOWN` (3, placeholder) per room actually won in a run —
banked even on a loss or retreat, credit for whatever was cleared —
plus `RUN_COMPLETION_BONUS_RENOWN` (15, placeholder) if the whole run
completes. `state/metaProgression.ts` stores the running Renown total
and a per-character map of unlocked Kit ids, persisted (save v17,
`state/persistence.ts`) and autosaved (`state/autosave.ts`).
`state/dungeonOrchestrator.ts`'s `finishDungeonRun` awards Renown and
folds any purchased Kits into the party's `kitPool` on every reset.

Both Renown-spending surfaces are wired: `sim/shop.ts` now sells Kits
(not Items) priced in Renown — `ui/ShopView.svelte` — and
`sim/recruitment.ts`'s pricing is Renown-based too —
`ui/RecruitmentView.svelte`/`ui/CandidatePreviewView.svelte`.
`ui/TownPhase.svelte` shows a Renown total in the header and the Meta
Progression hub card is no longer disabled. Three real placeholder
Kits are authored (`data/kits.ts`, `data/kitShop.ts`) for Gudrun,
Nerissa, and Caladwen — everyone else still has an empty `kitPool`.

Live-verified end to end: a run that clears rooms before ending (win,
loss, or retreat) banks the expected Renown, the town header reflects
it, and the Shop/Recruit screens price correctly off it.

## "Pure auto-battler" pass — Accuracy/Evasion removed — shipped

Every attack now always connects — no more hit/miss roll. Prompted by a
direct comparison against the genre (TFT, Hearthstone Battlegrounds,
Super Auto Pets, Mechabellum all resolve damage deterministically,
precisely because a "my attack just missed" moment reads as bad luck
rather than strategy when the player made no in-the-moment choice to
cause it).

1. **Accuracy and Evasion removed** as baseline stats everyone had a
   little of (`Adventurer`/`AdventurerTemplate`, every character/enemy
   template). `sim/actions/attack.ts`'s `applyAttackToTarget` no longer
   rolls hit/miss; crit is now its own independent `rng()` draw instead
   of piggybacking on the old hit roll.
2. **Drifta's Dodge** (`traits.ts`'s `DODGE_TRAIT`) replaces her old
   "highest evasion" identity — a genuine, rare, TFT-style dodge keyword
   scoped to one character (20% chance to fully negate a hit) rather
   than a universal miss-chance stat. Checked directly in
   `applyAttackToTarget`, same convention as Rage/Thorns.
3. **Three abilities that keyed off Accuracy were redesigned**: Inspire
   (Tharavel) consolidated its separate accuracy+crit buffs into one
   stronger crit buff; Fear (Mirka) and Potion Toss's debuff (Mira) both
   switched from an accuracy debuff to a Mark-style `vulnerability`
   debuff (target takes +% damage) instead of "enemy misses the party
   more."
4. **`hit: boolean` stays in every `ActionOutcome` shape, always
   `true`** — cheapest option; `damage` is the field that actually
   carries meaning now (0 means Shield/Invulnerability/Dodge fully
   blocked it, not a miss). Every place that gated a secondary effect on
   `.hit` (Pickpocket Strike's gold, Blinding Bolt's debuff, and
   `turnEngine.ts`'s `landedHitTargetIds` — which decides whether
   `on-hit-landed`/`on-hit-taken` triggers fire at all) was switched to
   `.damage > 0` instead, so Shield/Invulnerable/Dodged hits correctly
   still count as "nothing got through." `landedHitTargetIds` also
   picked up two outcome types (`attack-with-execute`,
   `attack-and-heal-self`) it had been missing since the second-Special
   pass — Execute Strike and Lifesteal Strike now correctly fire
   on-hit-landed/on-hit-taken triggers too.

Possible Future:

**Still open — the Fire Emblem-style cutaway idea, deliberately
deferred:** larger per-character/per-action artwork shown at the moment
a character acts, closer to a Fire Emblem combat cutaway, rather than
(or layered over) the grid view. Unresolved questions going in: whether
it replaces or overlays the grid view (explicitly undecided, not just
unasked), and it needs real artwork (placeholder-first is the agreed
starting point, same graceful-degradation convention the rest of the
game already uses for missing art). Needs its own open-questions pass
before any code gets written.


## 3. Meta-progression has no UI

`state/runHistory.ts`'s `clearedWithIds` and the character pool unlocks
it now gates (`data/characterUnlocks.ts`) are both pure background
tracking — a player who clears a run with Drifta gets no in-game signal
that she's grown her kit. Needs some surface (character sheet? a toast at
run-end? a dedicated unlocks screen?) once there's enough unlocked
content to be worth showing.

## 4. 3×3 grid: nobody uses the side lanes yet

Every character and enemy still only ever occupies the center lane (via
the `'front'`/`'back'` shorthand — see overhaul step 5). The grid is
real and generalized, but nothing in character/room authoring, the
mid-run recruit flow, or the UI actually places someone left/right. This
blocks two things:
- **Adjacency-filtered triggers** — `isAdjacent` exists but is unused;
  the original pitch's "when an enemy is downed by an ally adjacent to
  you" needs real lane diversity to mean anything.
- **The HUD rework above** benefits from knowing whether lane placement
  is actually going to be visually meaningful before committing to a
  layout for it.

## 5. Permanent stat growth

Deferred from the meta-progression step — the plan always described
unlockable pool entries *and* "optionally" permanent stat growth, but
only the pool-unlock half was built. Still needs: what grants it (same
first-clear trigger? a separate milestone?), how much, how it's capped,
and how it coexists with in-run leveling without making early runs
trivial.

## 6. In-run scaling/progression is thin

Scaling and growth *within a single run* is one of the genre's bigger
levers (see item 9 below) and we have essentially none of it today.
What exists: XP/level-ups (`sim/leveling.ts` — a passive, an
action-level bump, or a new Face; the last of those three is currently
dead, see item 2), loot found mid-run, and the party growing 1→9 via
recruitment. None of it *compounds* — there's no mechanic where an
early pick snowballs into a dramatically stronger late-run board, which
is the thing that makes a run's back half feel different from its front
half in games like TFT or Order Automatica. Candidate levers, several
pulled directly from item 9's research: role synergy bonuses scaling up
as the party grows (more roles active = more stacked bonuses, for
free, as recruitment already happens), a charge-meter trigger type that
rewards a long fight, or duplicate-recruit merging. Needs its own
open-questions pass on what "snowballing" should actually feel like
here before picking a mechanism — this is a design gap, not just a
missing feature.

## 7. Enemy variety — still open

Carried over from before the overhaul, now reframed: the 4 enemy
templates have kit parity with player characters (Basic + Special) but
no enemy-only mechanic — nothing an enemy does that no player character
also does. Also no enemy currently has a Trait.

## 8. Second balance pass — shipped

Target agreed up front: a **~50-60% full-clear rate** for a party that
shops sensibly, tuned via **enemy stats and room compositions only**
(economy and inter-room healing deliberately left alone), with
per-character outliers flagged and only the egregious ones fixed.

1. **Sim harness rebuilt** (`sim/balanceSim.test.ts`, run with
   `BALANCE_SIM=1 npx vitest run src/sim/balanceSim.test.ts --silent=false --reporter=verbose`;
   `BALANCE_SIM_RUNS` overrides the 2000-run default). The old harness
   always bought the 3 cheapest characters from the whole roster (every run
   was Isilwen/Caladwen/Gudrun), never bought relics/items/level-ups, didn't
   count Special Actions, and still reported dead XP-level metrics — its
   99.6% win rate was meaningless. The simulated player now mirrors the
   real shops: the opening shop's single rolled offer set
   (`STARTING_SHOP_GOLD`), then a greedy buy at every pause (new recruits
   → level-ups → relics → equipment, auto-equipped), plus room loot.
   Reports per-room loss distribution, party size/HP by room, and
   full-clear rate per character (as an opener and as any party member).
2. **Difficulty**: honest baseline was 85.5%. `data/rooms.ts` slot 3 is now
   a real trio (was a breather — parties left it at ~97% HP), slots 4-5
   field a Brute with support (up to 4 enemies), and a new
   `ROOM_SLOT_ENEMY_STAT_SCALE` (`[1, 1, 0.9, 1.15, 1.25]`) multiplies
   enemy maxHp/attackPower/healPower per slot. Result: **54.6% full clear**
   over 6000 runs, losses escalating toward the finale (room 1→5:
   0.3% / 4.5% / 6.7% / 15.4% / 18.5%), ~1.2% stalemates.
3. **Outliers fixed** (spread was 34-73%, now 41-67%):
   Rallying Strike armor 3 → 2 (party-wide +3 nearly cancelled
   Kobold/Grunt hits; Glint 73% → 62%); Dawneth healPower 4 → 9,
   attackPower 3 → 4, maxHp 16 → 18; Mira healPower 4 → 8, attackPower 2 → 3;
   Fallacy attackPower 2 → 3, maxHp 16 → 18.

**Still open, flagged not fixed:**
- **Dawneth (~41%) and Mira (~48%) still trail.** Heal numbers move them
  but don't close the gap — a pure healer in a 3-person opening party
  displaces a damage dealer. Probably a design question (e.g. give
  healers a light attack, or make healing scale with party size) rather
  than more number-pushing.
- **Top end**: Nerissa (~67%) and Dravena (~64%) are the strongest picks.
- **Economy is barely used**: parties average 3.0 at room 1 and only ~4.0
  by room 5, with ~0.05 level-ups bought per run — gold income (~140g/run)
  vs recruit prices (50-65) means the between-room shop rarely buys more
  than one thing. Left alone this pass by choice; worth its own look.
- The sim's player is greedy and positionless (default rows); real players
  who build formations deliberately will likely clear more often.

## 9. Ideas from other grid autobattlers (reference, mostly still unscoped)

Four companion reference docs — the first two are candidate material
for item 6 and future character-kit passes, not a plan; the latter two
are living catalogs, now substantially shipped (see the Kit/Trait/Tag
section above) rather than pure gap-analysis:

- `docs/autobattler-mechanics-research.md` — macro-*systems* other grid
  autobattlers have that we don't: 8 candidates comparing us against
  Tiny Auto Knights, Order Automatica (the closest structural match:
  3×3 grid, PvE, pre-battle planning, auto-resolve), and TFT/Auto Chess
  — role synergy, tile effects, duplicate merging, a charge-meter
  trigger, freeze/stun status, relics, turn-order preview, curses — each
  tied to the specific place in our codebase it'd hook into. Still
  entirely unscoped.
- `docs/missing-ability-types.md` — individual *ability archetypes* (not
  systems) those same games have. **Most of this list shipped** in the
  second-Special pass (Shield, Taunt, Stun, Silence, Execute, Lifesteal,
  Reflect/Thorns, Mark/vulnerability, Chain damage, Cleanse, Revive — see
  the Kit/Trait/Tag section above). Still genuinely missing: Summon
  (spawns a new unit mid-fight) and position swap/displacement — both
  flagged as needing real new plumbing, not just content, when this doc
  was written.
- `docs/character-abilities.md` — a full catalog of every
  character/enemy's current Basic Action/Special Action/Trait, kept in
  sync with the code (regenerate rather than hand-edit if it drifts).
  Its "what nobody has yet" section is updated for the second-Special
  pass: Gudrun now has two Traits (Rage + Thorns), Dawneth's Cleanse is
  the only status-effect *reaction* anywhere (everything else still only
  *inflicts*), and `on-enemy-downed` is still used exactly once.
- `docs/kit-trait-tag-framework.md` — the Kit/Trait/Tag design doc (see
  above); its own "still open" list is the authoritative source for
  what's left in that feature specifically, not duplicated here.

## 10. Infrastructure housekeeping (ongoing)

- **UI-level test coverage.** Keep adding thin coverage as the UI grows
  (`@testing-library/svelte` + jsdom infra already in place), rather than
  after it already has.
- **Minor bug spotted, not yet fixed:** the between-room heal
  (`DungeonPauseView`'s party list) can display HP as a long float (e.g.
  "27.500000000000004/25") instead of a clean integer — a
  floating-point display artifact in the inter-room heal math, cosmetic
  only. Noticed live while verifying item 1, out of scope for that fix.
