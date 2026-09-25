import type { ActionId } from '../sim/action';

/**
 * One-line player-facing summaries for the Roster sheet's Dice Faces
 * tooltip — the mechanical detail lives on each Action itself (see
 * sim/actions/*.ts), this is just plain-language flavor text.
 */
export const ACTION_DESCRIPTIONS: Partial<Record<ActionId, string>> = {
  'attack-nearest': 'Melee hit on the nearest enemy (front row first).',
  'attack-lowest-hp': 'Melee hit finishing off the weakest reachable enemy.',
  'power-attack': 'Hard-hitting melee strike on the weakest reachable enemy.',
  cleave: 'Melee hit that strikes every enemy in the target\'s row.',
  fear: 'Lowers the accuracy of every enemy in the target\'s row for a few turns.',
  'rallying-strike': 'Melee hit that also grants the whole party temporary armor.',
  'piercing-strike': 'From the front row, can finish off the weakest enemy in either row.',
  'pickpocket-strike': 'Melee hit with a chance to generate bonus gold.',
  'gilded-strike': "Melee hit that deals more damage the more gold the party's carrying.",
  'ranged-shot': 'Ranged hit — can reach either enemy row directly.',
  'blinding-bolt': "Ranged hit that also lowers the target's attack power for a few turns.",
  'card-throw': 'Ranged hit on a random enemy with a wide damage swing.',
  'mourning-strike': 'Ranged hit that deals more damage the more Mending Charge energy is banked.',
  heal: 'Heals the lowest-HP ally below half health.',
  'self-heal': 'Heals self once below half health.',
  'mending-charge': 'Always heals the lowest-HP ally a little and banks energy toward Mourning Strike.',
  empower: "Grants the ally currently hitting hardest a temporary attack boost.",
  command: 'Grants a random ally a bonus attack right now.',
  inspire: 'Grants the whole party temporary accuracy and critical chance.',
  retreat: 'Ends the room early and retreats the party.',
  'sneak-strike': 'Usually a melee hit on the nearest enemy, but can slip past the front row to strike a random enemy in the back instead.',
  'focused-shot': 'Ranged hit on the weakest enemy, in either row — lower damage than a heavy strike.',
  'potion-toss-ally': 'Throws a random buff (attack or accuracy) at a random ally.',
  'potion-toss-enemy': 'Throws a random debuff (attack or accuracy) at a random enemy.',
};
