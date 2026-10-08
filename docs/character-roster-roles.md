# Crawlball roster → Autocrawler roles

Role breakdown of every Crawlball character who **isn't in the game yet**,
based on their Crawlball stats (`crawlball_character_directory.csv`).
Each one gets the role their stats fit best, using Autocrawler's role
vocabulary: the roles that already exist (`character-abilities.md`), the
missing archetypes (`kit-trait-tag-framework.md` §3), and eight
additional class shapes proposed here. The goal is a starting point for
handing out abilities. It's a reference list, not a plan, so nothing here
is scoped.

## Role glossary

### Existing roles (on the roster today)

| Role | Shape | In game today |
|---|---|---|
| **Fighter** | Front-line melee damage. Hits hard, takes hits, often has a self-sustain or retaliation tool. | Gudrun, Bodil, Glint, Drifta, Mirka |
| **Rogue** | Evasive damage dealer: dodges, picks off weak targets, debuffs single targets (Mark, Execute, Vanish). | Isilwen, Nerissa, Caladwen |
| **Ranger** | Back-row precision damage; picks targets anywhere on the grid. | Melpomene |
| **Mage** | Back-row magic damage, usually with on-hit bonus casts. | Dravena |
| **Healer** | Restores HP, clears statuses, brings allies back. | Dawneth, Mira |
| **Tactician** | Makes *allies* better: buffs, bonus ally turns (Command), protection. | Tharavel, Fallacy |

### Missing archetypes (from the kit/trait/tag framework)

| Role | Shape | Status |
|---|---|---|
| **Tank** | Built around *being targeted*: Taunt, Shield, Thorns, self-sustain. Not just high HP. | Buildable today |
| **Controller** | Disables rather than damages: Stun, Silence, Fear, Mark as a whole kit. | Buildable today |
| **Summoner** | Spawns temporary units onto the grid; the summons do the fighting. | Needs add-a-unit-mid-room plumbing |
| **Elementalist** | Identity built on damage types and resistances (fire vs. poison vs. physical). | Blocked on the damage-type layer |
| **Positioner** | Pushes, pulls or swaps grid positions as its payoff. | Needs position writes mid-room |
| **Tag-synergy** | Buffs or grants tags to allies via auras (the "Bunny Den Mother" shape). | Blocked on Tags/Auras |

### Additional class shapes (proposed here)

| Role | Shape | Status |
|---|---|---|
| **Martyr** | Pays off when it goes down: explodes, buffs the party, or leaves a ward behind. Pairs with Revive, since every death is another payoff. | Needs a new `on-self-downed` trigger (small) |
| **Afflictor** | Damage comes from stacking Burn/Poison and then cashing it in ("bonus damage to a poisoned target"). Damage over time, not control. | Buildable today; needs a status-aware damage check |
| **Scaler** | Gets permanently stronger with each kill, room or turn survived. Weak early, a carry if kept alive. | `on-enemy-downed` exists; persisting gains across rooms needs run-scoped modifiers |
| **Duelist / Counter** | Does most of its work on the *enemy's* turn: riposte when hit, intercept hits aimed at allies, punish the attacker. | `on-hit-taken` exists; intercept needs a new `on-ally-hit` trigger |
| **Tempo** | Manipulates turn order: hastes allies, slows enemies, grants extra turns. | Buildable today (speed StatModifiers + Command) |
| **Gambler** | Every action has a random outcome. Sometimes huge, sometimes backfires. Scales with luck. | Buildable today |
| **Prospector** | Mediocre in a fight, but earns extra gold, loot or XP. Trades power now for power later. | Partially buildable (`attack-and-gold` exists); loot/shop hooks are new |
| **Charger** | Spends several turns building up, then lands one huge hit. Natural target for resource denial. | Blocked on the charge-meter system |

## Method

- **Stats used:** speed, attack, defense, grit, accuracy, evasion, magic,
  ward, luck, hp_max. `morale` is left out because it's a run-state value,
  not a build stat. `charisma` is 0 for everyone.
