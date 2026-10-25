import {
  CROPS,
  CROP_IDS,
  HAZARD,
  GREENHOUSE_PLOTS,
  INITIAL_UNLOCKED_PLOTS,
  PLOT_IDS
} from "../config.js";
import { getSeason } from "./season.js";

const UNLOCKED_BY_DEFAULT = new Set(INITIAL_UNLOCKED_PLOTS);
const CROP_BY_ID = new Map(CROP_IDS.map((id) => [id, CROPS[id]]));

export function createEmptyPlot(id, unlocked = UNLOCKED_BY_DEFAULT.has(id)) {
  return { id, unlocked: Boolean(unlocked), crop: null, tendedAt: 0 };
}

export function createEmptyPlots({ unlockedAll = false } = {}) {
  const plots = {};
  for (const id of PLOT_IDS) {
    plots[id] = createEmptyPlot(id, unlockedAll || UNLOCKED_BY_DEFAULT.has(id));
  }
  return plots;
}

export function isKnownCrop(type) {
  return CROP_BY_ID.has(type);
}

export function getCropConfig(type) {
  return CROP_BY_ID.get(type) ?? CROPS.radish;
}

/**
 * Crops have a preferred season. In-season crops grow 20% faster; off-season
 * crops take 25% longer. This makes the existing season system matter without
 * locking any crop out of the shop.
 */
export function seasonGrowthFactor(crop, now = Date.now()) {
  const preferred = crop?.season;
  if (!preferred) return 1;
  return getSeason(now).id === preferred ? 0.8 : 1.25;
}

export function getCropStage(plot, now = Date.now()) {
  if (!plot?.crop) return "empty";
  if (!plot.crop.wateredAt) return "seeded";

  const config = getCropConfig(plot.crop.type);
  const factor = seasonGrowthFactor(config, now);
  const elapsed = Math.max(0, now - plot.crop.wateredAt);
  if (elapsed >= config.readyAfterMs * factor) return "ready";
  if (elapsed >= config.leafyAfterMs * factor) return "growing";
  return "sprout";
}

export function getCropProgress(plot, now = Date.now()) {
  if (!plot?.crop?.wateredAt) return 0;
  const config = getCropConfig(plot.crop.type);
  const factor = seasonGrowthFactor(config, now);
  return Math.min(
    1,
    Math.max(0, (now - plot.crop.wateredAt) / (config.readyAfterMs * factor))
  );
}

export function getCropRemainingMs(plot, now = Date.now()) {
  if (!plot?.crop?.wateredAt) return 0;
  const config = getCropConfig(plot.crop.type);
  const factor = seasonGrowthFactor(config, now);
  return Math.max(
    0,
    plot.crop.wateredAt + config.readyAfterMs * factor - now
  );
}

export function hasUnwateredRainCrops(state) {
  const greenhouse = Boolean(state?.world?.greenhouse);
  for (const id of PLOT_IDS) {
    if (greenhouse && GREENHOUSE_PLOTS.includes(id)) continue;
    const plot = state?.plots?.[id];
    if (plot?.crop && !plot.crop.wateredAt) return true;
  }
  return false;
}

/**
 * Deterministic 32-bit string hash. Used for "which plot grows a weed" and
 * "does the harvest return a seed", so the server and the client can agree
 * without sending extra random state.
 */
export function hashString(value) {
  let hash = 2166136261;
  const text = String(value ?? "");
  for (let i = 0; i < text.length; i += 1) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

/**
 * Weeds or a pest appear once per crop while it is growing. They never kill
 * the crop; they only block harvesting until the player clears them. Clearing
 * writes `tendedAt`, so the same crop never sprouts the same hazard twice.
 */
export function getPlotHazard(plot, now = Date.now()) {
  if (!plot?.crop?.wateredAt) return null;

  const seed = hashString(`${plot.id}:${plot.crop.plantedAt}`);
  if (seed % 100 >= HAZARD.chancePercent) return null;

  const appearsAt =
    plot.crop.wateredAt + HAZARD.minDelayMs + (seed % HAZARD.spreadMs);
  if (now < appearsAt) return null;
  if ((plot.tendedAt ?? 0) >= appearsAt) return null;

  return {
    kind: seed % 2 === 0 ? "weeds" : "pest",
    at: appearsAt
  };
}

export function hasSeedReturn(plot, greenhouse = false) {
  if (greenhouse) return true;
  if (!plot?.crop) return false;
  const config = getCropConfig(plot.crop.type);
  const seed = hashString(`seed:${plot.id}:${plot.crop.plantedAt}`);
  return seed % 100 < config.seedYieldChance;
}

export function sanitizeSavedCrop(raw) {
  if (!raw || typeof raw !== "object") return null;

  const plantedAt = Number(raw.plantedAt);
  if (!Number.isFinite(plantedAt)) return null;

  let wateredAt =
    raw.wateredAt === null || raw.wateredAt === undefined
      ? null
      : Number(raw.wateredAt);
  if (wateredAt !== null && !Number.isFinite(wateredAt)) {
    wateredAt = null;
  }
  if (wateredAt !== null && wateredAt < plantedAt) {
    wateredAt = plantedAt;
  }

  const type = isKnownCrop(raw.type) ? raw.type : CROPS.radish.id;
  return { type, plantedAt, wateredAt };
}

export function sanitizeSavedPlot(id, raw, { unlockedAll = false } = {}) {
  const fallback = createEmptyPlot(id, unlockedAll || UNLOCKED_BY_DEFAULT.has(id));
  if (!raw || typeof raw !== "object") return fallback;

  const tendedAt = Number(raw.tendedAt);
  return {
    id,
    unlocked:
      typeof raw.unlocked === "boolean"
        ? raw.unlocked
        : unlockedAll || UNLOCKED_BY_DEFAULT.has(id),
    crop: sanitizeSavedCrop(raw.crop),
    tendedAt: Number.isFinite(tendedAt) && tendedAt > 0 ? tendedAt : 0
  };
}

export function clonePlot(plot) {
  return {
    id: plot.id,
    unlocked: Boolean(plot.unlocked),
    tendedAt: Number(plot.tendedAt) || 0,
    crop: plot.crop
      ? {
          type: plot.crop.type,
          plantedAt: plot.crop.plantedAt,
          wateredAt: plot.crop.wateredAt
        }
      : null
  };
}

export function clonePlots(plots) {
  const next = {};
  for (const id of PLOT_IDS) {
    const plot = plots?.[id];
    next[id] = plot ? clonePlot(plot) : createEmptyPlot(id);
  }
  return next;
}
