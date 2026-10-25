import {
  ACTION,
  CROPS,
  ECONOMY,
  FARM_SCENES,
  GREENHOUSE_COST,
  GREENHOUSE_PLOTS,
  GREENHOUSE_SELL_MULTIPLIER,
  HAZARD,
  PLOT_IDS,
  PLOT_UNLOCK_COST,
  plotSceneFor
} from "../config.js";
import {
  getCropConfig,
  getCropStage,
  getPlotHazard,
  hasSeedReturn,
  isKnownCrop
} from "./crop.js";
import { getDayKey, getWeather } from "./season.js";
import {
  applyDecorPurchase,
  applyDecorRemoval,
  getDecorNotice,
  validateDecorPurchase,
  validateDecorRemoval
} from "./decor.js";
import {
  applyKitchenAction,
  getKitchenNotice,
  isKitchenAction,
  validateKitchenAction
} from "./kitchen.js";

const FARM_ACTIONS = new Set([
  ACTION.PLANT_CROP,
  ACTION.WATER_CROP,
  ACTION.HARVEST_CROP,
  ACTION.CLEAR_HAZARD,
  ACTION.UNLOCK_PLOT,
  ACTION.BUY_SEED,
  ACTION.BUY_GREENHOUSE,
  ACTION.CLAIM_GIFT,
  ACTION.BUY_DECOR,
  ACTION.REMOVE_DECOR,
  ACTION.COOK_DISH,
  ACTION.SELL_DISH,
  ACTION.SERVE_MEAL,
  ACTION.EAT_MEAL,
  ACTION.RAIN_WATER
]);

export function isFarmAction(action) {
  return FARM_ACTIONS.has(action);
}

export function getCoins(state) {
  return Math.max(0, Math.floor(Number(state?.stats?.coins) || 0));
}

export function getSeedCount(state, cropType) {
  return Math.max(
    0,
    Math.floor(Number(state?.inventory?.seeds?.[cropType]) || 0)
  );
}

export function getPlotUnlockCost(plotId) {
  return Math.max(0, Number(PLOT_UNLOCK_COST[plotId]) || 0);
}

export function getGreenhouseCost() {
  return GREENHOUSE_COST;
}

export function harvestReward(plot, state) {
  const crop = plot?.crop;
  if (!crop) return { coins: 0, seeds: 0, produce: 0, cropType: null };
  const config = getCropConfig(crop.type);
  // The greenhouse only covers its two dedicated beds; other plots do not
  // inherit the bonus.
  const greenhouse =
    Boolean(state?.world?.greenhouse) &&
    GREENHOUSE_PLOTS.includes(plot?.id);
  const coins = Math.round(
    config.sellPrice * (greenhouse ? GREENHOUSE_SELL_MULTIPLIER : 1)
  );
  const seeds = hasSeedReturn(plot, greenhouse) ? 1 : 0;
  // Every harvest also leaves one fresh ingredient for the kitchen. Coins and
  // the seed roll are unchanged, so the existing farm loop keeps its value.
  return { coins, seeds, produce: 1, cropType: crop.type };
}

export function canClaimGift(state, now = Date.now()) {
  return state?.stats?.giftDay !== getDayKey(now);
}

function withPlots(state, plots) {
  return { ...state, plots };
}

function withWallet(state, { coins, seeds }) {
  const next = { ...state, stats: { ...state.stats } };
  if (Number.isFinite(coins)) next.stats.coins = Math.max(0, Math.floor(coins));
  if (seeds) {
    next.inventory = {
      ...state.inventory,
      seeds: { ...state.inventory?.seeds, ...seeds }
    };
  }
  return next;
}

/**
 * Farm and economy rules shared by the local session and the room authority.
 * Pure: no DOM, no Three.js, no storage, no timers. Selection is local UI.
 */