- **Population baseline** (mean ± sd across the 86 rows that have stats):
  SPD 33±10 · ATK 28±10 · DEF 25±10 · GRT 21±9 · ACC 37±7 · EVA 30±9 ·
  MAG 20±15 · WRD 26±12 · LCK 22±5 · HP 38±8. A stat "leads" when it sits
  well above this baseline, not just when it's the biggest raw number.
  Accuracy is high for everyone, so ACC 44 is unremarkable while LCK 30
  stands out.
- **Crawlball's role column** (Tank / Striker / Mage / Balanced) is the
  first cut. The leading stats then split each group into a specific
  Autocrawler role.
- **Alt role / flavor hook** is a secondary suggestion. Where it comes
  from the name or race rather than the stats, it says so. The best-fit
  role is stat-driven, except for shapes no stat predicts (Summoner,
  Positioner, Tag-synergy, Martyr, Prospector), where flavor and weak
  personal stats decide.
- † = `fallen` in Crawlball (died in a dungeon), which could matter for
  continuity.

### Precedent: how the current roster translated

Crawlball role turned out to be only a loose guide for the characters
already ported:

| Character | Crawlball role | Crawlball stat lead | Autocrawler role |
|---|---|---|---|
| Gudrun | Balanced | even spread | Fighter |
| Dawneth | Mage | MAG 49 / WRD 50 | Healer |
| Isilwen (Jinglewick) | Balanced | even spread | Rogue |
| Tharavel | Balanced | SPD 37 / ATK 34 | Tactician |
| Bodil | **Tank** | DEF 43 / HP 52 | Fighter |
| Glint | Striker | SPD 49 / EVA 43 | Fighter |
| Drifta | Balanced | ACC 41 | Fighter |
| Fallacy | Striker | ACC 47 / EVA 46 | Tactician |
| Mirka | Striker | EVA 46 / ATK 43 | Fighter |
| Melpomene | **Tank** | DEF 42 / WRD 40 | Ranger |
| Caladwen | Balanced | SPD 34 | Rogue |
| Nerissa | — (no stats row; crawl stats AGI 44 / CHA 32) | — | Rogue |
| Dravena | — (test row, all zeros) | — | Mage |

Mira and Dee have no Crawlball row. **Both Crawlball Tanks that were
ported became something else**, which is part of why Autocrawler has no
Tank today.

> **Isilwen ambiguity:** the CSV has two Isilwens. The in-game card
> thrower is assumed to be **Isilwen Jinglewick** (Balanced). **Isilwen
> Tidehollow** (Tank) is listed below as not yet in game.

## Coverage summary

| Role | Status in game | Candidates below |
|---|---|---|
| **Tank** | missing | 14 (7 Bulwark, 4 Wall, 3 Guardian) |
| Fighter | 5 in game | 9 |
| Ranger | 1 in game | 6 |
| Rogue | 3 in game | 5 |
| **Controller** | missing | 5 |
| Mage (blaster) | 1 in game | 4 |
| Healer | 2 in game | 4 |
| Martyr | new shape | 3 |
| Afflictor | new shape | 3 |
| Gambler | new shape | 3 |
| Tactician | 2 in game | 2 |
| **Summoner** | missing | 2 |
| **Elementalist** | missing (blocked) | 2 |
| **Positioner** | missing | 2 |
| **Tag-synergy** | missing (blocked) | 2 |
| Scaler | new shape | 2 |
| Duelist / Counter | new shape | 2 |
| Tempo | new shape | 2 |
| Prospector | new shape | 2 |
| Charger | new shape (blocked) | 1 |

**Takeaways**

- **Tank is the easiest gap to fill.** There are 14 Tank-shaped
  characters, and the abilities they need (Taunt, Shield, Thorns) already
  exist in the sim.
- **Controller has a clean stat profile:** fast, high-ward,
  high-accuracy casters. Sorrel Greenveil is the textbook case.
- **Summoner, Positioner, Tag-synergy, Martyr and Prospector don't come
  from stats.** Crawlball never had those mechanics, so no stat line
  points at them. The candidates are mostly characters with **weak or
  flat personal stats**, which fits these shapes: their value comes from
  something other than their own hits. Picks lean on race/name flavor.
