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

/** Grid body sprite (public/sprites/) — same file game/RoomReplayScene.ts's bodyAssetPath loads for the battle view, so the formation board shows exactly the figure that will fight. */
export function bodySpritePath(side: 'party' | 'enemy', archetype: string): string {
  const folder = side === 'party' ? 'adventurers' : 'monsters';
  return `/sprites/${folder}/${slugifyArchetype(archetype)}.png`;
}

/** The stand-in body sprite for an archetype with no art yet — the `<img onerror>` fallback for bodySpritePath. */
export function defaultBodySpritePath(side: 'party' | 'enemy'): string {
  return side === 'party' ? '/sprites/adventurers/default_adventurer.png' : '/sprites/monsters/default_monster.png';
}

/** The bits of an Adventurer the art helpers need — its base archetype and its active Kit (for costume art). */
interface ArtSubject {
  archetype: string;
  activeKit?: { artKey: string };
}

function unique(paths: string[]): string[] {
  return [...new Set(paths)];
}

/** Portrait paths to try in order: Kit costume art for `state`, Kit idle, base art for `state`, base idle. */
export function portraitCandidates(subject: ArtSubject, state: string): string[] {
  const kitKey = subject.activeKit?.artKey;
  return unique([
    ...(kitKey ? [portraitAssetPath(kitKey, state), portraitAssetPath(kitKey, 'idle')] : []),
    portraitAssetPath(subject.archetype, state),
    portraitAssetPath(subject.archetype, 'idle'),
  ]);
}

/** Downed-art paths to try in order: Kit killer-specific, Kit general, base killer-specific, base general, base idle portrait. */
export function downedArtCandidates(subject: ArtSubject, killerArchetype: string | null): string[] {
  const kitKey = subject.activeKit?.artKey;
  return unique([
    ...(kitKey ? [downedArtPath(kitKey, killerArchetype), downedArtFallbackPath(kitKey)] : []),
    downedArtPath(subject.archetype, killerArchetype),
    downedArtFallbackPath(subject.archetype),
    portraitAssetPath(subject.archetype, 'idle'),
  ]);
}

/** Body sprite paths to try in order: Kit costume sprite, base sprite, generic stand-in. */
export function bodySpriteCandidates(subject: ArtSubject, side: 'party' | 'enemy'): string[] {
  const kitKey = subject.activeKit?.artKey;
  return unique([
    ...(kitKey ? [bodySpritePath(side, kitKey)] : []),
    bodySpritePath(side, subject.archetype),
    defaultBodySpritePath(side),
  ]);
}

/** Cut-in art (public/cutins/): square, transparent-background art for the battle cut-ins (ui/CutInOverlay.svelte). */
export function cutInAssetPath(archetype: string, state: string): string {
  return `/cutins/${slugifyArchetype(archetype)}-${state}.png`;
}

/** Cut-in art paths to try in order: Kit cut-in for `state`, Kit cut-in idle, base cut-in for `state`, base cut-in idle, then the portrait chain. */
export function cutInCandidates(subject: ArtSubject, state: string): string[] {
  const kitKey = subject.activeKit?.artKey;
  return unique([
    ...(kitKey ? [cutInAssetPath(kitKey, state), cutInAssetPath(kitKey, 'idle')] : []),
    cutInAssetPath(subject.archetype, state),
    cutInAssetPath(subject.archetype, 'idle'),
    ...portraitCandidates(subject, state),
  ]);
}
