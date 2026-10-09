import type { Trait } from '../sim/traits';
import type { StatModifier } from '../sim/stats';

const mod = (id: string, stat: string, type: 'flat' | 'percent', amount: number): StatModifier => ({
  stat,
  type,
  amount,
  source: `quirk:${id}`,
});

/**
 * Hero Quirks (see sim/quirks.ts) — rolled onto recruit offers. Good ones
 * raise the recruit price, bad ones lower it (QUIRK_PRICE_STEP each).
 */
export const HERO_QUIRK_POOL: Trait[] = [
  { id: 'strong', name: 'Strong', description: '+15% attack.', quirk: 'good', modifiers: [mod('strong', 'attackPower', 'percent', 15)] },
  { id: 'tough', name: 'Tough', description: '+15% max HP.', quirk: 'good', modifiers: [mod('tough', 'maxHp', 'percent', 15)] },
  { id: 'swift', name: 'Swift', description: '+15% speed.', quirk: 'good', modifiers: [mod('swift', 'speed', 'percent', 15)] },
  { id: 'lucky', name: 'Lucky', description: '+8 crit chance.', quirk: 'good', modifiers: [mod('lucky', 'critChance', 'flat', 8)] },
  {
    id: 'goblin-hater',
    name: 'Goblin Hater',
    description: 'Can strike Goblins anywhere on the field, and goes for them first.',
    quirk: 'good',
    prey: { tag: 'goblin' },
  },
  {
    id: 'demonbane',
    name: 'Demonbane',
    description: 'Can strike Demons anywhere on the field, and goes for them first.',
    quirk: 'good',
    prey: { tag: 'demon' },
  },
  { id: 'frail', name: 'Frail', description: '-15% max HP.', quirk: 'bad', modifiers: [mod('frail', 'maxHp', 'percent', -15)] },
  { id: 'weak', name: 'Weak', description: '-15% attack.', quirk: 'bad', modifiers: [mod('weak', 'attackPower', 'percent', -15)] },
  { id: 'sluggish', name: 'Sluggish', description: '-15% speed.', quirk: 'bad', modifiers: [mod('sluggish', 'speed', 'percent', -15)] },
  {
    id: 'glass-jaw',
    name: 'Glass Jaw',
    description: 'Takes 15% more damage.',
    quirk: 'bad',
    modifiers: [mod('glass-jaw', 'vulnerability', 'flat', 15)],
  },
];

/**
 * Monster Quirks (see sim/quirks.ts) — rolled onto monsters when a room is
 * built (data/rooms.ts), shown on the formation board's enemy preview.
 * "good" = nastier for the player, "bad" = easier.
 */
export const MONSTER_QUIRK_POOL: Trait[] = [
  { id: 'speedy', name: 'Speedy', description: '+20% speed.', quirk: 'good', modifiers: [mod('speedy', 'speed', 'percent', 20)] },
  { id: 'brutal', name: 'Brutal', description: '+20% attack.', quirk: 'good', modifiers: [mod('brutal', 'attackPower', 'percent', 20)] },
  { id: 'armored', name: 'Armored', description: '+2 armor.', quirk: 'good', modifiers: [mod('armored', 'armor', 'flat', 2)] },
  {
    id: 'mage-striker',
    name: 'Mage Striker',
    description: 'Can strike your Mages anywhere on the field, and goes for them first.',
    quirk: 'good',
    prey: { role: 'Mage' },
  },
  {
    id: 'healer-hunter',
    name: 'Healer Hunter',
    description: 'Can strike your Healers anywhere on the field, and goes for them first.',
    quirk: 'good',
    prey: { role: 'Healer' },
  },
  { id: 'wounded', name: 'Wounded', description: '-20% max HP.', quirk: 'bad', modifiers: [mod('wounded', 'maxHp', 'percent', -20)] },
  { id: 'feeble', name: 'Feeble', description: '-20% attack.', quirk: 'bad', modifiers: [mod('feeble', 'attackPower', 'percent', -20)] },
];
