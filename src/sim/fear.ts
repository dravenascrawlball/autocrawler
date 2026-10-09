import type { Adventurer } from './adventurer';
import type { TagId } from './tags';
import { hasTag } from './tags';

/**
 * Lane Fear (Halloween — Spooky heroes): every enemy takes `percentPerHero`%
 * more damage for each living party member carrying `tag` who stands in the
 * same lane, up to `maxHeroes`. Applied to the room's enemies at room start
 * (dungeonRun.ts's resolveNextRoom), alongside synergies and scaling relics.
 */
export const SPOOKY_FEAR_PERCENT_PER_HERO = 5;
export const SPOOKY_FEAR_MAX_HEROES = 1;

const FEAR_SOURCE = 'fear:spooky';

export function applyLaneFear(
  party: Adventurer[],
  enemies: Adventurer[],
  tag: TagId = 'spooky',
  percentPerHero = SPOOKY_FEAR_PERCENT_PER_HERO,
  maxHeroes = SPOOKY_FEAR_MAX_HEROES,
): void {
  for (const enemy of enemies) {
    enemy.modifiers = enemy.modifiers.filter((modifier) => modifier.source !== FEAR_SOURCE);
    const frighteners = party.filter(
      (member) => member.hp > 0 && hasTag(member, tag) && member.position.lane === enemy.position.lane,
    ).length;
    const count = Math.min(frighteners, maxHeroes);
    if (count > 0) {
      enemy.modifiers = [...enemy.modifiers, { stat: 'vulnerability', type: 'flat', amount: count * percentPerHero, source: FEAR_SOURCE }];
    }
  }
}
