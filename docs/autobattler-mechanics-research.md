# Mechanics from other grid autobattlers

Research pass triggered by comparing Autocrawler against other grid-based
autobattlers, principally **Tiny Auto Knights** (PvP, 3×3 grid) and **Order
Automatica** (PvE roguelite, 3×3 "ritual grid" — structurally the closest
comparison to us: pre-battle planning, auto-resolve, run-based), with
**Teamfight Tactics**/Auto Chess as the genre's most established reference
for synergy/itemization patterns. Sources at the bottom.

This is a reference list, not a plan — nothing here is scoped or
sequenced. Treat it the same way `docs/roadmap.md` treats an unstarted
item: a candidate worth a real open-questions discussion before any of it
gets built, not a backlog to work through mechanically.

## 1. Role/trait synergy bonuses

**What other games do:** TFT's whole metagame is built on class/origin
traits — having N units sharing a trait grants the whole team an
escalating bonus (e.g. 2 Fighters: +armor; 4 Fighters: +more armor). It's
the single biggest lever for "does this team composition feel coherent,"
not just "is each unit individually strong."

**Why this is the most natural fit for us:** `Adventurer.role` (Fighter,
Rogue, Healer, Mage, Tactician, Ranger) **already exists as a data field
on every character and enemy** — it's explicitly documented as "purely a
display label at the sim level" today, with zero mechanical effect. This
is unused infrastructure sitting right there, not a new system to design
from scratch. A simple version: count living party members per role each
room, grant a small StatModifier bundle (reusing the existing
`modifiers`/`getEffectiveStat` system) once a role count crosses a
threshold (e.g. 2+ Fighters → flat armor; 2+ Healers → healPower
percent). Scales naturally with the 1-9 party size (more roles active as
the party grows mid-run), and gives mid-run recruitment (the
`RecruitOfferModal` flow) a real strategic question — "do I pick the
character who completes a synergy, or the flat-stronger one" — that
doesn't exist today.

## 2. Tile/cell effects on the grid

**What other games do:** Order Automatica calls its grid a "ritual
grid" specifically because the tiles themselves do things — tile
manipulation is a core mechanic, not just where units stand. 9 Kings has
buildings that buff adjacent units. Tiny Auto Knights' whole positioning
layer (front row soaks damage, back row is "safer, but not untouchable")
is itself a tile-effect in miniature.

