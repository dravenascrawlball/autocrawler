import type { Adventurer } from './adventurer';
import type { BattleState } from './battle';

/**
 * Special Action charge (the charge-meter rework): a charged Special fires
 * only when its owner's meter is full, then the meter resets — so Specials
 * are moments, not a second attack every turn. Meters fill per turn and
 * faster in the thick of it (dealing or taking damage). Reactive Specials
 * (on-hit, on-ally-downed, ...) use a short per-Special cooldown instead.
 * Specials marked `alwaysOn` (healers' heals, auras, boss mechanics, the
 * Hellcaller's summon) ignore both. Battle-scoped: every fight starts at CHARGE_START.
 */
export const CHARGE_MAX = 100;
/** Where every meter starts each fight — half full, so the first charged Special lands around turn 2. */
export const CHARGE_START = 50;
export const CHARGE_PER_TURN = 25;
export const CHARGE_PER_HIT = 10;
/** Own turns a reactive Special is unavailable after firing. */
export const REACTIVE_COOLDOWN_TURNS = 2;
/** Damage/healing multiplier while a charged (meter-fired) Special resolves. */
export const CHARGED_SPECIAL_POWER = 2;

export function chargeOf(battle: BattleState, unitId: string): number {
  return battle.chargeByUnitId[unitId] ?? CHARGE_START;
}

export function addCharge(battle: BattleState, unitId: string, amount: number): void {
  battle.chargeByUnitId[unitId] = Math.min(CHARGE_MAX, chargeOf(battle, unitId) + amount);
}

export function isFullyCharged(battle: BattleState, unitId: string): boolean {
  return chargeOf(battle, unitId) >= CHARGE_MAX;
}

function cooldownKey(unitId: string, specialId: string): string {
  return `${unitId}:${specialId}`;
}

export function reactiveCooldown(battle: BattleState, unitId: string, specialId: string): number {
  return battle.reactiveCooldowns[cooldownKey(unitId, specialId)] ?? 0;
}

export function startReactiveCooldown(battle: BattleState, unitId: string, specialId: string): void {
  battle.reactiveCooldowns[cooldownKey(unitId, specialId)] = REACTIVE_COOLDOWN_TURNS;
}

/** Ticks down `unitId`'s reactive cooldowns by one of its own turns. */
export function tickReactiveCooldowns(battle: BattleState, unitId: string): void {
  const prefix = `${unitId}:`;
  for (const key of Object.keys(battle.reactiveCooldowns)) {
    if (key.startsWith(prefix) && battle.reactiveCooldowns[key] > 0) battle.reactiveCooldowns[key] -= 1;
  }
}

/** Whether `unit` has a Special that waits on the charge meter (an on-turn-start one that isn't alwaysOn). */
export function hasChargedSpecial(unit: Adventurer): boolean {
  return unit.activeSpecialActions.some((special) => !special.alwaysOn && special.trigger === 'on-turn-start');
}