- **Fighter and Rogue were the most crowded roles**, so most of the new
  shapes' candidates were moved out of them (Durga and Foamara to Scaler,
  Thornrose to Duelist, Ruse to Gambler, and so on). The old role is
  kept as each mover's alt.
- **Best first picks among the new shapes:** Martyr, Scaler and
  Afflictor. Each fills a gap the existing docs already call out
  (no self-death trigger, `on-enemy-downed` used once, nothing reacts to
  Poison/Burn), and they combine well: a Martyr's death can feed a
  Scaler, and an Afflictor gives Dawneth's Cleanse something to answer.

---

## Tank (missing archetype)

Built around being targeted and soaking damage. Matching abilities that
already exist: **Taunt** (Bodil), **Shield / Shield Wall** (Glint),
**Thorns** (Gudrun), **Second Wind** (Bodil). Untaken mechanics that suit
Tanks: an `on-hit-taken` payoff that scales with damage absorbed, or an
aura that grants armor to the row behind.

### Bulwark: HP/grit-led (Taunt, self-sustain)

| Character | Race | Crawlball | Stat signature | Alt role / flavor hook |
|---|---|---|---|---|
| Dazzle Solstice | human | Tank | **HP 62** (highest in roster) · GRT 41 · DEF 45 · SPD 8 | Pure aggro sponge; the slowest unit in the roster |
| Fumiko Mortice | kitsune | Tank | HP 56 · GRT 36 · DEF 42 | Kitsune → illusion/decoy Taunt (flavor) |
| Isilwen Tidehollow | elf | Tank | HP 54 · GRT 36 · DEF 42 | Needs a name distinct from in-game Isilwen |
| Shinara Moonborn | wolf girl | Tank | GRT 40 · DEF 45 · HP 53 · **WRD 33** | Magic-resistant tank, relevant if damage types land |
| Aoife Pinehurst | human | Tank | GRT 40 · HP 53 · DEF 40 · ATK 29 | Bruiser-tank (Rage/Thorns style); alt **Duelist** |
| Aurora Bleakwick | human | Tank | GRT 38 · DEF 38 · SPD 12 · MAG 2 | Plain wall; weakest of the tanks; alt **Martyr** |
| Schema | construct | Tank | GRT 37 · HP 53 · EVA 8 | Alt **Summoner** (construct deploys a drone/turret, flavor) |

### Wall: defense-led (Shield, armor)

| Character | Race | Crawlball | Stat signature | Alt role / flavor hook |
|---|---|---|---|---|
| Grima Wornstone | half-orc | Tank | **DEF 57** (highest in roster) · HP 58 · GRT 40 · WRD 31 | The ultimate armor wall |
| Bryna Fallengrave | human | Tank | DEF 48 · GRT 38 · WRD 31 · SPD 29 · ATK 32 | Mobile tank; acts early enough to Shield before the first enemy swing |
| Hanne Hammerstone | oni | Tank | DEF 48 · GRT 37 · HP 52 | Alt Fighter (Hammer → stun-on-hit, flavor) |
| Vesta Cipherborn | human | Tank | DEF 44 · GRT 39 · ATK 20 | Alt Controller (Cipher, flavor); low attack suits a pure-protect kit |

### Guardian: light tank / ally-protector (Balanced, defense-led)

Too fragile to Taunt, but defense is their best stat. Suits abilities
that protect *others*: Shield on the weakest ally, Guardian's Ward, or
redirecting a hit.

| Character | Race | Crawlball | Stat signature | Alt role / flavor hook |
|---|---|---|---|---|
| Swell Deepcrest | human | Balanced | DEF 38 · ACC 44 · SPD 40 | Alt **Positioner** (Swell → wave knockback, flavor) |
| Aelia Brightwick | mothgirl | Balanced | DEF 37 · GRT 29 · LCK 25 | Moth → drawn to the light / Taunt (flavor) |
| Tidera Crestborn | bat girl | Balanced | DEF 32 · WRD 32 | Alt **Positioner** (Tide, flavor) |

---

## Fighter (5 in game)

Attack-led melee.

