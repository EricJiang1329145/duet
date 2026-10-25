import { ACTION, DECOR, DECOR_IDS, SCENE } from "../config.js";
import { cloneWorld } from "./world.js";

function coinsOf(state) {
  return Math.max(0, Math.floor(Number(state?.stats?.coins) || 0));
}

export function isDecorItem(itemId) {
  return DECOR_IDS.includes(itemId);
}

export function ownDecor(state, itemId) {
  return Boolean(state?.world?.decor?.[itemId]);
}

export function validateDecorPurchase(state, playerId, itemId) {
  const player = state?.players?.[playerId];
  if (!player) return { ok: false, code: "NO_PLAYER" };
  if (player.currentScene !== SCENE.INDOOR_2) {
    return { ok: false, code: "DECOR_INDOOR" };
  }
  if (!isDecorItem(itemId)) return { ok: false, code: "NO_DECOR" };
  if (ownDecor(state, itemId)) return { ok: false, code: "DECOR_OWNED" };
  if (coinsOf(state) < DECOR[itemId].cost) {
    return { ok: false, code: "NO_COINS" };
  }
  return { ok: true, itemId, cost: DECOR[itemId].cost };
}

export function applyDecorPurchase(state, playerId, itemId) {
  const check = validateDecorPurchase(state, playerId, itemId);
  if (!check.ok) return null;

  const world = cloneWorld(state.world);
  world.decor[itemId] = true;

  return {
    ...state,
    world,
    stats: {
      ...state.stats,
      coins: Math.max(0, coinsOf(state) - check.cost)
    }
  };
}

export function validateDecorRemoval(state, playerId, itemId) {
  const player = state?.players?.[playerId];
  if (!player) return { ok: false, code: "NO_PLAYER" };
  if (player.currentScene !== SCENE.INDOOR_2) {
    return { ok: false, code: "DECOR_INDOOR" };
  }
  if (!isDecorItem(itemId)) return { ok: false, code: "NO_DECOR" };
  if (!ownDecor(state, itemId)) return { ok: false, code: "DECOR_NOT_OWNED" };
  return { ok: true, itemId, cost: DECOR[itemId].cost };
}

/** Decoration is fully refundable while the player is on the second floor. */
export function applyDecorRemoval(state, playerId, itemId) {
  const check = validateDecorRemoval(state, playerId, itemId);
  if (!check.ok) return null;

  const world = cloneWorld(state.world);
  delete world.decor[itemId];

  return {
    ...state,
    world,
    stats: {
      ...state.stats,
      coins: coinsOf(state) + check.cost
    }
  };
}

export function getDecorNotice(itemId, removed = false) {
  const item = DECOR[itemId];
  if (!item) return null;
  return {
    text: removed
      ? `退还了${item.label}，${item.cost} 金币已全额返还。`
      : `添置了${item.label}，二层慢慢有了家的样子。`,
    tone: removed ? "info" : "harvest"
  };
}

export function isDecorAction(action) {
  return action === ACTION.BUY_DECOR || action === ACTION.REMOVE_DECOR;
}
