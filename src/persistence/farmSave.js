import {
  CROP_IDS,
  ECONOMY,
  FARM_SAVE_KEY,
  FARM_SAVE_VERSION,
  LEGACY_FARM_SAVE_KEY,
  PLOT_IDS
} from "../config.js";
import { sanitizeBoardMessages } from "../game/board.js";
import {
  createEmptyPlots,
  sanitizeSavedPlot
} from "../game/crop.js";
import { sanitizeWorld } from "../game/world.js";
import { sanitizeGoods } from "../game/warehouse.js";
import { sanitizeDishes, sanitizeProduce } from "../game/kitchen.js";

function normalizeSeeds(raw) {
  const seeds = {};
  for (const cropId of CROP_IDS) {
    const value = Number(raw?.[cropId]);
    seeds[cropId] = Number.isFinite(value) && value > 0 ? Math.floor(value) : 0;
  }
  return seeds;
}

function normalizeStats(raw, fallbackCoins = ECONOMY.startingCoins) {
  const harvested = Number(raw?.harvested);
  const coins = Number(raw?.coins);
  const cooked = Number(raw?.cooked);
  const meals = Number(raw?.meals);
  return {
    harvested:
      Number.isFinite(harvested) && harvested >= 0 ? Math.floor(harvested) : 0,
    coins:
      Number.isFinite(coins) && coins >= 0 ? Math.floor(coins) : fallbackCoins,
    giftDay: typeof raw?.giftDay === "string" ? raw.giftDay.slice(0, 10) : "",
    cooked: Number.isFinite(cooked) && cooked >= 0 ? Math.floor(cooked) : 0,
    meals: Number.isFinite(meals) && meals >= 0 ? Math.floor(meals) : 0,
    mealDay: typeof raw?.mealDay === "string" ? raw.mealDay.slice(0, 10) : ""
  };
}

function readJson(target, key) {
  const raw = target?.getItem(key);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? parsed : null;
  } catch {
    return null;
  }
}

function parseV3(parsed) {
  const plots = createEmptyPlots();
  for (const id of PLOT_IDS) {
    plots[id] = sanitizeSavedPlot(id, parsed.plots?.[id]);
  }
  const lastReadAt = Number(parsed.board?.lastReadAt);
  return {
    plots,
    stats: normalizeStats(parsed.stats),
    inventory: {
      seeds: normalizeSeeds(parsed.inventory?.seeds),
      goods: sanitizeGoods(parsed.inventory?.goods),
      produce: sanitizeProduce(parsed.inventory?.produce),
      dishes: sanitizeDishes(parsed.inventory?.dishes)
    },
    world: sanitizeWorld(parsed.world),
    board: {
      messages: sanitizeBoardMessages(parsed.board?.messages),
      lastReadAt:
        Number.isFinite(lastReadAt) && lastReadAt > 0 ? lastReadAt : 0
    }
  };
}

/** v2 stored a single crop type and had no wallet or locked plots. */
function parseV2(parsed) {
  const plots = createEmptyPlots({ unlockedAll: true });
  for (const id of PLOT_IDS) {
    plots[id] = sanitizeSavedPlot(id, parsed.plots?.[id], { unlockedAll: true });
  }
  return {
    plots,
    stats: normalizeStats(parsed.stats),
    inventory: {
      seeds: normalizeSeeds(ECONOMY.startingSeeds),
      goods: sanitizeGoods(null),
      produce: sanitizeProduce(null),
      dishes: sanitizeDishes(null)
    },
    world: sanitizeWorld({ greenhouse: false }),
    board: {
      messages: sanitizeBoardMessages(parsed.board?.messages),
      lastReadAt: Math.max(0, Number(parsed.board?.lastReadAt) || 0)
    }
  };
}

/**
 * Read the local farm snapshot. v3 is current; a v2 snapshot is migrated in
 * place (all six plots unlocked, a starter wallet and seeds). Returns null
 * when storage is unavailable, empty, corrupt, or from an unknown schema.
 */
export function readFarmSave(storage) {
  try {
    const target = storage ?? globalThis.localStorage;
    const current = readJson(target, FARM_SAVE_KEY);
    if (current) {
      if (current.version === FARM_SAVE_VERSION) return parseV3(current);
      return null;
    }

    const legacy = readJson(target, LEGACY_FARM_SAVE_KEY);
    if (legacy && legacy.version === 2) return parseV2(legacy);
    return null;
  } catch {
    // Private mode and file restrictions can disable localStorage. The game
    // still runs fully from in-memory state.
    return null;
  }
}

/**
 * Persist only durable progress. Player position, scene, selection and
 * ephemeral UI are deliberately not part of this snapshot.
 */
export function writeFarmSave(currentState, storage) {
  try {
    const target = storage ?? globalThis.localStorage;
    const plots = {};
    for (const id of PLOT_IDS) {
      const plot = currentState.plots[id];
      plots[id] = {
        id,
        unlocked: Boolean(plot?.unlocked),
        tendedAt: Number(plot?.tendedAt) || 0,
        crop: plot?.crop
          ? {
              type: plot.crop.type,
              plantedAt: plot.crop.plantedAt,
              wateredAt: plot.crop.wateredAt
            }
          : null
      };
    }

    const seeds = {};
    for (const cropId of CROP_IDS) {
      seeds[cropId] = Math.max(
        0,
        Math.floor(Number(currentState.inventory?.seeds?.[cropId]) || 0)
      );
    }

    target?.setItem(
      FARM_SAVE_KEY,
      JSON.stringify({
        version: FARM_SAVE_VERSION,
        savedAt: Date.now(),
        plots,
        stats: {
          harvested: currentState.stats?.harvested ?? 0,
          coins: currentState.stats?.coins ?? 0,
          giftDay: currentState.stats?.giftDay ?? "",
          cooked: currentState.stats?.cooked ?? 0,
          meals: currentState.stats?.meals ?? 0,
          mealDay: currentState.stats?.mealDay ?? ""
        },
        inventory: {
          seeds,
          goods: sanitizeGoods(currentState.inventory?.goods),
          produce: sanitizeProduce(currentState.inventory?.produce),
          dishes: sanitizeDishes(currentState.inventory?.dishes)
        },
        world: sanitizeWorld(currentState.world),
        board: {
          messages: sanitizeBoardMessages(currentState.board?.messages),
          lastReadAt: Math.max(0, Number(currentState.board?.lastReadAt) || 0)
        }
      })
    );
  } catch {
    // Persistence is best-effort in this local prototype.
  }
}