| Character | Race | Crawlball | Stat signature | Alt role / flavor hook |
|---|---|---|---|---|
| Lesya Ashfall | vampire | Striker | ATK 43 · LCK 29 · SPD 46 | Lifesteal by flavor (but Caladwen already has Lifesteal Strike); alt **Scaler** (feeds on kills) |
| Mirandel Ashwhisper | half-elf | Striker | ATK 41 · LCK 28 · EVA 40 | Shares a first name with Mirandel Brazenmark |
| Dara Shadowleaf | tanuki | Striker | SPD 50 · ATK 42 · ACC 46 | Alt Rogue |
| Eabha Heatherfield | human | Striker | SPD 49 · ATK 41 · DEF 31 · LCK 29 | Sturdiest Striker; alt off-tank or **Tempo** |
| Oksana Urnborn | human | Balanced | GRT 29 · ATK 36 · HP 41 | Grit-fighter (Second Wind type); Urn → alt **Martyr** (flavor) |
| Nimloth Brighthaven | elf | Balanced | ATK 35 · GRT 25 | Shares a first name with Nimloth Quickmark |
| Seraph Celestine | bat girl | Balanced | ATK 34 · DEF 30 · GRT 24 | Alt Guardian |
| Pallara Ruinfall | dhampir | Balanced | HP 45 · ACC 41 · ATK 33 | Dhampir → lifesteal (flavor) |
| Elenith Greymantle | half-elf | Balanced | HP 42 · ATK 30 | Weak signal; flexible |

---

## Rogue (3 in game)

Evasion-led: the Dodge / Execute / Mark / Vanish family.

| Character | Race | Crawlball | Stat signature | Alt role / flavor hook |
|---|---|---|---|---|
| Thalya Saltrock | oni | Striker | EVA 47 · ATK 42 · SPD 48 · HP 26 | Lowest HP in roster; pure evasion; alt **Duelist** |
| Elenara Cobweb | half-elf | Striker | EVA 46 · LCK 30 · ACC 46 | Alt **Controller** (Cobweb → root/stun, flavor) |
| Elenmir Puddlejump | elf | Striker | EVA 43 · ATK 38 · **WRD 4** | Alt **Positioner** (jumps the backline, flavor) |
| Mirandel Brazenmark | half-elf | Striker | SPD 47 · EVA 40 · ACC 44 | Even striker spread |
| Ebony Fademark | human | Balanced | flat (DEF 29 slight lead) | Fade → Vanish/stealth (flavor) |

---

## Ranger (1 in game)

Accuracy-led. Since everyone's ACC is high, these are the characters
who still stand out above that baseline.

| Character | Race | Crawlball | Stat signature | Alt role / flavor hook |
|---|---|---|---|---|
| Roisin Rootwick | human | Striker | **ACC 58** (by far the highest) · SPD 52 · ATK 41 | Sniper / Execute; alt **Charger** (aimed shot) |
| Celestiel Goldveil | tanuki | Striker | ACC 51 · SPD 50 · EVA 44 | Fast sniper |
| Taurielen Lecturnmark | elf | Striker | SPD 50 · ACC 45 · LCK 28 | First-strike shooter; alt **Tempo** |
| Linden Woodholm | human | Balanced | ACC 45 · ATK 36 · EVA 37 | Solid all-round ranger |
| Cedar Ivydale | human | Balanced | ACC 44 · EVA 38 | Alt Rogue |
| Nimloth Quickmark | elf | Balanced | ACC 41 · ATK 33 · HP 42 | Shares a first name with Nimloth Brighthaven |

---

## Mage: blaster (1 in game)

Magic well above ward: offensive casters.

| Character | Race | Crawlball | Stat signature | Alt role / flavor hook |
|---|---|---|---|---|
| Athena Emblemborn † | human | Mage | MAG 52 · WRD 46 · LCK 30 | Crit caster; alt **Gambler** |
| Dagmar Goldwick | angel | Mage | MAG 49 · WRD 34 | Alt **Healer** (angel → Revive, flavor) |
| Elenwe Withermark | elf | Mage | MAG 47 · WRD 44 · SPD 38 · ATK 27 | Alt **Controller** (Wither → Mark/vulnerability) or **Afflictor** |
| Drib | goblin | Mage | MAG 43 · WRD 38 | Goblin tag for future aura hooks |