export function validateFarmAction(
  state,
  playerId,
  action,
  targetId,
  payload = null,
  now = Date.now()
) {
  const player = state?.players?.[playerId];
  if (!player) return { ok: false, code: "NO_PLAYER" };

  // Cooking and eating live on the first floor, so they are validated before
  // the outdoor farm-scene gate. Both modes still share this one entry point.
  if (isKitchenAction(action)) {
    return validateKitchenAction(
      state,
      playerId,
      action,
      targetId,
      payload,
      now
    );
  }

  if (action === ACTION.BUY_DECOR) {
    return validateDecorPurchase(state, playerId, targetId);
  }
  if (action === ACTION.REMOVE_DECOR) {
    return validateDecorRemoval(state, playerId, targetId);
  }

  // Rain is a room-level event, not a plot interaction: it must also be
  // allowed while both players are inside, otherwise a real rain shower would
  // never water the field unless someone happened to stand outdoors.
  if (action === ACTION.RAIN_WATER) {
    if (state.weatherAuthority && !state.weather) {
      return { ok: false, code: "NOT_RAINING" };
    }
    const raining = state.weather
      ? Boolean(state.weather.rain)
      : getWeather(now).id === "rain" || payload?.reportedRain === true;
    return raining ? { ok: true } : { ok: false, code: "NOT_RAINING" };
  }

  if (!FARM_SCENES.has(player.currentScene)) {
    return { ok: false, code: "NOT_FARM_SCENE" };
  }

  const plot =
    targetId && Object.hasOwn(state.plots ?? {}, targetId)
      ? state.plots[targetId]
      : null;
  if (plot && plotSceneFor(state.world, targetId) !== player.currentScene) {
    return { ok: false, code: "WRONG_SCENE" };
  }

  switch (action) {
    case ACTION.PLANT_CROP: {
      if (!plot) return { ok: false, code: "NO_PLOT" };
      if (!plot.unlocked) return { ok: false, code: "PLOT_LOCKED" };
      if (plot.crop) return { ok: false, code: "PLOT_OCCUPIED" };
      const cropType = payload?.cropType ?? CROPS.radish.id;
      if (!isKnownCrop(cropType)) return { ok: false, code: "UNKNOWN_CROP" };
      if (getSeedCount(state, cropType) < 1) {
        return { ok: false, code: "NO_SEEDS" };
      }
      return { ok: true, cropType };
    }

    case ACTION.WATER_CROP: {
      if (!plot) return { ok: false, code: "NO_PLOT" };
      if (!plot.crop) return { ok: false, code: "PLOT_EMPTY" };
      if (plot.crop.wateredAt) {
        return { ok: false, code: "ALREADY_WATERED" };
      }
      return { ok: true };
    }

    case ACTION.HARVEST_CROP: {
      if (!plot) return { ok: false, code: "NO_PLOT" };
      const at = Number.isFinite(now) ? now : Date.now();
      if (getCropStage(plot, at) !== "ready") {
        return { ok: false, code: "NOT_READY" };
      }
      if (getPlotHazard(plot, at)) {
        return { ok: false, code: "HAZARD_PRESENT" };
      }
      return { ok: true };
    }

    case ACTION.CLEAR_HAZARD: {
      if (!plot) return { ok: false, code: "NO_PLOT" };
      const at = Number.isFinite(now) ? now : Date.now();
      const hazard = getPlotHazard(plot, at);
      if (!hazard) return { ok: false, code: "NO_HAZARD" };
      return { ok: true, hazard };
    }

    case ACTION.UNLOCK_PLOT: {
      if (!plot) return { ok: false, code: "NO_PLOT" };
      if (plot.unlocked) return { ok: false, code: "ALREADY_UNLOCKED" };
      if (getCoins(state) < getPlotUnlockCost(targetId)) {
        return { ok: false, code: "NO_COINS" };
      }
      return { ok: true };
    }

    case ACTION.BUY_SEED: {
      const cropType = payload?.cropType;
      if (!isKnownCrop(cropType)) return { ok: false, code: "UNKNOWN_CROP" };
      const count = Math.min(5, Math.max(1, Math.floor(Number(payload?.count) || 1)));
      const cost = getCropConfig(cropType).seedCost * count;
      if (getCoins(state) < cost) return { ok: false, code: "NO_COINS" };
      return { ok: true, cropType, count, cost };
    }

    case ACTION.BUY_GREENHOUSE: {
      if (state.world?.greenhouse) {
        return { ok: false, code: "GREENHOUSE_OWNED" };
      }
      if (getCoins(state) < GREENHOUSE_COST) {
        return { ok: false, code: "NO_COINS" };
      }
      return { ok: true };
    }

    case ACTION.CLAIM_GIFT: {
      if (!canClaimGift(state, Number.isFinite(now) ? now : Date.now())) {
        return { ok: false, code: "GIFT_CLAIMED" };
      }
      return { ok: true };
    }

    default:
      return { ok: false, code: "NOT_FARM_ACTION" };
  }
}

