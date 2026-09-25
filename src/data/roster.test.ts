import { describe, it, expect } from 'vitest';
import { createStarterRoster } from './roster';
import { DAWNETH_TEMPLATE, DRAVENA_TEMPLATE, ISILWEN_TEMPLATE, GUDRUN_TEMPLATE } from './characters';

describe('createStarterRoster', () => {
  it('starts squishy/support roles in the back row and melee roles in the front row', () => {
    const roster = createStarterRoster();
    const byName = (name: string) => roster.find((adventurer) => adventurer.name === name)!;

    expect(byName(DAWNETH_TEMPLATE.name).row).toBe('back'); // Healer
    expect(byName(DRAVENA_TEMPLATE.name).row).toBe('back'); // Mage
    expect(byName(GUDRUN_TEMPLATE.name).row).toBe('front'); // Fighter
  });

  it("honors a template's explicit defaultRow override over its role default", () => {
    const roster = createStarterRoster();
    const isilwen = roster.find((adventurer) => adventurer.name === ISILWEN_TEMPLATE.name)!;

    // Rogue defaults front, but Isilwen's kit is fully ranged — see her defaultRow override.
    expect(isilwen.row).toBe('back');
  });
});