## Elementalist (missing; blocked on the damage-type layer)

The highest-magic characters with an elemental hook. Until damage types
exist, they could play as blasters with Burn.

| Character | Race | Crawlball | Stat signature | Alt role / flavor hook |
|---|---|---|---|---|
| Scamp Briarwall | **dragon** | Mage | **MAG 59** (highest in roster) · LCK 30 | Dragon → fire breath; strongest Elementalist pick; alt **Charger** (breath weapon) |
| Ash Everwick † | catgirl | Mage | MAG 55 · WRD 40 | Ash → fire; alt **Afflictor** (Burn stacking) |

---

## Healer (2 in game)

Ward-led casters. Dawneth was a Crawlball Mage with WRD ≥ MAG, and these
characters share that shape.

| Character | Race | Crawlball | Stat signature | Alt role / flavor hook |
|---|---|---|---|---|
| Aerith Stonehearth | half-elf | Mage | MAG 45 · WRD 43 · LCK 28 · ACC 43 | Classic healer |
| Elenara Luminal | half-elf | Mage | WRD 47 · MAG 47 · EVA 35 | Light-themed healer (Luminal) |
| Mazgha Saltwood | orc | Mage | **WRD 42 > MAG 37** · LCK 26 | Cleanse specialist; natural counter to an enemy Afflictor |
| Meadow Gulfborn | human | Mage | WRD 37 · MAG 36 · HP 38 (sturdiest Mage) | Frontline-capable healer |

## Controller / Debuffer (missing archetype)

Speed (acts first) + ward + accuracy on a caster. Kits built around
**Stun, Silence, Mark, Fear**, which all exist today but are spread across
characters as one-offs.

| Character | Race | Crawlball | Stat signature | Alt role / flavor hook |
|---|---|---|---|---|
| Sorrel Greenveil | human | Mage | **WRD 55** (highest) · MAG 48 · **SPD 42** · ACC 43 | The textbook Controller: fast enough to lock enemies before they act |
| Sylvara Riddlewood | elf | Mage | WRD 45 · MAG 44 · ATK 6 | Riddle → Silence/confusion (flavor) |
| Nymriel Lexiwick | half-elf | Mage | MAG 47 · WRD 44 · ACC 41 · SPD 35 | Lexi → words → Silence (flavor) |
| Exalta Noblecrest | bat girl | Mage | WRD 46 · MAG 46 · EVA 37 · ATK 8 | Bat → sonic Stun (flavor) |
| Riptara Wraithborn | human | Balanced | **LCK 26** · ATK 18 · HP 41 | Low-damage hexer; Wraith → Fear (flavor) |

---

## Tactician (2 in game)

Well-rounded profiles with no single standout. Tharavel and Fallacy came
from similar shapes.

| Character | Race | Crawlball | Stat signature | Alt role / flavor hook |
|---|---|---|---|---|
| Willa Cloverdale | human | Balanced | HP 46 · ACC 44 · SPD 43 · DEF 35 | Most well-rounded in the roster; commander; alt Ranger |
| Celeste Gloryborn | oni | Balanced | dead average | Glory → Inspire / Rally (flavor) |

## Summoner (missing; needs the add-a-unit-mid-room plumbing)

| Character | Race | Crawlball | Stat signature | Alt role / flavor hook |
|---|---|---|---|---|
| Damnara Crownborn | demon | Mage | WRD 38 · MAG 35 · ATK 11 · SPD 18 | Summons imps; weak attack fits "the pets do the fighting" |
| Chit | goblin | Balanced | weakest overall (SPD 22, ATK 20) | Calls goblin pals; alt Dee-style joke character |

Also see the alt picks: Schema, Crystallis Sternwatch, Lorcan Coinflip.

## Positioner (missing archetype)

Push, pull or swap. No stat directly predicts this role; picks are by
flavor plus speed (positioning matters most before the enemy acts).