export function applyFarmAction(
  state,
  playerId,
  action,
  targetId,
  payload = null,
  now = Date.now()
) {
  const check = validateFarmAction(
    state,
    playerId,
    action,
    targetId,
    payload,
    now
  );
  if (!check.ok) return null;

  if (isKitchenAction(action)) {
    return applyKitchenAction(
      state,
      playerId,
      action,
      targetId,
      payload,
      now
    );
  }

  if (action === ACTION.BUY_DECOR) {
    return applyDecorPurchase(state, playerId, targetId);
  }
  if (action === ACTION.REMOVE_DECOR) {
    return applyDecorRemoval(state, playerId, targetId);
  }

  const at = Number.isFinite(now) ? now : Date.now();
  const plot =
    targetId && Object.hasOwn(state.plots ?? {}, targetId)
      ? state.plots[targetId]
      : null;

  if (action === ACTION.RAIN_WATER) {
    let changed = false;
    const plots = { ...state.plots };
    const hasGreenhouse = Boolean(state.world?.greenhouse);
    for (const id of PLOT_IDS) {
      if (hasGreenhouse && GREENHOUSE_PLOTS.includes(id)) continue;
      const plot = plots[id];
      if (!plot?.crop || plot.crop.wateredAt) continue;
      plots[id] = {
        ...plot,
        crop: { ...plot.crop, wateredAt: at }
      };
      changed = true;
    }
    return changed ? withPlots(state, plots) : state;
  }

  if (action === ACTION.PLANT_CROP) {
    const cropType = check.cropType;
    const seeds = {
      ...state.inventory?.seeds,
      [cropType]: getSeedCount(state, cropType) - 1
    };
    const withSeeds = withWallet(state, { seeds });
    return withPlots(withSeeds, {
      ...state.plots,
      [targetId]: {
        ...plot,
        tendedAt: 0,
        crop: { type: cropType, plantedAt: at, wateredAt: null }
      }
    });
  }

  if (action === ACTION.WATER_CROP) {
    return withPlots(state, {
      ...state.plots,
      [targetId]: {
        ...plot,
        tendedAt: 0,
        crop: { ...plot.crop, wateredAt: at }
      }
    });
  }

  if (action === ACTION.CLEAR_HAZARD) {
    return withPlots(state, {
      ...state.plots,
      [targetId]: { ...plot, tendedAt: at }
    });
  }

  if (action === ACTION.HARVEST_CROP) {
    const reward = harvestReward(plot, state);
    const seeds = {
      ...state.inventory?.seeds,
      [reward.cropType]:
        getSeedCount(state, reward.cropType) + reward.seeds
    };
    let next = withWallet(state, {
      coins: getCoins(state) + reward.coins,
      seeds
    });
    if (reward.produce > 0) {
      const produce = {
        ...state.inventory?.produce,
        [reward.cropType]:
          Math.max(
            0,
            Math.floor(Number(state.inventory?.produce?.[reward.cropType]) || 0)
          ) + reward.produce
      };
      next = { ...next, inventory: { ...next.inventory, produce } };
    }
    next = {
      ...next,
      stats: {
        ...next.stats,
        harvested: (state.stats?.harvested ?? 0) + 1
      }
    };
    return withPlots(next, {
      ...state.plots,
      [targetId]: { ...plot, crop: null, tendedAt: 0 }
    });
  }

  if (action === ACTION.UNLOCK_PLOT) {
    const cost = getPlotUnlockCost(targetId);
    const next = withWallet(state, { coins: getCoins(state) - cost });
    return withPlots(next, {
      ...state.plots,
      [targetId]: { ...plot, unlocked: true }
    });
  }

  if (action === ACTION.BUY_SEED) {
    const seeds = {
      ...state.inventory?.seeds,
      [check.cropType]: getSeedCount(state, check.cropType) + check.count
    };
    return withWallet(state, {
      coins: getCoins(state) - check.cost,
      seeds
    });
  }

  if (action === ACTION.BUY_GREENHOUSE) {
    const next = withWallet(state, { coins: getCoins(state) - GREENHOUSE_COST });
    return {
      ...next,
      world: { ...state.world, greenhouse: true }
    };
  }

  if (action === ACTION.CLAIM_GIFT) {
    const seeds = {
      ...state.inventory?.seeds,
      [ECONOMY.giftCrop]:
        getSeedCount(state, ECONOMY.giftCrop) + ECONOMY.giftSeeds
    };
    const next = withWallet(state, {
      coins: getCoins(state) + ECONOMY.giftCoins,
      seeds
    });
    return {
      ...next,
      stats: { ...next.stats, giftDay: getDayKey(at) }
    };
  }

  return null;
}

