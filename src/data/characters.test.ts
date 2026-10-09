import { describe, it, expect } from 'vitest';
import { createAdventurer } from '../sim/adventurer';
import {
  GUDRUN_TEMPLATE,
  DAWNETH_TEMPLATE,
  ISILWEN_TEMPLATE,
  THARAVEL_TEMPLATE,
  BODIL_TEMPLATE,
  GLINT_TEMPLATE,
  DRIFTA_TEMPLATE,
  FALLACY_TEMPLATE,
  MIRKA_TEMPLATE,
  NERISSA_TEMPLATE,
  DRAVENA_TEMPLATE,
  CALADWEN_TEMPLATE,
  MELEMNOPE_TEMPLATE,
  MIRA_TEMPLATE,
  DEE_TEMPLATE,
  CHARACTER_TEMPLATES,
} from './characters';
import { RAGE_TRAIT, THORNS_TRAIT } from '../sim/traits';

describe('character templates retheme (Basic Action + Special Action/Trait pool)', () => {
  it('every template explicitly declares a Basic Action, used verbatim by createAdventurer', () => {
    for (const template of CHARACTER_TEMPLATES) {
      expect(template.basicAction, `${template.name} is missing an explicit basicAction`).toBeDefined();
      const adventurer = createAdventurer('test', template, 'front');
      expect(adventurer.basicAction.id).toBe(template.basicAction!.id);
    }
  });

  it("Gudrun's pool always grants Rage (seeded) plus Thorns (single-entry pool), both Traits, no Special Action", () => {
    const gudrun = createAdventurer('gudrun', GUDRUN_TEMPLATE, 'front');
    expect(gudrun.basicAction.id).toBe('power-attack');
    expect(gudrun.traits).toEqual([RAGE_TRAIT, THORNS_TRAIT]);
    expect(gudrun.activeSpecialActions).toEqual([]);
  });

  it("Dawneth attacks as her Basic Action, always has Mending Charge, and draws Mourning Strike or Guardian's Vow", () => {
    const withMourningStrike = createAdventurer('dawneth', DAWNETH_TEMPLATE, 'front', [], [], [], () => 0);
    expect(withMourningStrike.basicAction.id).toBe('attack-nearest');
    expect(withMourningStrike.activeSpecialActions).toEqual([
      expect.objectContaining({ id: 'dawneth-mending-charge', trigger: 'on-turn-start' }),
      expect.objectContaining({ id: 'dawneth-mourning-strike', trigger: 'on-turn-start' }),
    ]);

    const withVow = createAdventurer('dawneth', DAWNETH_TEMPLATE, 'front', [], [], [], () => 0.99);
    expect(withVow.activeSpecialActions).toEqual([
      expect.objectContaining({ id: 'dawneth-mending-charge' }),
      expect.objectContaining({ id: 'dawneth-guardians-vow', trigger: 'on-turn-start' }),
    ]);
  });

  it("Bodil's Basic Action is Cleave; her pool draws either Second Wind (on-hit-taken) or Taunt (on-turn-start)", () => {
    const withSecondWind = createAdventurer('bodil', BODIL_TEMPLATE, 'front', [], [], [], () => 0);
    expect(withSecondWind.basicAction.id).toBe('cleave');
    expect(withSecondWind.activeSpecialActions).toEqual([expect.objectContaining({ id: 'bodil-second-wind', trigger: 'on-hit-taken' })]);

    const withTaunt = createAdventurer('bodil', BODIL_TEMPLATE, 'front', [], [], [], () => 0.99);
    expect(withTaunt.activeSpecialActions).toEqual([expect.objectContaining({ id: 'bodil-taunt', trigger: 'on-turn-start' })]);
  });

  it("Fallacy's Basic Action is Attack Nearest (moved off Empower in the \"every Basic Action must deal damage\" cleanup pass); her pool draws Empower, Command, or Silence, all on-turn-start", () => {
    const withEmpower = createAdventurer('fallacy', FALLACY_TEMPLATE, 'front', [], [], [], () => 0);
    expect(withEmpower.basicAction.id).toBe('attack-nearest');
    expect(withEmpower.activeSpecialActions).toEqual([expect.objectContaining({ id: 'fallacy-empower', trigger: 'on-turn-start' })]);

    const withCommand = createAdventurer('fallacy', FALLACY_TEMPLATE, 'front', [], [], [], () => 0.4);
    expect(withCommand.activeSpecialActions).toEqual([expect.objectContaining({ id: 'fallacy-command', trigger: 'on-turn-start' })]);

    const withSilence = createAdventurer('fallacy', FALLACY_TEMPLATE, 'front', [], [], [], () => 0.99);
    expect(withSilence.activeSpecialActions).toEqual([expect.objectContaining({ id: 'fallacy-silence', trigger: 'on-turn-start' })]);
  });

  it("Nerissa's Basic Action is Pickpocket Strike; her pool draws either Gilded Strike or Chain Strike, both on-turn-start", () => {
    const withGildedStrike = createAdventurer('nerissa', NERISSA_TEMPLATE, 'front', [], [], [], () => 0);
    expect(withGildedStrike.basicAction.id).toBe('pickpocket-strike');
    expect(withGildedStrike.activeSpecialActions).toEqual([
      expect.objectContaining({ id: 'nerissa-gilded-strike', trigger: 'on-turn-start' }),
    ]);

    const withChainStrike = createAdventurer('nerissa', NERISSA_TEMPLATE, 'front', [], [], [], () => 0.99);
    expect(withChainStrike.activeSpecialActions).toEqual([
      expect.objectContaining({ id: 'nerissa-chain-strike', trigger: 'on-turn-start' }),
    ]);
  });

  it("Mira attacks as her Basic Action, always has Splash Heal, and draws Potion Toss (Ally) or Revive", () => {
    const withPotionToss = createAdventurer('mira', MIRA_TEMPLATE, 'front', [], [], [], () => 0);
    expect(withPotionToss.basicAction.id).toBe('attack-nearest');
    expect(withPotionToss.activeSpecialActions).toEqual([
      expect.objectContaining({ id: 'mira-splash-heal', trigger: 'on-turn-start' }),
      expect.objectContaining({ id: 'mira-potion-toss-ally', trigger: 'on-turn-start' }),
    ]);

    const withRevive = createAdventurer('mira', MIRA_TEMPLATE, 'front', [], [], [], () => 0.99);
    expect(withRevive.activeSpecialActions).toEqual([
      expect.objectContaining({ id: 'mira-splash-heal' }),
      expect.objectContaining({ id: 'mira-revive', trigger: 'on-turn-start' }),
    ]);
  });

  it('Dee (intentionally blank) has an empty base pool', () => {
    const dee = createAdventurer('test', DEE_TEMPLATE, 'front');
    expect(dee.activeSpecialActions).toEqual([]);
    expect(dee.traits).toEqual([]);
  });

  it("Tharavel's Basic Action is Attack Nearest (moved off Inspire in the \"every Basic Action must deal damage\" cleanup pass); her base pool draws Inspire, Coordinated Strike, or Guardian's Ward, all on-turn-start", () => {
    const withInspire = createAdventurer('tharavel', THARAVEL_TEMPLATE, 'front', [], [], [], () => 0);
    expect(withInspire.basicAction.id).toBe('attack-nearest');
    expect(withInspire.activeSpecialActions).toEqual([expect.objectContaining({ id: 'tharavel-inspire', trigger: 'on-turn-start' })]);

    const withCoordinatedStrike = createAdventurer('tharavel', THARAVEL_TEMPLATE, 'front', [], [], [], () => 0.4);
    expect(withCoordinatedStrike.activeSpecialActions).toEqual([
      expect.objectContaining({ id: 'tharavel-coordinated-strike', trigger: 'on-turn-start' }),
    ]);

    const withGuardiansWard = createAdventurer('tharavel', THARAVEL_TEMPLATE, 'front', [], [], [], () => 0.99);
    expect(withGuardiansWard.activeSpecialActions).toEqual([
      expect.objectContaining({ id: 'tharavel-guardians-ward', trigger: 'on-turn-start' }),
    ]);
  });

  it("Drifta's Basic Action is Piercing Strike; her base pool draws either Opening Strike or Execute Strike, both on-turn-start", () => {
    const withOpeningStrike = createAdventurer('drifta', DRIFTA_TEMPLATE, 'front', [], [], [], () => 0);
    expect(withOpeningStrike.basicAction.id).toBe('piercing-strike');
    expect(withOpeningStrike.activeSpecialActions).toEqual([
      expect.objectContaining({ id: 'drifta-opening-strike', trigger: 'on-turn-start' }),
    ]);

    const withExecuteStrike = createAdventurer('drifta', DRIFTA_TEMPLATE, 'front', [], [], [], () => 0.99);
    expect(withExecuteStrike.activeSpecialActions).toEqual([
      expect.objectContaining({ id: 'drifta-execute-strike', trigger: 'on-turn-start' }),
    ]);
  });

  it("Isilwen's Basic Action is Card Throw; her pool draws either Lucky Draw or Mark, both on-turn-start", () => {
    const withLuckyDraw = createAdventurer('isilwen', ISILWEN_TEMPLATE, 'front', [], [], [], () => 0);
    expect(withLuckyDraw.basicAction.id).toBe('card-throw');
    expect(withLuckyDraw.activeSpecialActions).toEqual([expect.objectContaining({ id: 'isilwen-lucky-draw', trigger: 'on-turn-start' })]);

    const withMark = createAdventurer('isilwen', ISILWEN_TEMPLATE, 'front', [], [], [], () => 0.99);
    expect(withMark.activeSpecialActions).toEqual([expect.objectContaining({ id: 'isilwen-mark', trigger: 'on-turn-start' })]);
  });

  it("Glint's Basic Action is Rallying Strike; her pool draws either Guard Up (on-hit-taken) or Shield Wall (on-turn-start)", () => {
    const withGuardUp = createAdventurer('glint', GLINT_TEMPLATE, 'front', [], [], [], () => 0);
    expect(withGuardUp.basicAction.id).toBe('rallying-strike');
    expect(withGuardUp.activeSpecialActions).toEqual([expect.objectContaining({ id: 'glint-guard-up', trigger: 'on-hit-taken' })]);

    const withShieldWall = createAdventurer('glint', GLINT_TEMPLATE, 'front', [], [], [], () => 0.99);
    expect(withShieldWall.activeSpecialActions).toEqual([expect.objectContaining({ id: 'glint-shield-wall', trigger: 'on-turn-start' })]);
  });

  it("Mirka's Basic Action is Attack Nearest (moved off Fear in the \"every Basic Action must deal damage\" cleanup pass); always has Avenger, and her pool draws Last Stand (on-ally-downed), Stun, or Fear (both on-turn-start)", () => {
    const withLastStand = createAdventurer('mirka', MIRKA_TEMPLATE, 'front', [], [], [], () => 0);
    expect(withLastStand.basicAction.id).toBe('attack-nearest');
    expect(withLastStand.activeSpecialActions).toEqual([
      expect.objectContaining({ id: 'mirka-avenger', trigger: 'on-adjacent-ally-downed' }), expect.objectContaining({ id: 'mirka-last-stand', trigger: 'on-ally-downed' })]);

    const withStun = createAdventurer('mirka', MIRKA_TEMPLATE, 'front', [], [], [], () => 0.4);
    expect(withStun.activeSpecialActions).toEqual([
      expect.objectContaining({ id: 'mirka-avenger', trigger: 'on-adjacent-ally-downed' }), expect.objectContaining({ id: 'mirka-stun', trigger: 'on-turn-start' })]);

    const withFear = createAdventurer('mirka', MIRKA_TEMPLATE, 'front', [], [], [], () => 0.99);
    expect(withFear.activeSpecialActions).toEqual([
      expect.objectContaining({ id: 'mirka-avenger', trigger: 'on-adjacent-ally-downed' }), expect.objectContaining({ id: 'mirka-fear', trigger: 'on-turn-start' })]);
  });

  it("Dravena's Basic Action is Blinding Bolt; her pool draws either Arcane Barrage (on-hit-landed) or Vanish (on-turn-start)", () => {
    const withArcaneBarrage = createAdventurer('dravena', DRAVENA_TEMPLATE, 'front', [], [], [], () => 0);
    expect(withArcaneBarrage.basicAction.id).toBe('blinding-bolt');
    expect(withArcaneBarrage.activeSpecialActions).toEqual([
      expect.objectContaining({ id: 'dravena-arcane-barrage', trigger: 'on-hit-landed' }),
    ]);

    const withVanish = createAdventurer('dravena', DRAVENA_TEMPLATE, 'front', [], [], [], () => 0.99);
    expect(withVanish.activeSpecialActions).toEqual([expect.objectContaining({ id: 'dravena-vanish', trigger: 'on-turn-start' })]);
  });

  it("Caladwen's Basic Action is Sneak Strike; her pool draws either Venom Sting (on-hit-landed) or Lifesteal Strike (on-turn-start)", () => {
    const withVenomSting = createAdventurer('caladwen', CALADWEN_TEMPLATE, 'front', [], [], [], () => 0);
    expect(withVenomSting.basicAction.id).toBe('sneak-strike');
    expect(withVenomSting.activeSpecialActions).toEqual([expect.objectContaining({ id: 'caladwen-venom-sting', trigger: 'on-hit-landed' })]);

    const withLifesteal = createAdventurer('caladwen', CALADWEN_TEMPLATE, 'front', [], [], [], () => 0.99);
    expect(withLifesteal.activeSpecialActions).toEqual([expect.objectContaining({ id: 'caladwen-lifesteal', trigger: 'on-turn-start' })]);
  });

  it("Melpomene's Basic Action is Focused Shot; her pool draws either Hunter's Instinct (on-enemy-downed) or Scatter Shot (on-turn-start)", () => {
    const withHuntersInstinct = createAdventurer('melpomene', MELEMNOPE_TEMPLATE, 'front', [], [], [], () => 0);
    expect(withHuntersInstinct.basicAction.id).toBe('focused-shot');
    expect(withHuntersInstinct.activeSpecialActions).toEqual([
      expect.objectContaining({ id: 'melpomene-hunters-instinct', trigger: 'on-enemy-downed' }),
    ]);

    const withScatterShot = createAdventurer('melpomene', MELEMNOPE_TEMPLATE, 'front', [], [], [], () => 0.99);
    expect(withScatterShot.activeSpecialActions).toEqual([
      expect.objectContaining({ id: 'melpomene-scatter-shot', trigger: 'on-turn-start' }),
    ]);
  });

  it('signature Basic Actions match each character\'s named identity move', () => {
    expect(createAdventurer('t', ISILWEN_TEMPLATE, 'front').basicAction.id).toBe('card-throw');
    expect(createAdventurer('t', THARAVEL_TEMPLATE, 'front').basicAction.id).toBe('attack-nearest');
    expect(createAdventurer('t', GLINT_TEMPLATE, 'front').basicAction.id).toBe('rallying-strike');
    expect(createAdventurer('t', DRIFTA_TEMPLATE, 'front').basicAction.id).toBe('piercing-strike');
    expect(createAdventurer('t', MIRKA_TEMPLATE, 'front').basicAction.id).toBe('attack-nearest');
    expect(createAdventurer('t', DRAVENA_TEMPLATE, 'front').basicAction.id).toBe('blinding-bolt');
    expect(createAdventurer('t', CALADWEN_TEMPLATE, 'front').basicAction.id).toBe('sneak-strike');
    expect(createAdventurer('t', MELEMNOPE_TEMPLATE, 'front').basicAction.id).toBe('focused-shot');
    expect(createAdventurer('t', DEE_TEMPLATE, 'front').basicAction.id).toBe('attack-nearest');
  });
});