| Character | Race | Crawlball | Stat signature | Alt role / flavor hook |
|---|---|---|---|---|
| Coraline Barnacleborn | mermaid | Balanced | LCK 25 · GRT 24 (weak otherwise) | Tide pull / undertow |
| Dusk Greyspire | harpy | Balanced | EVA 38 · HP 41 | Harpy grabs a unit and relocates it (flavor); alt Rogue |

Also see the alt picks: Swell Deepcrest, Tidera Crestborn, Elenmir
Puddlejump, Gambit Snatchwick.

## Tag-synergy (missing; blocked on Tags/Auras)

| Character | Race | Crawlball | Stat signature | Alt role / flavor hook |
|---|---|---|---|---|
| Phantara Soulwatch | **bunny girl** | Mage | MAG 51 · WRD 45 · ATK 8 | The framework's "Bunny Den Mother" example; Bodil is already a bunny girl for her to synergize with |
| Aura Mindholm | human | Balanced | DEF 32 · WRD 30 (flat) | Her name is literally Aura; alt Controller (Mind) |

---

## Martyr (new shape)

Value arrives when they fall. Ability directions: explode for damage on
death, grant the party a buff or Shield on death, leave a lingering ward
on their tile. Low HP and low defense are a feature here, since dying
sooner pays out sooner. Synergizes with Mira's Revive.

| Character | Race | Crawlball | Stat signature | Alt role / flavor hook |
|---|---|---|---|---|
| Lumenara Moonfall | human | Striker | SPD 43 · ATK 35 · **DEF 8 · WRD 6** | Extreme glass cannon, so she'll go down early anyway; was Fighter |
| Celebril Seaward † | elf | Mage | MAG 38 · WRD 37 · ATK 7 | Fallen in Crawlball (continuity hook); dying blessing on the party; was Healer |
| Galadria Brazenmark | elf | Striker | EVA 34 · HP 40 (weakest Striker) | Weak stats suit a payoff-on-death kit; was Rogue |

## Afflictor (new shape)

Damage over time as a whole kit. Ability directions: apply stacking
Poison/Burn, deal bonus damage to afflicted targets, detonate all
stacks at once, spread a status to adjacent enemies.

| Character | Race | Crawlball | Stat signature | Alt role / flavor hook |
|---|---|---|---|---|
| Lumiel Foxglove | shade | Mage | MAG 47 · ATK 24 · SPD 34 | Foxglove is a poison plant; Poison caster; was Mage blaster |
| Sasha Moldgrave | human | Balanced | ATK 34 · HP 43 · DEF 30 | Mold → rot/Poison on hit, sturdy enough for melee; was Fighter |
| Thea Tinderwick | human | Striker | EVA 41 · SPD 46 · ATK 39 | Tinder → Burn applier; alt **Elementalist**; was Rogue |

## Scaler (new shape)

Snowballs over a fight or a run. Ability directions: permanent +ATK
per kill (`on-enemy-downed`), stacking buffs for each turn survived,
bonus stats per room cleared. High raw attack makes each stack count.

| Character | Race | Crawlball | Stat signature | Alt role / flavor hook |
|---|---|---|---|---|
| Durga Stonewright | half-orc | Striker | ATK 46 · LCK 30 · SPD 49 | Kill-streak bruiser; was Fighter |
| Foamara Lagoonborn | cervine | Striker | **ATK 50** (highest in roster) · DEF 12 · GRT 10 | Highest attack, so the best base for multiplying; fragile enough that keeping her alive is the player's challenge; was Fighter |

## Duelist / Counter (new shape)

Acts on the enemy's turn. Ability directions: riposte when hit
(`on-hit-taken`), counter-attack after a dodge, intercept a hit aimed at
an adjacent ally, mark whoever last hit them.

| Character | Race | Crawlball | Stat signature | Alt role / flavor hook |
|---|---|---|---|---|
| Thornrose Greywatch | human | Striker | **EVA 47** · ACC 49 · SPD 48 · GRT 8 | Dodge-then-riposte; Thorn → retaliation (flavor); was Rogue |
| Envy Oakenshield | tiefling | Balanced | DEF 33 · EVA 36 · ACC 41 | Shield-bearer who intercepts hits aimed at allies; was Guardian |

## Tempo (new shape)