function cropLabel(cropType) {
  return getCropConfig(cropType).label;
}

/**
 * Shared feedback copy, so the local reducer and the room authority never
 * drift apart. `payload` may carry the hazard kind detected before applying.
 */
export function getFarmNotice(action, state, payload = null, check = null) {
  if (isKitchenAction(action)) {
    return getKitchenNotice(action, state, payload, check);
  }
  switch (action) {
    case ACTION.RAIN_WATER:
      return {
        text: "下雨了，院子里的作物喝饱了水。",
        tone: "farm"
      };

    case ACTION.PLANT_CROP: {
      const cropType = payload?.cropType ?? CROPS.radish.id;
      return {
        text: `种下了${cropLabel(cropType)}，给它浇点水吧。`,
        tone: "farm"
      };
    }
    case ACTION.WATER_CROP:
      return {
        text: `水浇好了，${cropLabel(payload?.cropType)}开始生长。`,
        tone: "farm"
      };
    case ACTION.CLEAR_HAZARD:
      return {
        text:
          payload?.hazardKind === "pest"
            ? "虫子捉掉了，可以继续照料。"
            : "杂草清理干净了，可以继续照料。",
        tone: "farm"
      };
    case ACTION.HARVEST_CROP: {
      const coins = Number(payload?.coins) || 0;
      const seeds = Number(payload?.seeds) || 0;
      const produce = Number(payload?.produce) || 0;
      return {
        text: `收获 ${cropLabel(payload?.cropType)} ×1 · +${coins} 金币${
          seeds ? ` · +${seeds} 颗种子` : ""
        }${produce ? ` · +${produce} 份食材` : ""} · 累计 ${
          state.stats?.harvested ?? 0
        } 株。`,
        tone: "harvest"
      };
    }
    case ACTION.UNLOCK_PLOT:
      return { text: "这块地开垦好了，可以播种了。", tone: "farm" };
    case ACTION.BUY_SEED:
      return {
        text: `买了 ${payload?.count ?? 1} 颗${cropLabel(
          payload?.cropType
        )}种子。`,
        tone: "farm"
      };
    case ACTION.BUY_GREENHOUSE:
      return {
        text: "温室搭好了：收成多卖 25%，而且必定回收一颗种子。",
        tone: "harvest"
      };
    case ACTION.CLAIM_GIFT:
      return {
        text: `领到今日补给：${ECONOMY.giftCoins} 金币 + ${ECONOMY.giftSeeds} 颗种子。`,
        tone: "farm"
      };
    case ACTION.BUY_DECOR:
      return getDecorNotice(payload?.itemId ?? null, false);
    case ACTION.REMOVE_DECOR:
      return getDecorNotice(payload?.itemId ?? null, true);
    default:
      return null;
  }
}

export const FARM_HAZARD = HAZARD;
