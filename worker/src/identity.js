/**
 * Pure identity helpers for the Room DO. A browser keeps a stable `client`
 * query id, and its last player row lives in SQLite, so refresh / network
 * drops can resume as the same player instead of spawning a new one.
 */
import { CHARACTERS, SCENE, characterNameFor } from "../../src/config.js";

const SCENES = new Set(Object.values(SCENE));
const FACINGS = new Set([
  "north",
  "north_east",
  "east",
  "south_east",
  "south",
  "south_west",
  "west",
  "north_west"
]);

export function sanitizeScene(value) {
  return SCENES.has(value) ? value : SCENE.OUTDOOR;
}

export function sanitizeFacing(value) {
  return FACINGS.has(value) ? value : "south";
}

function sanitizeText(value, maxLength) {
  return typeof value === "string" ? value.trim().slice(0, maxLength) : "";
}

/**
 * Normalize one `player_identity` row. Returns null when it cannot be used.
 */
export function identityFromRow(row) {
  if (!row) return null;
  const playerId = sanitizeText(row.player_id, 64);
  if (!playerId) return null;

  const x = Number(row.x);
  const y = Number(row.y);
  return {
    playerId,
    name: sanitizeText(row.name, 12),
    currentScene: sanitizeScene(row.scene),
    position:
      Number.isFinite(x) && Number.isFinite(y) ? { x, y } : null,
    facing: sanitizeFacing(row.facing)
  };
}

/**
 * Decide who this connection is. Precedence:
 *   live player (same socket/tab) > stored identity (same client) > new player.
 */
export function resolveJoin({
  id,
  stored = null,
  live = null,
  existingMeta = null,
  requestedName = "",
  playerCount = 0,
  takenNames = [],
  spawn = { x: 0, y: 0 }
}) {
  const playerId = sanitizeText(id, 64);
  if (!playerId) return null;

  const resumed = Boolean(stored && stored.playerId === playerId);
  // Names are fixed character names. Old saved A/B (or legacy free names) map
  // back onto the two configured characters; no client can inject a new name.
  const taken = new Set(
    (Array.isArray(takenNames) ? takenNames : [])
      .map((value) => characterNameFor(value))
      .filter(Boolean)
  );
  const fallback =
    taken.size > 0
      ? !taken.has(CHARACTERS.A.name)
        ? CHARACTERS.A.name
        : CHARACTERS.B.name
      : playerCount > 0
        ? CHARACTERS.B.name
        : CHARACTERS.A.name;
  const name =
    characterNameFor(requestedName) ||
    characterNameFor(existingMeta?.name) ||
    characterNameFor(live?.name) ||
    characterNameFor(stored?.name) ||
    fallback;

  const position =
    live && Number.isFinite(Number(live.position?.x)) && Number.isFinite(Number(live.position?.y))
      ? { x: Number(live.position.x), y: Number(live.position.y) }
      : resumed && stored.position
        ? { ...stored.position }
        : { x: Number(spawn?.x) || 0, y: Number(spawn?.y) || 0 };

  return {
    id: playerId,
    name: name || CHARACTERS.A.name,
    currentScene:
      live?.currentScene
        ? sanitizeScene(live.currentScene)
        : resumed
          ? sanitizeScene(stored.currentScene)
          : SCENE.OUTDOOR,
    position,
    facing:
      live?.facing
        ? sanitizeFacing(live.facing)
        : resumed
          ? sanitizeFacing(stored.facing)
          : "south",
    resumed
  };
}