Plays with turn order instead of HP. Ability directions: haste an ally
(speed buff or extra action via Command), slow an enemy, delay an
enemy's turn, act twice on the opening turn of a room. High personal
speed lets them set the pace before anyone else acts.

| Character | Race | Crawlball | Stat signature | Alt role / flavor hook |
|---|---|---|---|---|
| Halcyon Gobsmack | human | Striker | SPD 47 · EVA 36 · DEF 10 · WRD 6 | Speed is the only thing she has, so make speed the kit; was Rogue |
| Crystallis Sternwatch | slimegirl | Balanced | **SPD 44**, otherwise flat | Fast but unremarkable otherwise; alt **Summoner** (splits into slimes) |

## Gambler (new shape)

Random outcomes as identity. Ability directions: coin-flip attacks
(double damage or whiff), random buff/debuff rolls, outcomes weighted by
luck. Luck is the stat that predicts this one.

| Character | Race | Crawlball | Stat signature | Alt role / flavor hook |
|---|---|---|---|---|
| Lorcan Coinflip | fungal | Balanced | LCK 25, weak otherwise | The name says it; alt **Summoner** (spores) or Tactician; was Tactician |
| Ruse Widdershins | human | Striker | **LCK 29** · ACC 44 · ATK 36 | Widdershins = bad luck charm; trickster; was Rogue |
| Astra Goldcrest | human | Striker | ACC 48 · LCK 30 · SPD 48 | Crit-heavy gambler with the accuracy to back it up; alt Ranger |

## Prospector (new shape)

Out-of-combat value. Ability directions: bonus gold per kill or room,
better loot rolls, shop discounts in town, shared XP to the party.
Expected to be a below-average fighter.

| Character | Race | Crawlball | Stat signature | Alt role / flavor hook |
|---|---|---|---|---|
| Gambit Snatchwick | tanuki | Balanced | DEF 33 · SPD 37 | Snatch → steals gold/loot; tanuki are folklore merchants; alt **Positioner** (swap) |
| Oceana Shipwright | human | Balanced | ACC 46 · EVA 34 (low attack) | Shipwright → trader/salvager; alt Ranger |

## Charger (new shape; blocked on the charge-meter system)

Slow buildup, one massive release. Ability directions: charges over N
turns then nukes, charge speeds up when allies fall, releases early if
hit hard. Once it exists, it's the natural target for Tharavel's
originally intended resource-denial ability.

| Character | Race | Crawlball | Stat signature | Alt role / flavor hook |
|---|---|---|---|---|
| Nadka Doomfall | human | Mage | MAG 52 · WRD 46 · ACC 45 | Doom → a doom-countdown nuke; was Mage blaster |

Also see the alt picks: Scamp Briarwall (breath weapon), Roisin Rootwick
(aimed shot).

---

## Notes for content work

- **Duplicate first names.** Autocrawler shows first names only, so these
  pairs collide: Isilwen (Jinglewick in game / Tidehollow), Elenara
  (Luminal / Cobweb), Mirandel (Ashwhisper / Brazenmark), Nimloth
  (Brighthaven / Quickmark). Bringing in a second one of a pair needs a
  display-name rule (surname or nickname).
- **Species tags come for free.** Races in the CSV map directly onto the
  `species` tag category: bunny girl ×2 (Bodil, Phantara), bat girl ×3,
  tanuki ×3, oni ×3, goblin ×2, elf/half-elf (many), plus one-offs
  (dragon, demon, angel, vampire, dhampir, construct, slimegirl, mermaid,
  harpy, kitsune, wolf girl, mothgirl, catgirl, cervine, fungal, shade,
  tiefling ×2, orc/half-orc). Several of these clusters are large enough
  to anchor auras.
- **Stats aren't destiny.** Melpomene (Crawlball Tank → Ranger) and Bodil
  (Tank → Fighter) show that the Autocrawler role can override the stat
  read when the character concept calls for it. Treat the best-fit column
  as the default, not a constraint.
- **Shapeshifter / Mimic is deliberately left out** for now (copying an
  enemy's or ally's Special Action, or changing form mid-fight). If it
  comes back, the tanuki, kitsune and slimegirl characters are the
  natural candidates.
