import { FACING_YAW, SCENE, WALK_LAYOUTS } from "../config.js";
import { clonePlots as clonePlotState } from "./crop.js";
import { createPlayerEntity } from "./player.js";

const SCENE_VALUES = new Set(Object.values(SCENE));
const FACING_VALUES = new Set(Object.keys(FACING_YAW));

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function sanitizeName(value) {
  const text = typeof value === "string" ? value.trim().slice(0, 12) : "";
  return text || "?";
}

export const clonePlots = clonePlotState;

export function presenceOf(player) {
  return {
    id: player.id,
    name: player.name,
    currentScene: player.currentScene,
    position: { x: player.position.x, y: player.position.y },
    facing: player.facing,
    activity: player.activity ?? null,
    destination: player.destination
      ? { x: player.destination.x, y: player.destination.y }
      : null
  };
}

/**
 * Turn an untrusted presence payload into a complete player entity. Remote
 * players carry only a sanitized destination for the dotted route guide;
 * their local A* waypoints are reconstructed by the renderer.
 */
export function playerFromPresence(data) {
  if (!data || typeof data.id !== "string" || !data.id) return null;

  const scene = SCENE_VALUES.has(data.currentScene)
    ? data.currentScene
    : SCENE.OUTDOOR;
  const layout = WALK_LAYOUTS[scene];
  const rawX = Number(data.position?.x);
  const rawY = Number(data.position?.y);
  if (!Number.isFinite(rawX) || !Number.isFinite(rawY)) return null;

  const x = clamp(rawX, layout.bounds.minX, layout.bounds.maxX);
  const y = clamp(rawY, layout.bounds.minZ, layout.bounds.maxZ);

  const rawGoalX = Number(data.destination?.x);
  const rawGoalY = Number(data.destination?.y);
  const destination =
    Number.isFinite(rawGoalX) && Number.isFinite(rawGoalY)
      ? {
          x: clamp(rawGoalX, layout.bounds.minX, layout.bounds.maxX),
          y: clamp(rawGoalY, layout.bounds.minZ, layout.bounds.maxZ)
        }
      : null;

  return createPlayerEntity({
    id: data.id,
    name: sanitizeName(data.name),
    currentScene: scene,
    position: { x, y },
    facing: FACING_VALUES.has(data.facing) ? data.facing : "south",
    destination,
    activity: data.activity ?? null
  });
}

/**
 * Merge one presence update into a full state. Returns the new state and
 * whether this player was not known before (used to refresh HUD counters).
 */
export function applyPresence(state, data) {
  const player = playerFromPresence(data);
  if (!player) return { state, added: false };

  return {
    state: {
      ...state,
      players: { ...state.players, [player.id]: player }
    },
    added: !state.players[player.id]
  };
}

export function removePresence(state, playerId) {
  if (!state.players[playerId]) return state;
  const players = { ...state.players };
  delete players[playerId];
  return { ...state, players };
}
