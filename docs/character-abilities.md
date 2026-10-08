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

| Character | Role | Basic Action | Special Action (trigger) | Trait | Meta-progression unlock (condition) |
|---|---|---|---|---|---|
| Gudrun | Fighter | Power Attack | — (Traits only) | **Rage** (more damage the lower her HP, always seeded) + **Thorns** (reflects a % of incoming melee damage, single-entry pool) | **Bloodlust** (`on-enemy-downed`) — bonus Power Attack *(3 runs)* |
| Dawneth | Healer | Attack Nearest | Always: **Mending Charge** (`on-turn-start`) — heals the ally in front of her in her lane (else the lowest-HP hurt ally) and banks energy. Plus **Mourning Strike** (`on-turn-start`) — damage scales with banked energy, OR **Guardian's Vow** (`on-turn-start`) — shields the ally in front of her, scaled by energy | — | **Cleanse** (`on-turn-start`) — clears status effects from the weakest ally *(reach room 4)* |
| Isilwen | Rogue | Card Throw | **Lucky Draw** (`on-turn-start`) — bonus Ranged Shot, OR **Mark** (`on-turn-start`) — target takes +% damage for a duration | — | **Wild Card** (`on-hit-landed`) — bonus Card Throw *(clear a run)* |
| Tharavel | Tactician | Attack Nearest | **Inspire** (`on-turn-start`) — party-wide crit buff, OR **Coordinated Strike** (`on-turn-start`) — Command, a bonus attack for an ally, OR **Guardian's Ward** (`on-turn-start`) — full damage immunity for whoever's weakest | — | **Rally Cry** (`on-ally-downed`) — Inspire again when someone falls *(clear a run)* |
| Bodil | Fighter | Cleave | **Second Wind** (`on-hit-taken`) — Self-Heal, OR **Taunt** (`on-turn-start`) — locks enemy targeting onto her | — | **Bulwark** (`on-ally-downed`) — Taunt *(reach room 4)* |
| Glint | Fighter | Rallying Strike | **Guard Up** (`on-hit-taken`) — Empower the party's hardest hitter, OR **Shield Wall** (`on-turn-start`) — grants Shield to whoever's weakest | — | **Hold the Line** (`on-ally-downed`) — Rallying Strike *(3 runs)* |
| Drifta | Fighter | Piercing Strike | **Opening Strike** (`on-turn-start`) — bonus Attack Lowest HP, OR **Execute Strike** (`on-turn-start`) — finishes off a target already below 30% HP | **Dodge** (20% chance to fully negate a hit — replaces the old baseline evasion stat) | **Adrenaline Rush** (`on-hit-taken`) — reactive Attack Lowest HP *(clear a run)* |
| Fallacy | Tactician | Attack Nearest | **Empower** (`on-turn-start`) — attackPower buff to the party's hardest hitter, OR **Command** (`on-turn-start`) — bonus attack for an ally, OR **Silence** (`on-turn-start`) — suppresses a target's Special Actions for a duration | — | **Battle Orders** (`on-turn-start`) — two allies each make a bonus attack *(3 runs)* |
| Mirka | Fighter | Attack Nearest | **Last Stand** (`on-ally-downed`) — Attack Nearest, OR **Stun** (`on-turn-start`) — target skips its entire next turn, OR **Fear** (`on-turn-start`) — row-wide vulnerability debuff | — | **Shockwave** (`on-hit-taken`) — Fear *(reach room 4)* |
| Nerissa | Rogue | Pickpocket Strike | **Gilded Strike** (`on-turn-start`) — damage scales with town gold, OR **Chain Strike** (`on-turn-start`) — hits the primary target plus 2 random others at reduced damage | — | **Fence the Loot** (`on-enemy-downed`) — Pickpocket Strike *(clear a run)* |
| Dravena | Mage | Blinding Bolt | **Arcane Barrage** (`on-hit-landed`) — bonus Ranged Shot, OR **Vanish** (`on-turn-start`) — removes her from enemy targeting for a duration | — | **Blink** (`on-hit-taken`) — Vanish *(reach room 4)* |
| Caladwen | Rogue | Sneak Strike | **Venom Sting** (`on-hit-landed`) — applies Poison (restored, see roadmap), OR **Lifesteal Strike** (`on-turn-start`) — heals her for a % of damage dealt | — | **Ambush** (`on-enemy-downed`) — Sneak Strike *(3 runs)* |
| Melpomene | Ranger | Focused Shot | **Hunter's Instinct** (`on-enemy-downed`) — bonus Focused Shot, OR **Scatter Shot** (`on-turn-start`) — full damage to 2 random living enemies, any rank | — | **Volley** (`on-turn-start`) — full damage to 3 random enemies *(3 runs)* |
| Mira | Healer | Attack Nearest | Always: **Splash Heal** (`on-turn-start`) — heals the lowest-HP hurt ally and half as much to allies adjacent to them. Plus **Potion Toss (Ally)** (`on-turn-start`) — random buff to a random ally, OR **Revive** (`on-turn-start`) — brings a Downed ally back at partial HP | — | **Second Chance** (`on-ally-downed`) — Revive *(clear a run)* |
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
| Goblin Flanker | **Flank Strike** — melee on the front of the weakest party lane (ignores its own lane) | — |
| Ember Imp | **Searing Touch** — melee hit that applies Burn | — |
| Venom Spitter | **Venom Spit** — ranged hit on the weakest party member that applies Poison | — |
| Bone Sentinel | Attack Nearest | Always: **Vengeance** (`on-ally-downed`) — +50% attack for the rest of the fight. Trait: **Thorns** |
| Troll Warlord (boss, every room 5) | Cleave | Always: **Regenerate** (`on-turn-start`) — heals 5% max HP while hurt. Trait: **Enrage** — +50% damage below half HP |

Enemy-only mechanics (enemy variety pass): Flank Strike, Venom Spit,
Searing Touch, Vengeance, Regenerate and Enrage. Enemy rank rules live in
`data/rooms.ts`'s `ENEMY_RANK_OPTIONS`; all five new enemies use a
placeholder sprite (a copy of `default_monster.png`) until real art.

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
- **Nothing reacts to Burn/Poison/status effects any more** — Dawneth's
  Cleanse was the only one, and the healer redesign swapped it for
  Guardian's Vow (Cleanse is still registered, unused). Every status
  interaction is only something a kit *inflicts* (Venom Sting, Ring of
  Embers).
- **Dawneth and Mira are the only characters with an always-on Special**
  (`innateSpecialActions` — fires every turn on top of the pool draw),
  which is how they heal every turn and still attack as their Basic
  Action.
- **`on-hit-landed` and `on-hit-taken` skew toward Rogues/Fighters** —
  makes sense thematically, but means Healers/Mages/Tacticians have
  almost no reactive kit, only proactive (`on-turn-start`) or
  death-triggered ones. The second-Special pass added 11 new
  `on-turn-start` abilities and zero new reactive ones, so this gap
  widened rather than closed.
