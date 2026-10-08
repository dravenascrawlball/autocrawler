# Character & enemy ability index

Reference catalog of every character/enemy's current kit — Basic Action
(fires every turn, deterministic), Special Action (trigger + action, at
most one active at a time, drawn from the pool at join/reset), Trait
(always-on passive), and meta-progression unlock (a second pool
candidate, inactive until the character has cleared at least one run —
see `data/characterUnlocks.ts`). Generated from `data/characters.ts` /
`data/enemies.ts` / `data/specialActions.ts` / `data/characterUnlocks.ts`
— if this drifts from the code, the code wins; regenerate rather than
hand-edit.

## Player characters

| Character | Role | Basic Action | Special Action (trigger) | Trait | Meta-progression unlock |
|---|---|---|---|---|---|
| Gudrun | Fighter | Power Attack | — (Traits only) | **Rage** (more damage the lower her HP, always seeded) + **Thorns** (reflects a % of incoming melee damage, single-entry pool) | — |
| Dawneth | Healer | Mending Charge | **Mourning Strike** (`on-turn-start`) — damage scales with built-up heal energy, OR **Cleanse** (`on-turn-start`) — clears status effects from whoever's weakest | — | — |
| Isilwen | Rogue | Card Throw | **Lucky Draw** (`on-turn-start`) — bonus Ranged Shot, OR **Mark** (`on-turn-start`) — target takes +% damage for a duration | — | — |
| Tharavel | Tactician | Attack Nearest | **Inspire** (`on-turn-start`) — party-wide crit buff, OR **Coordinated Strike** (`on-turn-start`) — Command, a bonus attack for an ally, OR **Guardian's Ward** (`on-turn-start`) — full damage immunity for whoever's weakest | — | **Rally Cry** (`on-ally-downed`) — Inspire again when someone falls |
| Bodil | Fighter | Cleave | **Second Wind** (`on-hit-taken`) — Self-Heal, OR **Taunt** (`on-turn-start`) — locks enemy targeting onto her | — | — |
| Glint | Fighter | Rallying Strike | **Guard Up** (`on-hit-taken`) — Empower the party's hardest hitter, OR **Shield Wall** (`on-turn-start`) — grants Shield to whoever's weakest | — | — |
| Drifta | Fighter | Piercing Strike | **Opening Strike** (`on-turn-start`) — bonus Attack Lowest HP, OR **Execute Strike** (`on-turn-start`) — finishes off a target already below 30% HP | **Dodge** (20% chance to fully negate a hit — replaces the old baseline evasion stat) | **Adrenaline Rush** (`on-hit-taken`) — reactive Attack Lowest HP |
| Fallacy | Tactician | Attack Nearest | **Empower** (`on-turn-start`) — attackPower buff to the party's hardest hitter, OR **Command** (`on-turn-start`) — bonus attack for an ally, OR **Silence** (`on-turn-start`) — suppresses a target's Special Actions for a duration | — | — |
| Mirka | Fighter | Attack Nearest | **Last Stand** (`on-ally-downed`) — Attack Nearest, OR **Stun** (`on-turn-start`) — target skips its entire next turn, OR **Fear** (`on-turn-start`) — row-wide vulnerability debuff | — | — |
| Nerissa | Rogue | Pickpocket Strike | **Gilded Strike** (`on-turn-start`) — damage scales with town gold, OR **Chain Strike** (`on-turn-start`) — hits the primary target plus 2 random others at reduced damage | — | — |
| Dravena | Mage | Blinding Bolt | **Arcane Barrage** (`on-hit-landed`) — bonus Ranged Shot, OR **Vanish** (`on-turn-start`) — removes her from enemy targeting for a duration | — | — |
| Caladwen | Rogue | Sneak Strike | **Venom Sting** (`on-hit-landed`) — applies Poison (restored, see roadmap), OR **Lifesteal Strike** (`on-turn-start`) — heals her for a % of damage dealt | — | — |
| Melpomene | Ranger | Focused Shot | **Hunter's Instinct** (`on-enemy-downed`) — bonus Focused Shot, OR **Scatter Shot** (`on-turn-start`) — full damage to 2 random living enemies, any rank | — | — |
| Mira | Healer | Heal | **Potion Toss (Ally)** (`on-turn-start`) — random buff to a random ally, OR **Revive** (`on-turn-start`) — brings a Downed ally back at partial HP | — | — |
| Dee | — (joke/secret character) | Attack Nearest | — | — | — |

**Dee** is the only character with no Special Action/Trait by design —
"the platonic default adventurer, with no specialization to speak of"
(see her template's own doc comment). Every other character now has two
base-pool candidates (see docs/kit-trait-tag-framework.md's second-Special
pass), except Gudrun (two always-active Traits instead, no Special Action
at all) and Tharavel/Drifta, who have a *third* candidate still locked
behind a meta-progression unlock. Tharavel's Guardian's Ward and Dravena's
Vanish are both stand-in picks — their originally-intended abilities
(resource denial / a damage-type layer, respectively) are blocked on
systems that don't exist yet.

## Enemies

| Enemy | Basic Action | Special Action (trigger) |
|---|---|---|
| Kobold Skirmisher | Attack Nearest | **Opportunist** (`on-turn-start`) — bonus Attack Lowest HP |
| Grunt | Attack Nearest | **Heavy Swing** (`on-turn-start`) — bonus Power Attack |
| Brute | Cleave | — |
| Shaman | Heal | **Lash Out** (`on-turn-start`) — bonus Attack Nearest |

No enemy has a Trait yet — flagged on the roadmap as "enemy variety —
still open": kit parity with players exists, but nothing an enemy does
that no player character also does.

## What nobody has yet

Looking across both tables, some trigger/mechanic space is notably
empty:

- **`on-enemy-downed` is used exactly once** (Melpomene) — every other
  "someone died" reaction is `on-ally-downed`. A kill-streak/snowball
  mechanic (reusing the autobattler-mechanics-research.md's charge-meter
  idea, or just a bigger on-enemy-downed payoff) is unclaimed design
  space.
- **Only Gudrun (Rage + Thorns) and Drifta (Dodge) have Traits.** Traits
  are always-on and don't need a trigger at all, which makes them a
  comparatively cheap way to give a character a defining passive (see
  traits.ts) — this axis is used by exactly two characters.
- **Dawneth's Cleanse is the only reaction to Burn/Poison/status
  effects** — every other status interaction is still only something a
  kit *inflicts* (Venom Sting, Ring of Embers), never reacts to (e.g.
  "bonus damage to a poisoned target" is still unclaimed).
- **`on-hit-landed` and `on-hit-taken` skew toward Rogues/Fighters** —
  makes sense thematically, but means Healers/Mages/Tacticians have
  almost no reactive kit, only proactive (`on-turn-start`) or
  death-triggered ones. The second-Special pass added 11 new
  `on-turn-start` abilities and zero new reactive ones, so this gap
  widened rather than closed.