**Why this fits:** this is the natural **first real consumer** of the
3×3 grid infrastructure that already exists but sits unused —
`GridPosition {lane, rank}` and `isAdjacent` (step 5 of the combat
overhaul) were built and nothing actually reads them for anything beyond
melee-reach fallback. A cell-effect system (e.g. "the center lane grants
+evasion," or a room occasionally spawns a buffed/cursed cell) would be
the thing that finally makes lane choice — not just rank choice — a real
decision, which today's players have zero reason to care about (everyone
defaults to the center lane; see the roadmap's "nobody uses the side
lanes yet" gap).

## 3. Duplicate-character merging / star-up

**What other games do:** TFT's signature mechanic — 3 copies of the same
unit combine into a stronger "starred" version with boosted stats and a
stronger ability. Tiny Auto Knights does the same ("heroes can be
leveled up by merging duplicates").

**Why this fits:** we already have the exact data shape this needs. The
roster is one persistent `Adventurer` record per character — there's
no concept of "owning multiple copies" today, so this isn't a drop-in,
but the *payoff* side already exists: our meta-progression pool-unlock
system (`characterUnlocks.ts`, step 9) already models "this character
permanently gets access to a new ability." A duplicate-triggered unlock
(e.g. town recruitment occasionally re-offers an already-recruited
character; accepting it merges into a permanent stat bump or unlocks
their next pool entry, instead of just being a wasted/redundant offer)
would reuse that exact mechanism rather than building parallel
"starring" infrastructure from scratch.

## 4. A charge-meter / ultimate trigger type

**What other games do:** many autobattlers (TFT included) give units a
mana/charge bar that fills from dealing or taking damage, then unleashes
a powerful effect once full — distinct from "every Nth turn" or
"whenever X happens," because it scales with how much combat a unit is
actually involved in.

**Why this fits:** we already have a working prototype of exactly this
pattern, scoped to one character. Dawneth's Mending Charge
(`battle.ts`'s `healEnergyByUnitId`, `BattleState`) builds a per-unit
energy value over a room, consumed by Mourning Strike's damage scaling.
Generalizing this into a real trigger kind (e.g. `on-charge-full`,
firing once accumulated damage dealt/taken crosses a threshold) would
extend the Special Action & Trigger engine (`sim/specialActions.ts`)
with a resource-based trigger alongside the existing event-based ones
(`on-hit-landed`, `on-ally-downed`, etc.) — a genuinely different trigger
*shape*, not just a new trigger id.

## 5. Crowd-control status effects (freeze/stun)

**What other games do:** Tiny Auto Knights lists freezing alongside
armor and poison as a core status effect — a CC effect that skips a
unit's turn, distinct from damage-over-time.

**Why this fits:** `sim/statusEffects.ts` already has the shape for this
(`ActiveStatusEffect`, the `tickStatusEffects` hook already called every
turn) — Burn and Poison are both damage-over-time; a "Frozen" status
that causes `resolveTurn` to skip the Basic Action entirely for its
duration would be a new *kind* of status effect, not just a new id, but
reuses the same application/ticking machinery. Also gives equipment
(`grantedSpecialAction`) and future character unlocks a new kind of
payload beyond "another attack."

## 6. Relics — party-wide passives, not per-character gear

**What other games do:** both Tiny Auto Knights and Order Automatica
have a separate "relic" system alongside hero-specific equipment —
run-wide passive bonuses that affect the whole party, not one character's
weapon/armor/trinket slots.

**Why this fits:** our equipment model (`EquipmentSlots`: weapon/armor/
trinket) is strictly per-character. There's no "affects the whole party"
item slot today — Glint's Rallying Strike and Tharavel's Inspire *simulate*
party-wide effects through their own kit, but there's no item-driven
equivalent. A small relic system (one or two run-scoped slots, found as
loot, granting a flat party-wide `StatModifier` or triggering a
`SpecialAction` on a chosen trigger for everyone) would be a genuinely
new loot category, not a retheme of an existing one — distinguishes "a
good sword for Gudrun" from "a good find for the whole run."

## 7. Visible turn-order / initiative preview

**What other games do:** Order Automatica's grid cells show the number
indicating when that unit will act in the coming round, before the
player commits to a formation.

**Why this fits:** this is almost pure UI — `getTurnOrder`
(`sim/room.ts`) already computes speed-sorted turn order every round;
nothing currently surfaces it to the player ahead of a fight. Showing
"who goes 1st/2nd/3rd" on the between-rooms screen (or even live during
the grid replay — ties into the HUD rework's status badges, item 1 on
the roadmap) would make the existing Speed stat a visible, planable
lever instead of a hidden number that only shows up as "my turn order
felt right/wrong" after the fact.

## 8. Curses — high-risk, high-reward choices

**What other games do:** Order Automatica explicitly has "curses" as a
category of run modifier — a powerful boon with a real drawback attached,
distinct from a strictly-positive upgrade.

**Why this fits:** our level-up offer system (`sim/leveling.ts`'s
`generateUpgradeOffers`) currently only ever offers strictly-positive
choices (a passive, an action-level bump, a new Face). A "cursed" choice
category (e.g. "+40% damage, -20% max HP" as one of the 3 offered
options) would add a real risk/reward decision to a system that's
currently just "which flavor of upgrade do I want," with no downside
ever on the table.

---

## If picking where to start

**Role synergy (#1)** is the strongest candidate to start with: it reuses
a data field that already exists and does nothing today, it's additive
(doesn't require touching the grid/trigger engine), and it immediately
makes the mid-run recruitment decision (already shipped) more
interesting without new UI. **Tile effects (#2)** is the natural
follow-up once/if lane diversity (the roadmap's open gap) gets addressed,
since it's the mechanism that would finally give lane choice a reason to
matter.

## Sources

- [Tiny Auto Knights — Steam](https://store.steampowered.com/app/3405540/Tiny_Auto_Knights/)
- [Tiny Auto Knights Review — gamecritix](https://gamecritix.co.uk/tiny-auto-knights-review/)
- [Order Automatica — Steam](https://store.steampowered.com/app/2105840)
- [Order Automatica review — kyusaimedia](https://kyusaimedia.com/gaming/order-automatica-review)
- [Order Automatica brings Chess-Like strategy... — gamingonphone](https://gamingonphone.com/news/order-automatica-brings-chess-like-strategy-to-a-dark-roguelite-experience-now-live-on-multiple-platforms)
- [9 Kings Review — bitsnpixels](https://bitsnpixels.org/p/9-kings-review-2025-roguelike-autobattler-balatro)
- [Knightica — prismnews](https://www.prismnews.com/hobbies/mobile-gaming/knightica-brings-grid-based-strategy-to-ios-and-android)
- [Grid Warriors: Battles — Steam](https://store.steampowered.com/app/2783460/Grid_Warriors_Battles/)
- [How To Play Teamfight Tactics — Mobalytics](https://mobalytics.gg/tft/guides/tft-beginners-guide)
- [The DOTA Auto Chess Player's Guide to TFT — Mobalytics](https://mobalytics.gg/blog/tft/the-dac-player-guide-to-tft/)
