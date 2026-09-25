import type { Action, ActionId } from '../sim/action';
import {
  AttackNearestAction,
  AttackLowestHpAction,
  PowerAttackAction,
  RangedShotAction,
  CleaveAction,
  RallyingStrikeAction,
  PiercingStrikeAction,
  FearAction,
  PickpocketStrikeAction,
  GildedStrikeAction,
  BlindingBoltAction,
  CardThrowAction,
  MourningStrikeAction,
  SneakStrikeAction,
  FocusedShotAction,
} from '../sim/actions/attack';
import { HealAction, SelfHealAction, MendingChargeAction } from '../sim/actions/heal';
import { RetreatAction } from '../sim/actions/retreat';
import { EmpowerAction, CommandAction, InspireAction, PotionTossAllyAction, PotionTossEnemyAction } from '../sim/actions/support';

export const ACTION_REGISTRY: Record<ActionId, Action> = {
  'attack-nearest': AttackNearestAction,
  'attack-lowest-hp': AttackLowestHpAction,
  'power-attack': PowerAttackAction,
  'ranged-shot': RangedShotAction,
  heal: HealAction,
  retreat: RetreatAction,
  cleave: CleaveAction,
  'self-heal': SelfHealAction,
  'rallying-strike': RallyingStrikeAction,
  'piercing-strike': PiercingStrikeAction,
  empower: EmpowerAction,
  command: CommandAction,
  fear: FearAction,
  'pickpocket-strike': PickpocketStrikeAction,
  'gilded-strike': GildedStrikeAction,
  'blinding-bolt': BlindingBoltAction,
  'card-throw': CardThrowAction,
  'mending-charge': MendingChargeAction,
  'mourning-strike': MourningStrikeAction,
  inspire: InspireAction,
  'sneak-strike': SneakStrikeAction,
  'focused-shot': FocusedShotAction,
  'potion-toss-ally': PotionTossAllyAction,
  'potion-toss-enemy': PotionTossEnemyAction,
};
