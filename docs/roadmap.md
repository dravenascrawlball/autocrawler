# Roadmap

Follow-on features after the core loop (town → dungeon → town, with gold and
recruitment already shipped). Ordered so each step has the content/systems
it needs already in place, and so polish happens last rather than being
redone when mechanics underneath it change.

**Process:** before coding any item on this list, Claude asks open
questions about it and we discuss the shape of the feature first — see
`CLAUDE.md`. This file is the queue, not a spec.

## 1. Infrastructure housekeeping

- **UI-level test coverage.** Not a discrete step so much as an ongoing
  practice — infra now exists (`@testing-library/svelte` + jsdom, opt-in
  per file via `// @vitest-environment jsdom` so the much larger sim/state
  suite stays on fast `node`; `test.globals: true` added so
  testing-library's auto render-cleanup between tests actually registers;
  `resolve.conditions: ['browser']` under `VITEST` so Svelte resolves its
  client build instead of SSR, which otherwise throws on `mount()`).
  Backfilled smoke coverage for `BenchView` (duplicate-name safety, Lost
  filtering, trait display), `NewGameView` (the confirm/cancel flow),
  `TownPhase` (tab switching), and `ShopView` (afford/disabled logic).
  Keep adding thin coverage as the UI grows, rather than after it already
  has.
- **Town/Dungeon cleanup pass — shipped.** Landscape character cards
  (Roster/Recruit/Embark), recruitment limit removed, Bench vs Draftable
  split, condensed read-only Dice Faces with tooltips, Embark drafting
  tooltip, centered card grids, a Settings tab (Reset Game moved there),
  dungeon formation grounded/aesthetically positioned, dungeon canvas
  fit-to-frame, widened/centered Level Up frame, card-style Loot window,
  landscape Between-Rooms cards, the Kobold Skirmisher asset-naming fix,
  killer-specific Downed art between rooms, and opaque dungeon HUD boxes.

## 2. Final polish pass

Animation timing, juice, audio. The original "polish" step, last because
there's finally a complete game to polish rather than a moving target.

**Future idea, not scoped:** the character sheet's Dice Faces box
(`ui/CharacterSheetView.svelte`) currently shows each of the 6 faces as a
text row (action name + swap-in/enchant controls). Replace with actual
die-face tile art (real icons, not pip dice) once that art exists —
flagged during the character-sheet layout pass rather than built blind.

## 3. Character differentiation — mostly shipped

Give each archetype a real distinguishing mechanic (moderate divergence,
not a full per-archetype-resource redesign — shared dice-face/action
system, each with a distinct action pool plus a signature passive/trait
only it has). **Status: done for every existing character.** Every
character in `data/characters.ts` now has a bespoke template with a
signature mechanic (Bodil's Cleave, Glint's Rallying Strike, Drifta's
Piercing Strike, Fallacy's Empower/Command, Mirka's Fear, Nerissa's
Pickpocket/Gilded Strike, Dravena's Blinding Bolt, Tharavel's Inspire,
Dawneth's Mending Charge/Mourning Strike, Gudrun's Rage, Caladwen's
Sneak Strike) — the old generic `fighterTemplate`/`healerTemplate`/
`rangerTemplate`/`tacticianTemplate` factories are all gone. Critical
hits are also already a real mechanic (`sim/actions/attack.ts`'s
`rollIsCrit`), not just referenced — that open flag is resolved.

