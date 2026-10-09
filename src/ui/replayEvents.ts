import type { ActionOutcome } from '../sim/action';
import type { ReplayEvent } from '../game/RoomReplayScene';

/**
 * Turns one resolved ActionOutcome into the battle replay's events (see
 * game/RoomReplayScene.ts), credited to `actorId` and labeled with
 * `actionName`. Shared by Basic Actions (a turn's own 'action' event) and
 * Special Actions ('special-action' events — fired by whoever owns the
 * Special, which isn't always the unit whose turn it is, e.g. an
 * on-hit-taken Special), so both animate the same way. `nameOf` resolves a
 * unit id to a display name (falling back to `fallback`). Lives outside
 * DungeonPhaseView.svelte so it can be unit-tested — see
 * replayEvents.test.ts.
 */
export function outcomeToReplayEvents(
  outcome: ActionOutcome,
  actorId: string,
  actionName: string,
  nameOf: (unitId: string, fallback: string) => string,
): ReplayEvent[] {
  const events: ReplayEvent[] = [];
  if (outcome.type === 'attack') {
    events.push({
      type: 'attack',
      actorId,
      targetId: outcome.targetId,
      damage: outcome.damage,
      hit: outcome.hit,
    });
  } else if (outcome.type === 'attack-multi') {
    // Bodil's Cleave (roadmap item 11) — one 'attack-multi' outcome becomes a plain 'attack'
    // replay event per hit, so RoomReplayScene needs no changes to play each one in sequence.
    for (const hit of outcome.hits) {
      events.push({
        type: 'attack',
        actorId,
        targetId: hit.targetId,
        damage: hit.damage,
        hit: hit.hit,
      });
    }
  } else if (outcome.type === 'attack-and-buff') {
    // Glint's Rallying Strike (roadmap item 11) — the attack half plays exactly like a plain
    // 'attack'; the buff half gets its own announcement event (see RoomReplayScene's 'announce').
    events.push({
      type: 'attack',
      actorId,
      targetId: outcome.targetId,
      damage: outcome.damage,
      hit: outcome.hit,
    });
    events.push({
      type: 'announce',
      actorId,
      text: `Rally! +${outcome.armorAmount} Armor (${outcome.durationTurns}t)`,
      color: '#66ccff',
    });
  } else if (outcome.type === 'attack-and-gold') {
    // Nerissa's Pickpocket Strike (roadmap item 11) — the attack half plays exactly like a
    // plain 'attack'; a landed hit that also generated gold gets a small announcement too.
    events.push({
      type: 'attack',
      actorId,
      targetId: outcome.targetId,
      damage: outcome.damage,
      hit: outcome.hit,
    });
    if (outcome.goldGenerated > 0) {
      events.push({
        type: 'announce',
        actorId,
        text: `+${outcome.goldGenerated}g!`,
        color: '#ffd700',
      });
    }
  } else if (outcome.type === 'attack-and-pull') {
    // Chain Warden's Hook Chain (monster pass) — the swap animates first (both heroes slide to their
    // new cells), then the hit lands on whoever was dragged forward.
    if (outcome.pull) {
      events.push({ type: 'announce', actorId: outcome.pull.pulledId, text: 'Hooked!', color: '#bbbbbb' });
      events.push({ type: 'move', unitId: outcome.pull.pulledId, to: outcome.pull.to });
      events.push({ type: 'move', unitId: outcome.pull.swappedWithId, to: outcome.pull.swappedTo });
    }
    events.push({ type: 'attack', actorId, targetId: outcome.targetId, damage: outcome.damage, hit: outcome.hit });
  } else if (outcome.type === 'summon') {
    // A summoner called in a new unit (sim/summons.ts) — announce it, then fade the summon in.
    events.push({ type: 'announce', actorId, text: `${actionName}!`, color: '#ff5533' });
    events.push({ type: 'spawn', unitId: outcome.summonedId });
  } else if (outcome.type === 'ally-rally') {
    // Infernal Bannerman's War Banner (monster pass) — one announcement over the bannerman.
    events.push({
      type: 'announce',
      actorId,
      text: `${actionName}! Allies +${outcome.amount}% ATK (${outcome.durationTurns}t)`,
      color: '#ff7744',
    });
  } else if (outcome.type === 'attack-and-status') {
    // Venom Spit / Searing Touch (enemy variety pass) — a plain attack, plus an announcement over
    // the target if the poison/burn actually took hold.
    events.push({ type: 'attack', actorId, targetId: outcome.targetId, damage: outcome.damage, hit: outcome.hit });
    if (outcome.statusApplied) {
      const isPoison = outcome.effectId === 'poison';
      events.push({
        type: 'announce',
        actorId: outcome.targetId,
        text: isPoison ? 'Poisoned!' : 'Burning!',
        color: isPoison ? '#88cc44' : '#ff8833',
      });
    }
  } else if (outcome.type === 'attack-and-debuff') {
    // Dravena's Blinding Bolt (roadmap item 11) — the attack half plays exactly like a plain
    // 'attack'; a landed hit that also blinded the target gets an announcement over them.
    events.push({
      type: 'attack',
      actorId,
      targetId: outcome.targetId,
      damage: outcome.damage,
      hit: outcome.hit,
    });
    if (outcome.debuffApplied) {
      events.push({
        type: 'announce',
        actorId: outcome.targetId,
        text: `Blind! ${outcome.attackPowerPercent}% ATK (${outcome.durationTurns}t)`,
        color: '#cc66ff',
      });
    }
  } else if (outcome.type === 'attack-and-heal-self') {
    // Caladwen's Lifesteal Strike (second-Special pass) — the attack half plays exactly like
    // a plain 'attack'; a landed hit that actually stole HP gets its own heal pulse on her.
    events.push({
      type: 'attack',
      actorId,
      targetId: outcome.targetId,
      damage: outcome.damage,
      hit: outcome.hit,
    });
    if (outcome.healedAmount > 0) {
      events.push({
        type: 'heal',
        actorId,
        targetId: actorId,
        amount: outcome.healedAmount,
      });
    }
  } else if (outcome.type === 'support-buff') {
    // Fallacy's Empower / Mira's Potion Toss (Ally) / Bodil's Taunt / Tharavel's Guardian's
    // Ward / Dravena's Vanish (second-Special pass) — no attack of its own, just an
    // announcement over whichever ally got buffed. Named after whichever action actually
    // fired (rolledActionId), not hardcoded, since this outcome type is shared. Taunt/
    // Invulnerability/Stealth are flags encoded as buffs (see actions/support.ts), not
    // numeric stats worth displaying a magnitude for — just announce the effect.
    const buffedName = nameOf(outcome.targetId, 'Ally');
    const statLabel = outcome.stat === 'attackPower' ? 'ATK' : outcome.stat;
    const flagText: Partial<Record<string, string>> = {
      taunt: 'locks enemy targeting',
      invulnerable: 'is Invulnerable',
      stealth: 'Vanishes (untargetable)',
    };
    const text = flagText[outcome.stat]
      ? `${actionName}! ${buffedName} ${flagText[outcome.stat]} (${outcome.durationTurns}t)`
      : `${actionName}! ${buffedName} +${outcome.amount}% ${statLabel} (${outcome.durationTurns}t)`;
    events.push({
      type: 'announce',
      actorId: outcome.targetId,
      text,
      color: '#ffcc66',
    });
  } else if (outcome.type === 'support-shield') {
    // Glint's Shield Wall (second-Special pass) — no attack of its own, just an
    // announcement over whoever got shielded. Named after whichever action actually fired,
    // same convention as support-buff, since this outcome type could be shared later too.
    const shieldedName = nameOf(outcome.targetId, 'Ally');
    events.push({
      type: 'announce',
      actorId: outcome.targetId,
      text: `${actionName}! ${shieldedName} +${outcome.amount} Shield (${outcome.durationTurns}t)`,
      color: '#66e0ff',
    });
  } else if (outcome.type === 'support-debuff') {
    // Mira's Potion Toss (Enemy) / Isilwen's Mark / Fallacy's Silence / Mirka's Stun
    // (second-Special pass) — the debuff counterpart to support-buff above: no attack of
    // its own, an announcement over whichever enemy got debuffed. Silence/Stun are flags
    // encoded as debuffs, not numeric stats worth displaying a magnitude for.
    const debuffedName = nameOf(outcome.targetId, 'Enemy');
    const statLabel = outcome.stat === 'attackPower' ? 'ATK' : outcome.stat === 'vulnerability' ? 'DMG Taken' : outcome.stat;
    const flagText: Partial<Record<string, string>> = {
      silence: 'is Silenced (Special Actions suppressed)',
      stun: 'is Stunned (skips next turn)',
      hex: `is Hexed (${outcome.amount}% ATK, Specials silenced)`,
    };
    // Mark's amount is a positive bonus-damage percent (prefixed with +); Potion Toss
    // Enemy's own debuff amounts are already negative (e.g. -20), so no extra sign needed.
    const text = flagText[outcome.stat]
      ? `${actionName}! ${debuffedName} ${flagText[outcome.stat]} (${outcome.durationTurns}t)`
      : `${actionName}! ${debuffedName} ${outcome.stat === 'vulnerability' ? '+' : ''}${outcome.amount}% ${statLabel} (${outcome.durationTurns}t)`;
    events.push({
      type: 'announce',
      actorId: outcome.targetId,
      text,
      color: '#cc66ff',
    });
  } else if (outcome.type === 'command') {
    // Fallacy's Command (roadmap item 11) — an announcement over her, then the commanded
    // ally's bonus attack plays exactly like a plain 'attack' from them.
    events.push({ type: 'announce', actorId, text: 'Command!', color: '#ff9966' });
    if (outcome.attackOutcome) {
      events.push({
        type: 'attack',
        actorId: outcome.commandedAllyId,
        targetId: outcome.attackOutcome.targetId,
        damage: outcome.attackOutcome.damage,
        hit: outcome.attackOutcome.hit,
      });
    }
  } else if (outcome.type === 'command-multi') {
    // Fallacy's Battle Orders (unlock content pass) — one announcement, then each commanded ally's
    // bonus attack plays like a plain 'attack' from them.
    events.push({ type: 'announce', actorId, text: `${actionName}!`, color: '#ff9966' });
    for (const command of outcome.commands) {
      if (command.attackOutcome) {
        events.push({
          type: 'attack',
          actorId: command.commandedAllyId,
          targetId: command.attackOutcome.targetId,
          damage: command.attackOutcome.damage,
          hit: command.attackOutcome.hit,
        });
      }
    }
  } else if (outcome.type === 'party-buff') {
    // Tharavel's Inspire (roadmap item 11) — no attack of her own, one announcement over her
    // summarizing the whole-party crit buff (consolidated from a separate accuracy + crit
    // pair once Accuracy was removed as a baseline stat — see docs/roadmap.md).
    events.push({
      type: 'announce',
      actorId,
      text: `Inspire! +${outcome.critChanceAmount}% Crit (${outcome.durationTurns}t)`,
      color: '#ffee88',
    });
  } else if (outcome.type === 'fear') {
    // Mirka's Fear (roadmap item 11) — no attack of her own, one announcement over her
    // summarizing the row-wide vulnerability debuff (reframed from an accuracy debuff once
    // Accuracy/Evasion were removed — the debuff's own effect, extra damage taken, is still
    // visible normally once it's in play).
    events.push({
      type: 'announce',
      actorId,
      text: `Fear! +${outcome.vulnerabilityAmount}% DMG Taken (${outcome.durationTurns}t)`,
      color: '#cc99ff',
    });
  } else if (outcome.type === 'attack-with-execute') {
    // Drifta's Execute Strike (second-Special pass) — the hit half plays exactly like a
    // plain 'attack'; a finishing blow gets its own callout over the target.
    events.push({
      type: 'attack',
      actorId,
      targetId: outcome.targetId,
      damage: outcome.damage,
      hit: outcome.hit,
    });
    if (outcome.executed) {
      events.push({ type: 'announce', actorId: outcome.targetId, text: 'Executed!', color: '#ff4444' });
    }
  } else if (outcome.type === 'cleanse') {
    // Dawneth's Cleanse (second-Special pass) — no attack of her own; only announces when it
    // actually cleared something (always resolves, same as Mending Charge, but a no-op
    // cleanse is silent rather than cluttering the log).
    if (outcome.clearedEffectIds.length > 0) {
      events.push({
        type: 'announce',
        actorId: outcome.targetId,
        text: `Cleanse! ${outcome.clearedEffectIds.join(', ')} removed`,
        color: '#88ddaa',
      });
    }
  } else if (outcome.type === 'revive') {
    // Mira's Revive (second-Special pass) — no attack of her own; always announces (never an
    // idle no-op the way Cleanse can be, since selectTarget already gates on someone being
    // Downed before this ever resolves).
    events.push({
      type: 'announce',
      actorId: outcome.targetId,
      text: `Revive! +${outcome.amount} HP`,
      color: '#ffee88',
    });
    // Restore the revived unit's HP on screen too (it sat at 0 after being downed).
    events.push({ type: 'heal', actorId, targetId: outcome.targetId, amount: outcome.amount });
  } else if (outcome.type === 'heal') {
    events.push({
      type: 'heal',
      actorId,
      targetId: outcome.targetId,
      amount: outcome.amount,
    });
    // Mira's Splash Heal — each adjacent ally's smaller heal plays as its own pulse.
    for (const splash of outcome.splashes ?? []) {
      if (splash.amount > 0) {
        events.push({ type: 'heal', actorId, targetId: splash.targetId, amount: splash.amount });
      }
    }
  } else if (outcome.type === 'heal-and-charge') {
    // Dawneth's Mending Charge (roadmap item 11) — only plays the heal pulse if it actually
    // healed anyone (amount 0 means nobody needed it this roll); the energy announcement
    // always plays, since the face always fires.
    if (outcome.amount > 0) {
      events.push({
        type: 'heal',
        actorId,
        targetId: outcome.targetId,
        amount: outcome.amount,
      });
    }
    events.push({
      type: 'announce',
      actorId,
      text: `+${outcome.energyGained} Energy (${outcome.totalEnergy})`,
      color: '#88ddaa',
    });
  }
  return events;
}
