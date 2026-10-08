import { describe, it, expect } from 'vitest';
import { plainFaces } from './dieFace';
import { createAdventurer, type AdventurerTemplate } from './adventurer';
import { createBattleState } from './battle';
import { AttackNearestAction } from './actions/attack';
import { getEffectiveStat } from './stats';
import { tickAuras, type Aura } from './auras';

function template(overrides: Partial<AdventurerTemplate> = {}): AdventurerTemplate {
  return {
    name: 'Unit',
    maxHp: 20,
    attackPower: 5,
    speed: 5,
    actions: ['attack-nearest'],
    dieFaces: plainFaces(AttackNearestAction),
    ...overrides,
  };
}

const SHIELD_AURA: Aura = {
  id: 'bunny-shield',
  name: 'Warren Solidarity',
  description: 'Grants +1 shield to all Bunny allies.',
  requiresTag: 'bunny',
  grants: { stat: 'shield', type: 'flat', amount: 1, source: 'aura:bunny-shield' },
};

describe('tickAuras', () => {
  it('applies a carrier\'s aura to a tagged ally on the same side', () => {
    const carrier = createAdventurer('carrier', template(), 'front');
    carrier.auras = [SHIELD_AURA];
    const bunny = createAdventurer('bunny-ally', template(), 'front');
    bunny.tags = ['bunny'];
    const battle = createBattleState([carrier, bunny], []);

    tickAuras(bunny, battle);

    expect(getEffectiveStat(0, 'shield', bunny.modifiers)).toBe(1);
  });

  it('does not apply to an ally without the required tag', () => {
    const carrier = createAdventurer('carrier', template(), 'front');
    carrier.auras = [SHIELD_AURA];
    const other = createAdventurer('other', template(), 'front');
    const battle = createBattleState([carrier, other], []);

    tickAuras(other, battle);

    expect(getEffectiveStat(0, 'shield', other.modifiers)).toBe(0);
  });

  it('does not cross sides — an enemy with the tag gets nothing from a party aura', () => {
    const carrier = createAdventurer('carrier', template(), 'front');
    carrier.auras = [SHIELD_AURA];
    const enemyBunny = createAdventurer('enemy-bunny', template(), 'front');
    enemyBunny.tags = ['bunny'];
    const battle = createBattleState([carrier], [enemyBunny]);

    tickAuras(enemyBunny, battle);

    expect(getEffectiveStat(0, 'shield', enemyBunny.modifiers)).toBe(0);
  });

  it('a carrier with the required tag can benefit from its own aura', () => {
    const carrier = createAdventurer('carrier', template(), 'front');
    carrier.auras = [SHIELD_AURA];
    carrier.tags = ['bunny'];
    const battle = createBattleState([carrier], []);

    tickAuras(carrier, battle);

    expect(getEffectiveStat(0, 'shield', carrier.modifiers)).toBe(1);
  });

  it('removes a stale aura modifier once the carrier dies before the next tick', () => {
    const carrier = createAdventurer('carrier', template(), 'front');
    carrier.auras = [SHIELD_AURA];
    const bunny = createAdventurer('bunny-ally', template(), 'front');
    bunny.tags = ['bunny'];
    const battle = createBattleState([carrier, bunny], []);

    tickAuras(bunny, battle);
    expect(getEffectiveStat(0, 'shield', bunny.modifiers)).toBe(1);

    carrier.hp = 0;
    tickAuras(bunny, battle);
    expect(getEffectiveStat(0, 'shield', bunny.modifiers)).toBe(0);
  });

  it('leaves other permanent modifiers untouched when recomputing', () => {
    const carrier = createAdventurer('carrier', template(), 'front');
    carrier.auras = [SHIELD_AURA];
    const bunny = createAdventurer('bunny-ally', template(), 'front', [
      { stat: 'armor', type: 'flat', amount: 2, source: 'item:test-armor' },
    ]);
    bunny.tags = ['bunny'];
    const battle = createBattleState([carrier, bunny], []);

    tickAuras(bunny, battle);

    expect(getEffectiveStat(0, 'armor', bunny.modifiers)).toBe(2);
    expect(getEffectiveStat(0, 'shield', bunny.modifiers)).toBe(1);
  });
});
