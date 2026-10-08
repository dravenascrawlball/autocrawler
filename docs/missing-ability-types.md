# Ability types other autobattlers have that we don't

Gap analysis of *ability archetypes* — not macro-systems (that's
`docs/autobattler-mechanics-research.md`) — comparing TFT/Auto Chess,
Tiny Auto Knights, and the genre's common tropes (Hearthstone
Battlegrounds, Super Auto Pets, Mechabellum) against what our current
vocabulary can actually express. Companion to
`docs/character-abilities.md` (what we *do* have today).

**Our current vocabulary**, for reference: `ActionOutcome` supports
attack / attack-multi / attack-and-buff / heal / support-buff /
support-debuff / command (bonus ally turn) / fear / attack-and-gold /
attack-and-debuff / heal-and-charge / party-buff / retreat /
inflict-status. Status effects are burn/poison, both plain
damage-over-time. Triggers are `on-turn-start`, `on-hit-landed`,
`on-hit-taken`, `on-ally-downed`, `on-enemy-downed`. Buffs/debuffs are
generic `StatModifier`s (flat or percent, on any stat).

This is a reference list, not a plan — same caveat as the mechanics
research doc. Nothing here is scoped.

## Defense / mitigation

| Ability type | What it does | Seen in | Do we have it? |
|---|---|---|---|
| **Shield** | A temporary HP buffer that absorbs damage before real HP, separate from healing or armor — it doesn't restore lost HP, it blocks the next hit(s). | TFT (core keyword), Tiny Auto Knights | No. Our only damage mitigation is flat `armor` StatModifier (always-on, never a depletable pool) and healing (restores HP directly, can't be applied pre-emptively to "waste" a hit). |
| **Taunt** | Forces enemies to target the taunting unit, overriding their normal targeting. | TFT (explicit keyword) | No. Targeting today is purely rank/row-based (`meleeEligibleOpponents`) or stat-based (lowest HP, nearest) — nothing lets a unit *compel* targeting regardless of position. |
| **Stun** | Target can't act (skip their Basic Action/trigger) for a duration. | TFT, Tiny Auto Knights ("freezing") | No — flagged already in the mechanics research doc. `tickStatusEffects` only ever deals damage today. |
| **Silence** | Target can still act (Basic Action fires) but can't use their Special Action/ability for a duration — distinct from Stun, which disables everything. | TFT (explicit keyword) | No. There's no concept of suppressing just the trigger-resolution half of a turn. |
| **Invulnerability / damage immunity window** | Target takes zero damage for a short duration, distinct from a Shield (no absorb cap, just immune). | Common genre trope (e.g. "untargetable," "evasion window") | No. Evasion already exists as a percent-chance miss stat, but there's no guaranteed "can't be hit" window. |
| **Stealth / untargetable** | Removes the unit from normal targeting pools entirely for a duration (not just harder to hit — genuinely unselectable). | Tiny Auto Knights ("stealth abilities") | No. |

## Offense

| Ability type | What it does | Seen in | Do we have it? |
|---|---|---|---|
| **Execute** | Guaranteed kill (or bonus damage) against a target below an HP% threshold, distinct from just targeting lowest-HP (which can still take multiple hits to finish). | Hearthstone Battlegrounds, many TFT champions | No. Melpomene/others target lowest-HP, but nothing checks "is this target below X% and finishes them outright." |
| **Lifesteal / vampiric damage** | A hit heals the attacker for a percent of damage dealt. | TFT (a universal item stat — Hand of Justice, Bloodthirster), Auto Chess | No. Healing and attacking are always separate `ActionOutcome`s; nothing derives a heal amount from a hit's own damage. |
| **Reflect / thorns** | A passive that returns a percent of incoming damage to the attacker — different from our `on-hit-taken` Special Actions (which do an independent follow-up action, not damage proportional to what was just taken). | Common genre trope, often as a Trait-equivalent | No real equivalent — closest is Drifta's Adrenaline Rush, but it's "attack the weakest enemy," not "return damage to whoever just hit me." |
| **Mark / vulnerability debuff** | A debuff that increases damage the target takes from future hits (not reduced accuracy/attackPower on the attacker — specifically "this target takes +X% damage"). | TFT, Mechabellum | No. Our `support-debuff` outcome lowers the target's own stats (attackPower, accuracy); nothing scales incoming damage multiplicatively. |
| **Chain / bounce damage** | A single cast that hits N additional random targets in sequence, each for (often reduced) damage — distinct from Cleave's "everyone at this rank." | TFT (several champions), Auto Chess | No. Cleave is our only multi-target attack, and it's rank-scoped, not count-scoped or chain-scoped. |
| **Area-of-effect beyond "whole rank"** | Radius/cone/random-N-target AoE independent of grid rank — relevant now that we have real `{lane, rank}` positions, not just front/back. | TFT, Mechabellum | No. Cleave is the only AoE-shaped action, and it's hard-coded to "same rank as primary target." |

## Support / utility

| Ability type | What it does | Seen in | Do we have it? |
|---|---|---|---|
| **Cleanse / dispel** | Removes a negative status effect (or an enemy buff) from a target. | TFT, common genre trope | No. Nothing in our kit vocabulary removes a status effect or buff early — Burn/Poison/debuffs only ever expire on their own timer. |
| **Revive / resurrection** | Brings a Downed ally back into the fight, usually at partial HP. | TFT (e.g. Anivia-style passive revives), common "support ultimate" archetype | No. `hp <= 0` is permanent for the rest of a room (and the rest of a run, via `downedDuringRun`) — there's no path back in. |
| **Summon** | Spawns a new, temporary unit onto the grid mid-fight. | TFT (several champions), Auto Chess | No. Our grid population is fixed at room start; nothing adds a unit to `battle.adventurers`/`battle.enemies` mid-room. |
| **Position swap / displacement** | Pushes, pulls, or swaps a unit's grid position mid-fight. | TFT, Mechabellum | No. `Adventurer.position` is read for targeting but never written during combat — positions are static once a room starts. |
| **Resource denial** | Reduces an enemy's buildup toward their own payoff (e.g. draining a charge meter) rather than affecting HP/stats directly. | TFT (mana-drain effects) | N/A today — we don't have a charge-meter trigger type yet (see item 6/9 on the roadmap), so there's nothing to deny yet. Worth keeping in mind if that system gets built. |

## Elemental / damage-type layer

| Ability type | What it does | Seen in | Do we have it? |
|---|---|---|---|
| **Damage types + resistances** | Attacks deal a typed damage (fire/poison/physical/etc.), and units can resist or be weak to specific types — a rock-paper-scissors layer on top of flat armor. | Tiny Auto Knights ("fire spells" alongside poison), common genre trope | No. All damage is untyped; `armor` mitigates everything equally, and Burn/Poison are flavor-named DoTs with no type-resistance interaction. |

---

Cross-reference: several of these (Shield, Stun, Mark/vulnerability,
Cleanse) would slot naturally into the existing `StatusEffectId`/
`ActiveBuff` machinery (`sim/statusEffects.ts`, `sim/buffs.ts`) as new
effect *kinds*, not just new content — same observation the mechanics
research doc made about the charge-meter and freeze ideas. Position
swap/displacement and Summon are the two that would need genuinely new
plumbing (nothing today writes `position` after room start, or adds
units to `battle.adventurers`/`battle.enemies` mid-room).
