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

**The Fire Emblem-style cutaway idea** shipped as portrait cut-ins
(overlaying the grid, not replacing it); see "Portrait cut-ins and boss
entrance cards" below.


## 3. Meta-progression UI — shipped

Progression is now visible in four places, all reading the same helpers
(`state/progression.ts`: `clearUnlocksFor`, `newUnlocksForRun`, `kitsFor`,
`lastRunReward`):

1. **Run-end recap** (`ui/DungeonPauseView.svelte`): Renown earned with its
   breakdown (rooms × 3 + completion bonus — `sim/renown.ts`'s
   `calculateRunRenownBreakdown`) and any clear-unlocks this run earns.
2. **Town toast** (`ui/TownPhase.svelte`): on returning to town, "+N
   Renown" plus new unlocks, with a "View Progress" button; shown once.
3. **Progress screen** (`ui/ProgressView.svelte`, the hub card formerly
   called "Meta Progression"): Renown total, every character's run stats
   and unlock goals — earned ones checked, locked ones with how to get them
   — and the Kit shop underneath. Character names open their sheet.
4. **Character sheet** "Unlocks & Progress" box: run stats, clear-unlocks
   and Kits, earned or locked with conditions.

**Per-character stats**: `runHistory.characterStats` (runs, clears, best
rooms won) — written by `recordRun` in `finishDungeonRun`; persisted, and
older saves load with empty stats (no save wipe).

**Still open:**
- ~~Content is thin~~ — resolved by the unlock content pass below (Kits
  are still only Gudrun/Nerissa/Caladwen).
- Clear-unlocks only add a Special to the character's random pool, not a
  guaranteed pick — the UI says "added to their Special pool" for that
  reason.

### Unlock content pass — shipped

Every character but Dee now has one earned Special (`data/characterUnlocks.ts`,
full list in `docs/character-abilities.md`), with **varied conditions**
(`UnlockCondition`: clear a run / reach room 4 / take them on 3 runs —
checked by `state/progression.ts`'s `isUnlockEarned` against
`runHistory.characterStats`). Weaker picks got the easier "3 runs" goals.

- Most new Specials reuse an existing action on a new trigger
  (sidegrades). Two are new, slightly stronger actions for trailing picks:
  **Battle Orders** (Fallacy — two allies each make a bonus attack) and
  **Volley** (Melpomene — 3-target Scatter Shot). Tharavel already had an
  unlock, so **Inspire** went 20 → 30% crit instead.
- **Re-roll on offer**: a character offered in a shop (opening or
  between rooms) who isn't in the party gets a fresh Special/Kit draw each
  time they're offered (`sim/adventurer.ts`'s `rerollPoolPicks`, via
  `rerollOfferedCharacters`).
- **Recruit tooltip**: hovering a recruit offer shows the Specials, Traits
  and Kit that character brings this run (`ui/recruitTooltip.ts`).
- Balance (`BALANCE_SIM_UNLOCKS=1` simulates a veteran profile with every
  unlock earned): fresh profile **55.6%** full clear (spread 48-65%),
  veteran **52.2%** (46-61%) — unlocks add variety, not power. Two first
  drafts were reworked after testing: Gudrun's counter-on-every-hit was far
  too strong (now **Bloodlust**, on enemy downed), and Isilwen's
  Wild Card fired too rarely on enemy downed (now on hit landed).

## 4. 3×3 grid: lanes and drag-and-drop formation — shipped

Every unit now has its own cell, and lanes matter in combat.

1. **Lane-limited melee** (`sim/actions/targeting.ts`'s
   `meleeEligibleOpponents`, applies to both sides): melee only reaches
   the frontmost living unit in the attacker's own lane. Once that lane is
   empty it moves to the nearest lane that still has anyone (both side
   lanes tie for a center-lane attacker), again only that lane's frontmost
   unit. A fragile character is only fully safe standing *behind* someone.
   Ranged reach is unchanged (anyone), Taunt still overrides, and Cleave
   still hits the target's whole rank across lanes.
2. **One unit per cell**: `sim/formation.ts` gained `findFreeCell`,
   `assignUniquePositions`, `moveToCell` and `placeUnplaced`.
   `resolveNextRoom` calls `assignUniquePositions` at every room start, so
   old saves and unplaced recruits can never fight stacked.
3. **Enemy placement** (`data/rooms.ts`'s `placeEnemies` /
   `ENEMY_RANK_OPTIONS`): Brute front; Grunt/Kobold front or middle;
   Shaman back, preferring a lane with someone in front of it. Lanes are
   rolled randomly, no stacking. Compositions are now plain factory lists.