**Folded in here:** enchantment expansion. Two enchantments now exist
(`sim/enchantments.ts`): Burning (Gudrun's signature Power Attack face)
and Poison (Caladwen's signature Sneak Strike face) — a target can carry
both independently. Room for more (freeze, stun-on-crit, etc.) once
another character calls for one, rather than adding speculatively.

**Target roster, one character at a time.** Below is the full intended
end state, name by name — final archetype plus signature action(s)/
mechanic. This is a big, multi-step change; per `CLAUDE.md`, each
character gets its own open-questions pass before coding rather than
building the whole list in one go. Treat this list as the destination,
not a build order — pick which character to start with when ready.

- **Bodil — Fighter.** Tanky. Broad attack that hits a full column.
  Small self-heal.
- **Caladwen — Rogue.** Quick attacker, can sometimes target the back
  row. Poison damage.
- **Dawneth — Healer.** Primary healer. Possibly builds energy from
  healing toward a magic "Mourning Strike."
- **Dravena — Mage.** Squishy caster. Damage plus a blind that lowers
  enemy attack.
- **Drifta — Fighter.** High dodge. Can target the back row while she
  herself is in the front row.
- **Fallacy — Tactician.** "Fashionable." Can grant allies an attack
  boost, and can make an ally attack.
- **Glint — Fighter.** High defense, sword-and-board, near-Paladin
  build. Rallying Strike raises allies' defense.
- **Gudrun — Fighter.** Damage-focused, keeps Power Attack. Possible
  Rage mechanic (more damage at lower health?).
- **Isilwen — Rogue.** Chaotic ranged. Throws cards for variable
  ranged damage at a random enemy.
- **Melpomene — Ranger.** Focuses down low-HP enemies with
  lower-damage targeted attacks.
- **Mirka — Fighter.** Front-row tank who can apply Fear.
- **Nerissa — Rogue.** "Econ" rogue. Strikes can generate gold; has an
  attack that does more damage the more gold the party is carrying.
- **Mira — Healer.** Chaotic healer/support — throws potions at
  allies for random buffs, or enemies for random debuffs.
- **Tharavel — Tactician.** Raises allies' accuracy and critical
  chance.

**Status: item 3's target roster is now fully built.**
- **Caladwen — done.** Rogue, quick attacker via Sneak Strike (usually a
  normal front-row hit, ~35% chance to instead strike a random back-row
  enemy directly), one face enchanted Poison.
- **Melpomene — done.** New Ranger (first use of that role label),
  defaults to the back row. Focused Shot reaches either row directly
  like a normal ranged attack but targets the lowest-HP living enemy,
  at plain (unmultiplied) damage — a real gap the existing melee-only
  `AttackLowestHpAction` didn't cover. No portrait art yet (a sprite
  exists at `public/sprites/adventurers/melemnope.png`, but no
  `public/portraits/melemnope-*.png` files) — falls back gracefully
  (missing-art convention already in place), just needs the art itself.
- **Mira — done.** New Healer, "chaotic support": Potion Toss (Ally)
  throws a random buff (attackPower or accuracy) at a random living
  ally; Potion Toss (Enemy) throws a random debuff at a random living
  enemy (new generic `support-debuff` outcome type, the debuff
  counterpart to the existing `support-buff`). Also keeps a plain Heal
  face so she's a real healer, not just chaos. Full art already exists
  (portraits, sprite, downed art).
- Envy has been retired — removed from `CHARACTER_TEMPLATES` entirely
  rather than getting a signature kit.

## 4. Enemy variety — in progress

Only 4 enemy templates exist (`data/enemies.ts`: Kobold Skirmisher,
Grunt, Brute, Shaman). Add behavioral variety and ensure they are
differentiated from each other.

**Direction agreed going in:** benefits most from item 3 (character
differentiation) landing first, since new enemies can be designed to
counter/pressure the player's new archetype mechanics (and can draw on
whatever enchantments item 3 adds) rather than being designed blind and
needing an immediate second balance pass. Item 3 is now done.

**First step, done:** the 3 single-action enemies now mix in a second
existing action each, instead of being 6-of-the-same-face reskins —
Kobold Skirmisher (mostly Attack Nearest, 2 Attack (Lowest HP) faces —
hit-and-run, picks off the weak), Grunt (mostly Attack Nearest, 2 Power
Attack faces — basic soldier, occasional hard hit), Brute (mostly
Attack Nearest, 2 Cleave faces — heavy smasher, hits the whole row).
Shaman already had a 2-action heal/attack mix from before. No new
actions or enchantments introduced yet — this only recombines what
already existed for player characters.

**Still open:** enemy-only signature mechanics/enchantments (the
original scope of this item) — Poison/Burning use on an enemy, a
distinct behavior no player character has, etc.

## 5. Second balance pass

Character differentiation and enemy variety (items 3-4 above) will shift
the numbers again (new archetype mechanics, new enemies), on top of the
already-shipped level-up rework and equipment rework — a follow-up
tuning pass using the existing `balanceSim.test.ts`/
`combatMagnitudes.test.ts` tooling, once both land rather than re-tuning
after each one individually.

## 6. Loss and Win Info — shipped

When the dungeon is lost or won, there's not a lot of information, fanfare
etc. Let's work on a review screen for either of those.

**Direction agreed going in, done:** enhanced the existing end-of-run
screen (the same Between-Rooms screen, `DungeonPauseView.svelte`, once
`runOutcome !== null`) rather than a new modal/screen — a `.run-recap`
section now shows rooms reached (out of the run's total), gold gained,
loot found, and a per-character damage-dealt/taken/healing-done
breakdown, all from data already tracked
(`Adventurer.runDamageDealt`/`runDamageTaken`/`runHealingDone`, already
accumulated live all run — see `sim/room.ts`'s `applyTurnStats`), so
nothing new needed instrumenting. "Rooms reached" rather than "rooms
cleared" — a deliberate simplification, see the component's own doc
comment for why that distinction wasn't worth threading through just
for this summary.

**Done first, as a related foundation:** `state/runHistory.ts` now
records which characters have been in the party for at least one
*completed* (won) run — every party member gets credit, not just
survivors. Persisted (`GameState.runHistory`, save v14), and
deliberately untouched by New Game (reads as permanent profile
progress, not save-file state — see newGame.ts's doc comment). Pure
background tracking for now, no UI yet — meant to back a future
achievements/branching-paths system (e.g. a story path only unlocked
once cleared with a specific character).