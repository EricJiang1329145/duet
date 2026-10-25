import { DECOR_IDS, SCENE_RESOURCES, SCENE_UNLOCKS } from "../config.js";
import { sanitizeMeal } from "./kitchen.js";

const DECOR_SET = new Set(DECOR_IDS);
const EXTRA_SCENE_IDS = Object.keys(SCENE_UNLOCKS);
const RESOURCE_IDS = Object.values(SCENE_RESOURCES)
  .flat()
  .map((node) => node.id);

/**
 * Normalize the small persistent world slice: greenhouse + purchased decor.
 * Unknown decoration ids are dropped so old/new clients cannot inject props.
 */
export function sanitizeWorld(raw) {
  const decor = {};
  for (const id of DECOR_IDS) {
    if (raw?.decor?.[id]) decor[id] = true;
  }
  const scenes = {};
  for (const id of EXTRA_SCENE_IDS) {
    scenes[id] = Boolean(raw?.scenes?.[id]);
  }
  const forage = {};
  for (const id of RESOURCE_IDS) {
    const rawForage = raw?.forage?.[id];
    if (!rawForage || typeof rawForage !== "object") continue;
    const days = {};
    for (const [playerId, day] of Object.entries(rawForage)) {
      if (
        typeof playerId === "string" &&
        playerId.length > 0 &&
        playerId.length <= 64 &&
        typeof day === "string" &&
        /^\d{4}-\d{2}-\d{2}$/.test(day.slice(0, 10))
      ) {
        days[playerId] = day.slice(0, 10);
      }
    }
    if (Object.keys(days).length) forage[id] = days;
  }
  return {
    greenhouse: Boolean(raw?.greenhouse),
    decor,
    scenes,
    forage,
    // A dish left on the dining table for the other player. Additive field;
    // old worlds simply have no meal.
    meal: sanitizeMeal(raw?.meal)
  };
}

export function cloneWorld(raw) {
  return sanitizeWorld(raw);
}

export function countDecor(world) {
  const decor = world?.decor ?? {};
  let count = 0;
  for (const id of DECOR_IDS) {
    if (decor[id] && DECOR_SET.has(id)) count += 1;
  }
  return count;
}

export function isSceneUnlocked(world, sceneId) {
  return Boolean(world?.scenes?.[sceneId]);
}

export function hasAnyDecor(world) {
  return countDecor(world) > 0;
}