4. **Drag-and-drop formation board** (`ui/FormationBoard.svelte`, replacing
   `PartyLayoutGrid.svelte`): party members are drawn as their battle
   sprites and dragged with pointer events (works with touch). Dropping on
   an occupied cell swaps; dropping from the tray onto an occupied cell
   sends the occupant to the tray; the tray is also a drop target. New
   recruits land in the tray (`unplacedIds` on `DungeonPlaybackState` and
   `OpeningShopState`), and anyone still there on Continue/Embark is
   auto-placed near their usual rank. Click-to-select-then-click-a-cell
   still works as a keyboard fallback.
5. **Placement before room 1**: the opening shop rolls the run's rooms when
   it opens and shows the board against room 1's enemies; Embark fights
   exactly the previewed rooms.
6. **Battle view** (`game/RoomReplayScene.ts`'s `layoutColumn`): units
   render at their literal lane, falling back to centering only if a
   column's lanes collide.
7. **Rebalanced**: the lane rule favored the party (65.5% full clear with
   the old scaling), so `ROOM_SLOT_ENEMY_STAT_SCALE` became
   `[1, 1.3, 1.65, 2, 2.35]` → **55.5%** over 6000 runs. The sim player
   relies on auto-placement (front-row roles across rank 0, back-row roles
   across rank 2), so a player who deliberately shields squishies will do
   somewhat better.

**Still open:**
- **Adjacency triggers** — `isAdjacent` is still unused; lanes are now
  real, so "when an adjacent ally..." style Specials are unblocked.
- ~~Dawneth fell further behind~~ — resolved by the healer redesign
  (see item 8's follow-up).

## 5. Permanent stat growth — shipped (Training)

Renown now has a second use: **Training ranks** per character, bought on
the Progress screen (`sim/training.ts`, `state/townActions.ts`'s
`buyTrainingRank`, persisted in `metaProgression.trainingRanks` — older
saves load with none).

- 5 ranks, each **+2% max HP, attack and heal power** (+10% at max),
  costing 20 / 30 / 40 / 50 / 60 Renown (200 to max one character).
- Applied as `source: 'training'` StatModifiers whenever a character is
  rebuilt in town — after a run's reset, on New Game (Training is profile
  progress, like Renown), and right on purchase — and HP is topped up to
  the new effective max.
- Shown on the Progress screen (rank + Train button per character) and the
  character sheet.
- Balance (`BALANCE_SIM_TRAINING=5 BALANCE_SIM_UNLOCKS=1` = fully grown):
  fresh **~54%** full clear, fully grown **68.9%** — inside the agreed
  50-55% / 65-70% targets. +4%/rank tested at 82%, +3% at 75.5%.

## 6. In-run snowballing — shipped

Three things now compound over a run:

1. **Role synergies** (`sim/synergies.ts`, `data/synergies.ts`), recomputed
   at every room start in `resolveNextRoom`:
   - Vanguard (Fighters): 2 / 3 / 4 → +6% / +20% / +40% max HP (Fighters)
   - Cutthroats (Rogues): 2 / 3 → +8 / +30 crit chance (Rogues)
   - Menders (Healers): 2 → +20% healing (whole party)
   - Strategists (Tacticians): 2 → +8% attack (whole party)
   - Marksmen (Mage + Ranger): 2 → +15% attack (members)
   The payoff sits in the higher tiers on purpose: random parties reach
   2-member tiers on their own, so only bigger builds should stand out.
   Shown in a synergy panel (`ui/SynergyPanel.svelte`) on the opening shop
   and between rooms; recruit tooltips say which synergy a recruit adds to.
2. **Scaling relics** (`Relic.scaling`, `applyRelicScaling`): **War Trophy**
   (+3% party attack per room cleared) and **Strength in Numbers** (+2%
   party max HP per party member). Rooms cleared comes from `roomIndex`, so
   it survives a save/resume.
3. **Duplicate stars**: reaching 2★ via a duplicate recruit also draws a
   second, different Special from the character's pool
   (`grantSecondPoolSpecial`).

Balance (`ROOM_SLOT_ENEMY_STAT_SCALE` → `[1.85, 1.95, 2.1, 2.2, 2.85]`):
fresh **55.0%** full clear, fully grown 68.9%. **Build payoff** — among
runs that reach room 4, full-clear rate by best synergy tier at that point:
2-member 61%, 3-member 75%, 4-member 85%. The sim's "synergy player"
(`BALANCE_SIM_SYNERGY_PLAYER=1`) only gains ~2 points because it can't
steer much with 3 random offers per shop and buys everything anyway — the
tier-bucketed number is the better measure of what a build is worth.

## 15-room dungeon (3 floors) — shipped

The run grew from 5 rooms to **15: three floors of five**
(`sim/dungeonRun.ts`'s `ROOMS_PER_FLOOR`/`floorOf`, `data/rooms.ts`'s
`TOTAL_ROOMS`), each floor ending in a boss. 5 rooms was only ever a
quick-to-test length; the snowball mechanics (item 6) need room to peak.

- **Bosses**: Troll Warlord (floor 1), **Succubus** (floor 2 — Draining
  Kiss: ranged lifesteal on the weakest hero; Charm: stuns the nearest hero
  when she's hit), **Demon King** (floor 3 finale — Cleave, Hellfire:
  half-damage hits on 3 heroes that Burn, Raise Dead: revives a fallen
  demon each turn). Both new bosses use placeholder sprites.
- Floors 2-3 reuse the regular enemies in bigger mixes; per-room tables
  (`ROOM_SLOT_ENEMY_STAT_SCALE`, `ROOM_SLOT_CLEAR_GOLD`) cover all 15.
- **Renown**: +10 per full floor cleared (`FLOOR_CLEAR_RENOWN`) on top of
  per-room and completion Renown, so a floor-2 or -3 loss still pays.
- UI: the replay title reads "Floor 2 · Room 3 / 5" or "Floor 2 · Boss";
  stats show best rooms out of 15; recap/toast show the floor bonus.
- **Balance** (fresh profile): ~75% clear floor 1, ~48% clear floor 2,
  **33% full clear**; fully grown (Training 5 + all unlocks) **49%**.
  Character spread on a grown profile 41-58%.
- No mid-run checkpoints — the existing resume-after-closing is enough;
  floors are milestones for Renown and difficulty.

**Still open:** Dawneth (~41%) and Bodil/Glint (~44-45%) trail on the
long run; more enemy types would reduce repetition across 15 rooms.

## Portrait cut-ins and boss entrance cards — shipped

A portrait banner slides over the replay at dramatic moments without
pausing the fight (heroes from the left, monsters from the right; a new one
replaces the one showing, so they never pile up). It scales with battle
speed and uses each unit's portrait art, with Kit costume art first and
idle as the fallback.

- **Key moments** (`ui/cutIns.ts`'s `withKeyMomentCutIns`, derived from the
  replay's own HP changes):
  - a hero's killing blow (attack art);
  - a hero falling (downed art);
  - a save: a hero revived from 0 HP (Second Wind, Revive), or healed by
    20%+ of max HP while under 25% (healed art). A Bodyguard taking the
    hit is added by the replay builder (hit art).
- **All** adds every Special that isn't `alwaysOn`. This is workable now
  that Specials fire about every 3 turns (see the charge meter below).
- **Boss entrance cards**: in a floor-boss room the intro holds longer under
  a centered card with the boss's portrait.
- **Settings → Battle Cut-ins**: Off / Key moments (default) / All. A
  display preference in localStorage (`state/cutInSetting.ts`), like battle
  speed. Off also hides boss cards.
- Plumbing: a `cut-in` ReplayEvent that RoomReplayScene hands to
  `onCutIn`, and `bossCard` played during the intro. The overlay is a DOM
  component (`ui/CutInOverlay.svelte`) over the canvas, so it gets the
  same `fallbackSrc` art fallbacks as the rest of the UI.

**Still open:** monsters only have idle portraits, so enemy cut-ins (Specials
under "All", boss cards) all use the same pose. Per-state monster art would
help.

## Special Action charge meter — shipped

Specials used to fire every turn whenever their trigger matched (on-turn-start
ones about half of all hero actions), so they didn't feel special. Now (`sim/charge.ts`):

- Every unit has a **charge meter** (0–100) that starts each fight at 50, gains
  +25 per own turn and +10 whenever they deal or take damage. An
  on-turn-start Special waits for a full meter, fires, and empties it — so
  the first one lands around turn 2 and then about every 3 turns. With no
  valid target it holds its charge.
- Charged Specials hit **2× harder** (damage and Heal/Potion healing, via
  `BattleState.specialPowerMultiplier`).
- **Reactive** Specials (on-hit, on-ally-downed, on-enemy-downed, ...) skip
  the meter but get a 2-turn cooldown each.
- `alwaysOn: true` Specials ignore both: Dawneth's Mending Charge, Mira's
  Splash Heal, the Troll's Regenerate, War Banner, Hellforged Ward,
  Hellcaller's Summon, the Demon King's Hellfire and Raise Dead, Succubus
  Charm, Sentinel Vengeance, Mirka's Avenger and the Ring of Embers.
- Replay: a thin charge bar sits under the HP bar of each unit with a
  charged Special, turning gold when full (`TurnResult.chargeAfter` →
  a `charge` replay event).
- Balance: enemy stat scale retuned down (~9% floor 1, ~25% floor 2,
  ~33% floor 3). Sim: fresh ~33–35% full clear (80% clear floor 1, ~52%
  floor 2), grown ~59%, grown + all Kits ~74%. Growth now matters a
  little more than before (trained damage is doubled on charged hits).

This also sets up the cut-in work: with Specials rarer, every Special can
get a portrait cut-in under the "All" setting.

## Run summary screen and run log — shipped

When a run ends, a dedicated summary screen replaces the between-rooms
layout (`ui/RunSummaryView.svelte`): outcome ("Defeated on Floor 2"), a
15-room path across the three floors (cleared ✓, bosses ♛, the fatal room
✕), what beat you, **MVP awards** (Top Damage, Top Healer, Iron Wall,
Slayer), a card per hero (portrait incl. Kit art, ★ level, title, Traits
earned — boons/flaws/Milestone — and dmg/healed/taken/kills), and totals
(Renown breakdown, gold earned/spent, relics, active synergies). Unlocks
and loot still show below it, with Return to Town.

- `state/runSummary.ts`: `buildRunSummary` makes a plain-data snapshot
  before the party resets; `finishDungeonRun` records it to `runLog`
  (last 10, newest first, persisted as an optional `runLog` save field —
  older saves load fine). Retreats are logged too.
- New tracking: `Adventurer.runKills` (enemy kills credited once per enemy
  via `killedBy`, in `room.ts`'s `creditKillIfNeeded`, including Command/
  Battle Orders) and `DungeonPlaybackState.runTotals` (gold earned/spent,
  relics bought; saved with the active run).
- **Progress** gains a **Recent Runs** list; each row opens its full
  summary in a popup.

## Summoner monster: the Hellcaller — shipped

The first enemy that changes a fight's makeup mid-battle. **Hellcaller**
(back rank, floors 2-3, Demon): a ranged attack, and every 3rd turn it
calls an **Ember Imp** — at most 2 alive, scaled to its room, no gold or
loot. Its Imps are **banished** the moment it falls, so the play is to
reach it fast.

- `sim/summons.ts`: `createSummonAction` (rules: every Nth turn, max
  alive, an injected `create` factory so sim/ never imports data/) and
  `banishOrphanedSummons`. `Adventurer.summonedBy`/`statScale`,
  `battle.turnsTakenByUnitId`; a `summon` outcome and a `banish` turn event
  (checked at every turn exit, including a summoner dying to a status
  tick).
- `data/summons.ts` defines Summon Imp; `data/enemies.ts` registers the
  Imp factory (`registerImpSummonFactory`) to avoid an
  enemies ↔ specialActions ↔ summons import cycle. `scaleEnemy` is now
  shared by rooms and summons.
- Replay: summoned units start hidden (`hiddenUntilSpawn`), fade in on a
  `spawn` event with a "Summon Imp!" announcement, and fade out on
  `banish`.
- Balance: unchanged (fresh 36.7%). Placeholder sprite `hellcaller.png`.

## Mid-run Trait growth (floor-boss rewards) — shipped

After the floor 1 and floor 2 bosses, the pause screen offers **3 cards,
each a Trait for a specific party member** ("Vampiric → Mira"). One must
be picked before continuing; the Trait lasts the rest of the run.

- Pool (`data/milestones.ts`): the good hero Quirks plus six reward-only
  **Milestone Traits** (`sim/traits.ts`): **Vampiric** (heal 25% of damage
  dealt), **Second Wind** (once per fight, survive a lethal hit at 30%
  HP), **Giant Slayer** (+30% damage vs targets with ≥1.5× their max HP),
  **Executioner** (+40% vs targets under 30% HP), **Juggernaut** (+20% max
  HP, +2 armor), **Battle Trance** (+20% speed, +8 crit).
- `sim/milestones.ts`: `isMilestonePause`, `rollMilestoneOffers` (cards
  spread across heroes, never a Trait already held), `grantTrait`.
  `DungeonPlaybackState.milestoneOffers`; `continueDungeonRun` is blocked
  while a pick is pending; `chooseMilestoneOffer`. A save taken mid-pick
  records `milestonePending` and re-rolls the cards on resume.
- Vampiric heals and Second Wind revives flow through
  `battle.pendingTraitEffects` → `trait-effect` turn events → the replay.
  **Fixed along the way**: a revived unit (Second Wind, or Mira's Revive)
  now stands back up in the battle view and its HP bar refills — Revive
  previously only showed an announcement.
- Balance: fresh **37.3%** full clear (+3 from the picks, still in band),
  fully grown 54.1%. No scaling change.

## Halloween event — shipped

A seasonal costume for every character, behind one switch:
`data/events.ts`'s `HALLOWEEN_EVENT_ACTIVE`.

- **14 Halloween Kits** (`data/kits.ts`): Blood Countess (Gudrun), The
  Banshee (Dawneth), Grave Jester (Isilwen), Headless Horsewoman
  (Tharavel), Pumpkin Bunny (Bodil), Golden Mummy (Glint), Ghost Pirate
  (Drifta), Little Devil (Fallacy), The Reaper (Mirka), Black Cat
  (Nerissa), Spider Queen (Dravena), Stitched Bride (Caladwen), Werewolf
  Huntress (Melpomene), Pumpkin Witch (Mira). Each: a small stat trade-off
  plus the new **Spooky** tag.
- **Unlock**: while the event is on, reaching Floor 2 with a character
  unlocks their costume for free (`halloweenUnlocksForRun`, in
  `finishDungeonRun`; announced on the recap and toast). While it's on they
  can't be bought; once it's off they sell for 50 Renown
  (`KitShopEntry.event`, `isEventKitEarnOnly`). Unlocked costumes always
  stay wearable/swappable.
- **Spooky bonuses**: **Haunting** synergy (tag-based synergies are new —
  `Synergy.tag`/`countsToward`): 2/3/4 Spooky → +4/7/10% attack for them;
  **Jack-o'-Lantern** relic (+8% attack for Spooky members — relic scaling
  gained `per: 'flat'` + `requiresTag`, rechecked each room); **lane Fear**
  (`sim/fear.ts`): enemies in a Spooky hero's lane take +5% damage.
- Balance: fresh profile unchanged (~34.5%); a fully grown profile owning
  every Kit clears 66.7% vs 58.8% with regular Kits only. Spooky was
  trimmed twice — at first it stacked to 80%.
- **Art prompts** for all 14 costumes were written to
  `C:/crawlball/portraits_out/<name>_kit_halloween_<costume>.yaml`
  (faction `Kit_3`). In-game art keys are `<name>-halloween`, e.g.
  `/portraits/bodil-halloween-town.png`, `/sprites/adventurers/bodil-halloween.png`.

## Quirks — shipped

Rare random boons and flaws on recruit offers and monsters
(`sim/quirks.ts`, pools in `data/quirks.ts`). Quirks are Traits flagged
`quirk: 'good' | 'bad'`, optionally carrying stat `modifiers` and a
targeting `prey`.

- **Rarity**: ~20% get one, ~4% two (`QUIRK_CHANCE`/`SECOND_QUIRK_CHANCE`;
  rolls trigger on *high* rng values so deterministic test rngs returning 0
  never roll one).
- **Heroes** (Strong, Tough, Swift, Lucky, Goblin Hater, Demonbane / Frail,
  Weak, Sluggish, Glass Jaw): rolled per recruit offer alongside the
  Special/Kit re-roll (`rerollOfferedCharacters`), priced ±15% per good/bad
  Quirk, kept for the run if recruited, wiped at run end.
- **Monsters** (Speedy, Brutal, Armored, Mage Striker, Healer Hunter /
  Wounded, Feeble): rolled when a seeded dungeon is built (`room()` only
  rolls with an explicit rng, so hand-built test rooms stay as authored).
- **Prey targeting** (`targeting.ts`'s `preyTargets`): a hunter may strike
  its prey (by creature tag or by role) anywhere, past lane/rank limits,
  and goes for it first; Taunt still overrides. Monsters now carry creature
  tags: goblin, kobold, demon, undead, brute, beast.
- UI: green/red Quirk badges on recruit offers (tooltip = effect); a ✦
  marker with a tooltip on board tokens, including the enemy preview.
- Balance: monster Quirks lean harsher, so floors 2-3 eased ~1.5%. Fresh
  **35.7%** full clear, fully grown 52.0%.

## Adjacency pass — shipped

Formation now matters at the "who stands next to whom" level
(orthogonal neighbors on your grid), with three kinds of mechanics, all
delivered as always-on abilities on characters whose themes fit:

| Character | Ability | Kind | Effect |
|---|---|---|---|
| Bodil | **Bodyguard** (Trait) | Reaction | When an adjacent ally is hit, she takes 40% of the damage instead |
| Glint | **Shield Bearer** (Trait) | Aura | Adjacent allies take 15% less damage |
| Tharavel | **Commanding Presence** (Trait) | Aura | Adjacent allies deal +10% damage |
| Dawneth | **Sanctuary** (Trait) | Aura | Adjacent allies gain +2 armor |
| Mirka | **Avenger** (always-on Special) | Adjacent trigger | When an adjacent ally falls, +50% attack for the rest of the fight |

- Engine: `Aura.range: 'adjacent'` (and `requiresTag` now optional);
  Traits can carry an `aura` (merged into `Adventurer.auras`); auras are
  applied once at fight start as well as each turn. Bodyguard redirects in
  `applyAttackToTarget` and records `battle.pendingIntercepts`, which the
  turn engine emits as `intercept` events (shown in the replay as
  "Bodyguard!" plus the guardian's hit, and counted in run stats). New
  trigger `on-adjacent-ally-downed`.
- Save repair adds missing seeded Traits (and their auras) on load.
- **Formation board**: selecting or dragging a character with an adjacency
  ability highlights the cells it reaches (from the hovered cell while
  dragging); allies currently next to one show a ◆ whose tooltip names the
  effect.
- Balance: the healers recovered (Dawneth 29→~35%, Mira 30→~34%) without
  stat bumps. Enemy scaling nudged up ~2%; Bodil HP 30→34 (Bodyguard soaks
  hits). Fresh **35.4%** full clear, fully grown 54.3%. The sim auto-places
  back-liners two ranks behind, so it under-uses adjacency — deliberate
  formations will do better.

## Kits for everyone — shipped

Every character but Dee now has a Renown-bought Kit (`data/kits.ts`,
`data/kitShop.ts`, 40 Renown each) — 11 new ones with flirty-fantasy
pin-up flavor (Fur & Fury barbarian bikini, Gilded Bikini Mail, Sea-Spray
Corsair, Temple Dancer, Masquerade...).

- **Title vs synergy role**: `Kit.role` became `Kit.title` (display only —
  `sim/kits.ts`'s `displayTitle`), plus an optional `Kit.synergyRole` that
  really changes the character's role for synergies. Three Kits are
  deliberate build levers: **Sea-Spray Corsair** (Drifta) and
  **Masquerade** (Fallacy) count as Rogues, **Field Medic** (Tharavel)
  counts as a Healer. This also fixed the old Kits silently dropping their
  wearer out of Vanguard/Cutthroats.
- **Kits are trade-offs**, not pure upgrades: a strength paid for (mostly
  in Max HP). All Kits owned on a fully grown profile: **58.8%** full clear
  vs 52.3% without (as pure upgrades they tested at +16). The two old
  pure-upgrade Kits (Nerissa, Caladwen) got the same treatment.
- **Free outfit swap**: owning a Kit lets you change outfits whenever you
  like — between rooms (`changeKitDuringRun`, outfit buttons under the
  selected character) and in the opening shop before room 1
  (`changeOpeningKit`) — base outfit or any owned Kit
  (`state/progression.ts`'s `wearKit`, `sim/kits.ts`'s `changeKit`/
  `clearKit`). HP is kept but capped at the new max (no free heal, no
  death by costume change). A run still *starts* in a random owned Kit
  (re-rolled on shop offers); role-swap synergy changes count from the
  next room.
- **Kit art is wired up with fallbacks** (`ui/portraits.ts`'s
  `portraitCandidates`/`downedArtCandidates`/`bodySpriteCandidates`, the
  `use:fallbackSrc` action in `ui/imageFallback.ts`, and the battle scene's
  `bodyTextureFor`): every portrait, card, downed image, formation-board
  sprite and battle sprite tries the Kit's art first and falls back to the
  base art. Drop files in to see them — e.g.
  `/portraits/bodil-fur-and-fury-town.png`,
  `/sprites/adventurers/bodil-fur-and-fury.png`.

## Monster pass: infernal court and demon army — shipped

Four new monsters giving floors 2 and 3 their own identity (not
exclusively — each also turns up occasionally elsewhere):

| Monster | Mostly on | Mechanic |
|---|---|---|
| **Chain Warden** | floor 2 | Displacement — Hook Chain drags the rearmost hero in its target lane to the front, swapping cells, then hits them |
| **Hex Witch** | floor 2 | Debuff — Hex: strongest hero gets −25% attack and is Silenced (3 turns) |
| **Infernal Bannerman** | floor 3 | Ally empower — War Banner: +20% attack for every allied monster, refreshed each turn |
| **Hellforged Guardian** | floor 3 | Ally shields — shields its most-hurt ally every turn |

- Displacement is fight-only: `resolveNextRoom` restores the party's
  formation after every room. New `attack-and-pull` outcome; the replay has
  a new `move` event that slides sprite + HP badge to the new cell.
- `placeEnemies` now places the most constrained enemies (fewest allowed
  ranks) first, so a middle-only Bannerman isn't crowded to the front.
- All four use placeholder sprites.
- **Balance**: scaling re-tuned (floor 2 `[4.8, 5.2, 5.6, 6, 6.2]`, floor 3
  `[6.8, 7.2, 7.6, 8, 7.6]`): fresh **34.1%** full clear (~76% clear floor
  1, ~50% floor 2), fully grown 52.3%. Character nudges for the long run:
  Nerissa attack 5→4; Dawneth HP 18→21, heal 9→10; Bodil HP 26→30; Glint
  HP 24→28, attack 3→4. Spread narrowed from 30-43% to 29-40%.

**Still open:** the healers (Dawneth ~29%, Mira ~30%) remain lowest —
partly by design, since Hook Chain, Hex and the Succubus all go after
back-row/support heroes. A Summoner monster is still unbuilt (needs
mid-fight spawn plumbing).

## 7. Enemy variety — shipped

Five new enemies, each with an enemy-only mechanic (`data/enemies.ts`):

| Enemy | Rooms | Rank | Mechanic |
|---|---|---|---|
| Goblin Flanker | 1-3 | front/middle | **Flank Strike**: melee on the front of the weakest party lane (`selectWeakestLaneFront`) — not bound to its own lane, but can't reach past a lane's front unit |
| Ember Imp | 1-2 | front/middle | **Searing Touch**: melee + Burn |
| Venom Spitter | 2-4 | back | **Venom Spit**: ranged hit on the weakest party member + Poison |
| Bone Sentinel | 3-4 | front | **Thorns** Trait + **Vengeance** (`on-ally-downed`: +50% attack rest of fight) |
| Troll Warlord | 5 (every run) | front | Boss: **Cleave**, **Regenerate** (5% max HP/turn while hurt), **Enrage** Trait (+50% damage below half HP) |

- New sim pieces: an `attack-and-status` outcome (attack + Poison/Burn if
  damage got through), `ENRAGE_TRAIT`, `RegenerateAction`,
  `VengeanceAction`; enemies use `innateSpecialActions` too.
- Room pools: every slot gained mechanic-enemy compositions; room 5 is
  always the Troll plus support.
- **Difficulty curve fixed**: `ROOM_SLOT_ENEMY_STAT_SCALE` →
  `[1.8, 1.9, 2, 2.1, 2.7]`. **53.5% full clear**, and losses now climb
  room by room (4.5% / 6.8% / 8.7% / 9.6% / 17.0%) instead of almost
  never happening before room 4.
- Art: all five use a placeholder sprite (copy of `default_monster.png`)
  until real art exists.

**Still open:**
- **Cleanse** stays out of Dawneth's pool for now; revisit if Poison/Burn
  turn out to matter a lot.
- **Fallacy (~42%)** is now the weakest pick (field ~54%); Tharavel and
  Melpomene (~47%) also trail. Nerissa/Gudrun (~64%) lead.
- A **Summoner** enemy (adds joining mid-fight) was deliberately skipped
  — needs new plumbing.

## 8. Second balance pass — shipped

Target agreed up front: a **~50-60% full-clear rate** for a party that
shops sensibly, tuned via **enemy stats and room compositions only**
(economy and inter-room healing left alone at first; gold income was
raised in a follow-up, step 4), with
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
3. **Outliers fixed** (spread was 34-73%, now 41-67% at the time):
   Rallying Strike armor 3 → 2 (party-wide +3 nearly cancelled
   Kobold/Grunt hits; Glint 73% → 62%); Dawneth healPower 4 → 9,
   attackPower 3 → 4, maxHp 16 → 18; Mira healPower 4 → 8, attackPower 2 → 3;
   Fallacy attackPower 2 → 3, maxHp 16 → 18.
4. **Gold income follow-up.** After step 2, parties only grew 3 → ~4 by
   room 5 and almost never bought a level-up, since enemy drops (~29g/room)
   rarely covered one recruit (50-65g). Target: **1-2 recruit-sized
   choices per pause** for a party with no gold-generating kit. Added a
   flat per-room payout, `RoomDefinition.clearGold`, paid on a win on top
   of enemy drops (`state/dungeonOrchestrator.ts`'s rollLootForRoom) and
   set per slot by `data/rooms.ts`'s `ROOM_SLOT_CLEAR_GOLD`
   (`[60, 55, 55, 55, 55]`). Sim, runs without Nerissa: ≥1 recruit
   affordable at 100% of pauses; ≥2 affordable after room 1/2/3/4 at
   ~5% / 12% / 50% / 80%. Parties now grow 3 → ~7.4 by the finale.
   That made runs trivial (99.5% clear), so `ROOM_SLOT_ENEMY_STAT_SCALE`
   was re-tuned to `[1, 1.3, 1.6, 1.9, 2.2]`: **54.8% full clear** over
   6000 runs, losses by room 0.3% / 1.1% / 3.7% / 14.7% / 25.4%, ~1.4%
   stalemates. Opener full-clear spread is now 42-69%.

5. **Healer redesign.** Mira and Dawneth were the only two characters
   with no damage at all (deliberately left pure-healer by the "All
   Characters Must Attack" cleanup), and trailed every pass. Now every
   character attacks:
   - **Both** have Attack Nearest as their Basic Action, and their heal
     moved to a new always-on Special (`AdventurerTemplate.innateSpecialActions`,
     fired every turn alongside the random pool Special).
   - **Dawneth, lane guardian**: Mending Charge heals her *guard* (the ally
     directly in front of her in her lane — `targeting.ts`'s
     `selectGuardAlly`), else the lowest-HP hurt ally, with no 50% gate.
     **Guardian's Vow** replaced Cleanse in her pool: shields her guard for
     2 + 1 per banked energy (max 10).
   - **Mira, splash potions**: Splash Heal heals the lowest-HP hurt ally
     and half as much onto allies orthogonally adjacent to them (first use
     of `isAdjacent`); skips the turn's heal when nobody is hurt.
   - Saves aren't wiped: `state/persistence.ts`'s `repairKitDrift` updates
     an existing Dawneth/Mira on load (`RETIRED_SPECIAL_REPLACEMENTS` maps
     Cleanse → Guardian's Vow).
   - **Bug fixed along the way**: the battle replay
     (`ui/DungeonPhaseView.svelte`) never animated *any* Special Action's
     effect; its outcome handling is now shared by Basic and Special
     Actions (`pushOutcome`).
   - Result: healers went from ~35-43% to ~53-55% opener clear rate
     (field average ~55%). `ROOM_SLOT_ENEMY_STAT_SCALE` re-tuned to
     `[1, 1.3, 1.7, 2.1, 2.5]` → **55.4%** full clear; character spread is
     now 49-63%, the tightest so far.

**Still open, flagged not fixed:**
- ~~Dawneth (~42%) still trails~~ — resolved by the healer redesign (step 5).
- **Top picks** after the healer redesign: Gudrun (~63%), Dravena and
  Nerissa (~62%) — within ~8 points of the average, no longer an outlier.
- **Rooms 1-3 are now nearly risk-free** (≤5% of runs end there; rooms 1-2
  essentially never); the
  difficulty sits in rooms 4-5, because the party snowballs by ~1 member
  per room and early rooms can't scale much harder without walling the
  3-member opening party. Worth revisiting if early rooms feel flat.
- **Difficulty is very sensitive to the finale scale**: 2.15 → 59.7%,
  2.25 → 52.8%. Any change to gold income or party growth needs the
  scale re-tuned alongside it.
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
- ~~HP displayed as a long float ("27.500000000000004/25")~~ — fixed:
  `sim/stats.ts`'s `getEffectiveStat` rounds effective maxHp (a percent
  maxHp modifier was leaking fractions into HP via heal caps), and HP
  displays now show the effective max (`sim/adventurer.ts`'s
  `effectiveMaxHp`) rather than the base value.
- **Type-check command**: use `npm run check`. The root `tsconfig.json` has
  `"files": []`, so `tsc -p .` checks nothing.
