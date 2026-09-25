/** Lowercases and replaces spaces with underscores (e.g. "Kobold Skirmisher" -> "kobold_skirmisher") so a multi-word archetype name still resolves to a valid asset filename. Mirrors game/RoomReplayScene.ts's own copy. */
function slugifyArchetype(archetype: string): string {
  return archetype.toLowerCase().replace(/\s+/g, '_');
}

/**
 * Portrait asset path helper, mirroring game/RoomReplayScene.ts's
 * portraitAssetPath convention (`/portraits/<archetype-slug>-<state>.png`)
 * so UI and the Phaser replay scene never diverge on naming.
 */
export function portraitAssetPath(archetype: string, state: string): string {
  return `/portraits/${slugifyArchetype(archetype)}-${state}.png`;
}

/**
 * Full-landscape Downed-popup art (distinct from the 2:3 portrait crop
 * above) for `archetype` downed by `killerArchetype` — e.g.
 * "gudrun-downed-brute". `killerArchetype` is null for a status-effect kill
 * (e.g. Burn), which has no single attacker to depict — same convention as
 * downedArtFallbackPath below, which the caller's <img onerror> should fall
 * back to when the specific pairing has no art yet.
 */
export function downedArtPath(archetype: string, killerArchetype: string | null): string {
  if (killerArchetype === null) {
    return downedArtFallbackPath(archetype);
  }
  return `/downed-art/${slugifyArchetype(archetype)}-downed-${slugifyArchetype(killerArchetype)}.png`;
}

/** Generic Downed art for `archetype` — used directly for a status-effect kill, and as the onerror fallback for a missing killer-specific asset. */
export function downedArtFallbackPath(archetype: string): string {
  return `/downed-art/${slugifyArchetype(archetype)}-downed-general.png`;
}
