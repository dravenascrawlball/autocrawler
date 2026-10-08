# Kit / Special / Trait / Tag framework — plan

Design doc for the next character-variety pass. Scope is **framework +
plan only** — no abilities built yet. Written against
`character-abilities.md` (what we have) and `missing-ability-types.md`
(what we don't), per the feature-workflow discussion that preceded this
doc. Decisions below reflect answers given in that discussion; recorded
here so they don't need re-litigating.

## Decisions locked in

- **Tag effects**: a new declarative **aura** rule type (continuous,
  party-wide, e.g. "+1 shield to all units with tag Bunny on this side")
  *plus* individual abilities may still check `hasTag(unit, 'Bunny')`
  directly for one-off interactions. Both paths coexist.
- **Kit depth**: a Kit swaps StatModifiers, grants/changes Tags, and
  swaps costume art. It does **not** touch Basic Action or die faces —
  that stays Special's job. Kit and Special are orthogonal axes.
- **Reroll timing**: Kit and Trait selection follow the exact lifecycle
  Special Action already has — rerolled on every `resetToTemplateBaseline`
  call (town return / recruit), via the same `pickPoolEntry` mechanism.
- **Trait pool scope**: universal — one shared pool of Traits usable by
  any character (not character-specific like Kit/Special), and a
  character can roll zero, one, or more of them independently of their
  Kit/Special roll.
- **TagId governance**: closed, typed registry (`sim/tags.ts`'s `TagId`
  union) — every tag a Kit/Trait/template grants must come from this
  list, not an ad hoc string.
- **Aura cadence**: recomputed once per turn-engine tick, same cadence
  as Buffs/StatusEffects.
- **Kit display**: an active Kit may override the character's displayed
  role/title (falls back to the template's base role if the Kit doesn't
  specify one).
- **Trait cap at creation/reset**: template-seeded traits (always
  present, e.g. Gudrun's Rage) + up to **2** rolled from the universal
  pool. Mid-run trait *growth* beyond that cap is explicitly wanted
  (see "Trait growth during a run" below) — the 2-trait cap is a
  creation-time ceiling, not a lifetime one.
- **Tags include flavor/physical descriptors, not just mechanical
  synergy labels** — e.g. a character might carry `Elf, Tank, Fire
  Element, Redhead, Goblin Hater, Long Legs` together. This changes the
  tag design (see "Tag categories" below) and the character sheet's
  requirements (see "Display" below).

## 1. Data model additions

### Tags

```ts
// sim/tags.ts
export type TagId =
  | 'bunny' | 'kobold' | 'elf' // species/race
  | 'tank' | 'controller' // archetype/role-ish
  | 'fire' | 'poison' // element
  | 'redhead' | 'long-legs' // physical description
  | 'goblin-hater'; // personality/affinity
  // closed union — add a case here whenever new content needs a new tag

export type TagCategory = 'species' | 'archetype' | 'element' | 'physical' | 'personality' | 'other';

export interface Tag {
  id: TagId;
  name: string; // display label, e.g. "Redhead"
  /** Purely organizational — groups tags for display (see "Display" below); has no effect on aura matching or sim logic. */
  category: TagCategory;
}
```

Since the user's own framing mixes mechanical synergy tags (`Tank`,
`Fire`) with pure flavor/physical-description tags (`Redhead`,
`Long Legs`, `Goblin Hater`) on the same character, **every tag lives in
one registry and one `Adventurer.tags` array** — there's no separate
"flavor tag" type. `category` is metadata for display grouping only;
whether a tag has an Aura hooked to it is just a question of whether
some Aura's `requiresTag` happens to reference it. A tag can exist
purely for flavor today and pick up a mechanical hook later (e.g.
`goblin-hater` starts as flavor, then a future ability keys off it for
"+damage vs. Goblin-tagged enemies") without changing its shape.

Tags are plain labels carried on `Adventurer.tags: TagId[]` (new field).
Sources that can add to this array, in the same spirit as
`traits`/`activeSpecialActions` today:

- **Innate** — set on the `AdventurerTemplate` itself (e.g. every Dee is
  tagged `'secret'`, or a race/species tag like `'kobold'` for enemies).
- **Kit-granted** — a Kit can add tags (e.g. a "Warren Scout" Kit adds
  `'bunny'` to a character who isn't normally one).
- **Trait-granted** — a Trait like "Lycanthropic" could add `'beast'`.
- **Equipment-granted** — lower priority, but `EquipmentSlots` items
  could plausibly grant a tag later (costume items), following the same
  pattern items already use for `grantedSpecialAction`.

Tags are recomputed on `createAdventurer`/`resetToTemplateBaseline`
exactly like `traits`/`activeSpecialActions` — never mutated ad hoc
mid-run except by a buff/status effect that explicitly adds/removes one
(e.g. a "Disguise" effect that temporarily grants a tag — speculative,
not scoped now).

### Auras

```ts
// sim/auras.ts
export interface Aura {
  id: string;
  name: string;
  description: string;
  /** Which side's units this aura scans when active (its owner's side, always — no cross-side auras). */
  requiresTag: TagId;
  /** What every matching unit on the owner's side receives, for as long as the owner is alive and on the field. */
  grants: StatModifier | { grantTag: TagId };
}
```

Evaluated continuously, the same way `modifiers` are already summed for
effective stats — not timed like a Buff, not ticked like a StatusEffect.
Recomputed each time the engine needs effective stats (likely folded
into the existing stat-aggregation step in `stats.ts`, scanning all
live allies for aura-granting units). An aura's own unit does **not**
need the tag itself to grant it (e.g. a non-Bunny unit could carry a
"Bunny Den Mother" trait/aura that buffs Bunnies without being one) —
`requiresTag` describes the *targets*, not the source.

Open implementation question for later (not now): whether aura
re-evaluation happens once per turn-engine tick (cheaper, matches buff
cadence) or is fully continuous (recomputed every time effective stats
are read). Recommend the former when this gets built — flag it on the
roadmap rather than deciding today.

### Kits

```ts
// sim/kits.ts
export interface Kit {
  id: string;
  name: string; // e.g. "Warren Scout"
  description: string;
  /** Replaces (not adds to) the template's base modifiers when this Kit is active. */
  modifiers: StatModifier[];
  /** Tags this Kit grants, additive on top of the template's innate tags. */
  tags?: TagId[];
  /** Asset-lookup key for the alternate costume art — same convention as Adventurer.archetype. */
  artKey: string;
}
```

`AdventurerTemplate` gains `kitPool?: Kit[]` (character-specific, like
`specialActionPool`). `Adventurer` gains `activeKit?: Kit`. Rerolled in
`createAdventurer`/`resetToTemplateBaseline` via a sibling to
`pickPoolEntry` (or an extended `CharacterPoolEntry` union — see below).

A character with no `kitPool` behaves exactly as today: no active Kit,
base template stats/art, unaffected.

### Traits (universal pool)

`traits.ts` already has the right shape (`Trait { id, name, description }`).
What's missing is a **universal pool** independent of any one character:

```ts
// data/traits.ts
export const UNIVERSAL_TRAIT_POOL: Trait[] = [ /* ... */ ];
```

Rolling logic (new, roughly):

```ts
function rollTraits(pool: Trait[], rng: RngSource): Trait[] {
  // e.g. independent Bernoulli per trait at some probability, or
  // weighted "roll N times, dedupe" — exact odds are a balance
  // decision, not an architecture one. Flagged as open below.
}
```

Result is concatenated with the template's own seeded `traits` (Gudrun
keeps Rage unconditionally; the universal roll is additive on top).
Creation-time roll is capped at 2 from the universal pool, regardless
of pool size.

### Trait growth during a run

Explicitly wanted: a way for a character to **gain an additional Trait
mid-run**, beyond the 2-trait creation cap — e.g. as a level-up reward,
a rare room/event outcome, or an item effect. This is new design space
this doc doesn't fully scope, but the natural hook is
`leveling.ts`'s existing `pendingUpgradeChoices`/`UpgradeChoice`
machinery (already the mechanism for "player picks from a short list of
upgrades mid-run") — a new `UpgradeChoice` variant ("gain a Trait: pick
one of 3 drawn from the universal pool") would reuse that plumbing
rather than inventing a second upgrade-choice system. Whether it's
level-up-gated, run-event-gated, or both is a balance call for when
this gets built, not an architecture one.

Important: because growth is uncapped (a character could end a run with
3, 4, 5+ traits), the data model (`Adventurer.traits: Trait[]`) doesn't
need a cap enforced in the type — only the *creation-time roll* is
capped at 2. `resetToTemplateBaseline` returning a character to their
2-trait-or-fewer baseline between runs (traits are run-scoped progress,
same tier as levels/XP — not a cross-run unlock) is the default
assumption; flag if mid-run trait gains should instead persist like
equipment does.

### Tying it together in `createAdventurer`

Today, `pickPoolEntry` draws **one** entry from a combined
special-action/trait pool. Splitting Kit out from that union means three
independent rolls at creation time:

1. `pickPoolEntry(template.kitPool ?? [], rng)` → `activeKit`
2. `pickPoolEntry(template.specialActionPool ?? [], rng)` → `activeSpecialActions` (unchanged)
3. `rollTraits(UNIVERSAL_TRAIT_POOL, rng)` concatenated with `template.traits` → `traits` (unchanged mechanism, new source)

This is a strictly additive change to `characterPool.ts` — existing
`CharacterPoolEntry` for special-action/trait pools stays exactly as is;
Kit gets its own pool array rather than joining that union, since it's
now orthogonal rather than mutually exclusive with Special.

## 2. Second Special Action per character

This part needs **no new framework** — `specialActionPool` already
accepts multiple entries and `pickPoolEntry` already picks randomly
among them. The work here is purely content: for each character, pick
one ability from `missing-ability-types.md`'s catalog that fits their
theme, write it as a `SpecialAction`, and add it to their template's
`specialActionPool` as a second entry.

**Status: built.** All 14 eligible characters now have a second ability
(Dee stays empty by design); see `docs/character-abilities.md`'s table
for the live, authoritative list. What actually shipped per character,
and the new mechanics each one required:

| Character | 2nd ability | New mechanic required |
|---|---|---|
| Gudrun | **Thorns** (Trait, not a Special — a true passive like Rage) | Checked directly in `applyAttackToTarget` (reflects % of final damage onto the attacker) |
| Dawneth | **Cleanse** | None — clears `statusEffects`, reuses existing fields |
| Isilwen | **Mark** | New `vulnerability` synthetic stat, read in `applyAttackToTarget` as a damage multiplier |
| Tharavel | **Guardian's Ward** (stand-in — resource denial is still blocked) | New `invulnerable` synthetic stat, checked in `applyAttackToTarget` before Shield even gets to absorb |
| Bodil | **Taunt** | New `isTaunting`/`livingTaunters` in `targeting.ts`, overriding `selectFirstEnemy`/`selectLowestHpEnemy` |
| Glint | **Shield Wall** | New `shields.ts` module (depletable absorb pool, its own tick cadence) |
| Drifta | **Execute Strike** | New `attack-with-execute` outcome; checks HP% threshold before the hit, finishes the target off after |
| Fallacy | **Silence** | `isSilenced` check in `specialActions.ts`'s `resolveSpecialActionTriggers` (suppresses all of a unit's Special Actions) |
| Mirka | **Stun** | `isStunned` check in `turnEngine.ts`'s `resolveTurn` (skips the whole turn — Basic Action and `on-turn-start` Special alike) |
| Nerissa | **Chain Strike** | Reuses `attack-multi`; new `pickRandomDistinct` helper for the bounce targets |
| Dravena | **Vanish** (stand-in — the damage-type layer is still blocked) | New `isStealthed` filter in `targeting.ts`'s `livingOpponents`, with a safety-valve fallback if it would leave zero targets |
| Caladwen | **Lifesteal Strike** | New `attack-and-heal-self` outcome; heals the attacker off the target's own post-Shield damage |
| Melpomene | **Scatter Shot** | Reuses `attack-multi` + `pickRandomDistinct`, full damage per hit (no falloff, unlike Chain) |
| Mira | **Revive** | New `selectDownedAlly` targeting helper + `revive` outcome; clears `downedSummary` so a later down gets a fresh one |
| Dee | — (by design) | n/a |

All of Taunt/Silence/Stun/Invulnerability/Stealth share one convention:
a timed Buff on a synthetic stat nothing else reads numerically (same
trick Fear/Blind already used for their own debuffs) — the *consumer*
(targeting.ts, specialActions.ts, turnEngine.ts, or attack.ts) checks
`getEffectiveStat(0, '<flag>', modifiers) > 0` rather than a dedicated
tracked field. Cheap to add, and ticks down for free via the existing
Buff machinery.

Two entries (Tharavel, Dravena) used a **stand-in pick** rather than
their originally-suggested ability — Resource Denial and a
damage-type layer are both still blocked on systems this doc doesn't
scope (the charge-meter system, and a damage-type/resistance layer,
respectively). Revisit both when/if those systems get built.

## 3. Fully missing archetypes

Looking at `character-abilities.md`'s role column (Fighter, Healer,
Rogue, Tactician, Mage, Ranger) cross-referenced against
`missing-ability-types.md`'s gaps, these are **roles/playstyles nobody
on the roster currently covers at all** — not just missing abilities on
existing characters, but character concepts with no representative:

- **Tank** — a role built around *being targeted* (Taunt) and mitigating
  (Shield), not just high HP/armor. Nobody's kit is built to actively
  pull aggro today.
- **Summoner** — spawns a temporary unit onto the grid. No character
  concept touches this at all; needs the "add a unit mid-room" plumbing
  flagged in `missing-ability-types.md`.
- **Controller/Debuffer** — a character whose whole kit is Stun/Silence/
  Mark, control rather than damage/healing. Closest today is support-
  debuff (stat-lowering), but nothing disables actions outright.
  (Note: Fallacy/Isilwen picks above start covering this at the ability
  level — a dedicated Controller *character* would go further, built
  entirely around this.)
- **Elementalist** — only relevant if the damage-type/resistance layer
  gets built; a character whose whole identity is "fire vs. poison vs.
  physical" typing.
- **Positioner/Battlefield-control** — push/pull/swap grid positions.
  No character concept uses positioning as their payoff today (only as
  a static identity, e.g. Isilwen's ranged `defaultRow`).
- **Tag-synergy character** — once Tags/Auras exist (part 1 above), a
  character whose whole kit is granting/buffing tags on allies (a
  "Bunny Den Mother" style unit) becomes a new archetype in its own
  right, distinct from anything on the roster now.

These are **concepts to design named characters around**, not systems
to build yet — Summoner and Elementalist both need their underlying
mechanic built first (flagged above); Tank, Controller, and Positioner
could be built with *today's* sim plus the handful of abilities already
listed in the table above.

## Display

Flagged by the user as a real concern, not an afterthought: once Tags
cover species/archetype/element/physical/personality all at once (e.g.
`Elf, Tank, Fire Element, Redhead, Goblin Hater, Long Legs` on one
character), a flat tag list reads as a wall of text and buries the
tags that actually matter mechanically (the ones an Aura keys off of).
Recommendations for whenever the character sheet gets built (roadmap
has a "needs some surface" note on this already):

- **Group by `category`** when rendering — species/archetype/element
  together (the "mechanically relevant, likely to matter for synergy"
  tags) visually separated from physical/personality (pure flavor).
- **Call out tags with an active Aura hook** distinctly (e.g. a small
  icon or different styling) so a player scanning the sheet can tell
  "this tag is doing something right now" from "this tag is flavor."
  This needs the Aura registry to expose "which tags currently have at
  least one Aura referencing them" — cheap to compute, worth adding as
  a small helper rather than hand-tracking it.
- **Traits need room for more than 2** on the sheet layout from the
  start, since mid-run growth (above) means the common case in a long
  run may exceed the creation-time cap — don't build a 2-slot-only
  layout that needs rework the moment growth ships.

None of this blocks the sim-side framework (part 1) — it's a UI
constraint to keep in mind when `Adventurer.tags`/`traits` design
locks in field shapes, and a reason to prefer `category` as real
metadata now rather than bolting it on after the character sheet exists.

## Sequencing recommendation

1. Build Tags + Auras (part 1) — smallest, most reusable piece, and the
   party-wide aura is the one net-new mechanic nothing else depends on.
2. Build Kit (part 1) — depends on nothing but Tags for the tag-grant
   side; stats/art side is independent.
3. Write the second Special Action per character (part 2) — mostly
   content work once the Tag/Kit plumbing isn't competing for the same
   `pickPoolEntry` call sites.
4. Revisit archetypes (part 3) once 1–3 are live and a couple of new
   Kits/Traits exist to compose with — easier to judge "is this really
   a new archetype" once Tags give characters more to differentiate on
   than stats alone.

Still open, deliberately left for when we scope each piece for real:
which blocked second-Specials (Tharavel, Dravena) get a stand-in gap
instead; the exact trigger(s) for mid-run Trait growth (level-up choice,
run event, item, or some mix); and whether Traits gained mid-run persist
across runs or reset with everything else `resetToTemplateBaseline`
touches (current default assumption: they reset, same tier as levels).
