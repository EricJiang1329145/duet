import {
  ACTION,
  GOODS,
  SCENE_RESOURCES,
  SCENE_UNLOCKS
} from "../config.js";
import { getActivePlayer } from "./player.js";
import { getDayKey } from "./season.js";
import { sanitizeGoods } from "./warehouse.js";
import { cloneWorld } from "./world.js";

const SCENE_ACTIONS = new Set([
  ACTION.UNLOCK_SCENE,
  ACTION.COLLECT_RESOURCE,
  ACTION.SELL_GOODS
]);

const RESOURCE_BY_ID = new Map(
  Object.entries(SCENE_RESOURCES).flatMap(([scene, nodes]) =>
    nodes.map((node) => [node.id, { ...node, scene }])
  )
);

function coinsOf(state) {
  return Math.max(0, Math.floor(Number(state?.stats?.coins) || 0));
}

function withWallet(state, coins) {
  return {
    ...state,
    stats: {
      ...state.stats,
      coins: Number.isFinite(coins) ? Math.max(0, Math.floor(coins)) : 0
    }
  };
}

function togetherBonus(state, playerId, sceneId) {
  return Object.values(state?.players ?? {}).some(
    (other) => other?.id !== playerId && other?.currentScene === sceneId
  )
    ? 1
    : 0;
}

function withGoods(state, goods) {
  return {
    ...state,
    inventory: { ...state.inventory, goods }
  };
}

export function isSceneAction(action) {
  return SCENE_ACTIONS.has(action);
}

export function validateSceneAction(
  state,
  playerId,
  action,
  targetId,
  payload = null,
  now = Date.now()
) {
  const player = state?.players?.[playerId] ?? getActivePlayer(state);
  if (!player) return { ok: false, code: "NO_PLAYER" };

  if (action === ACTION.UNLOCK_SCENE) {
    const unlock = Object.hasOwn(SCENE_UNLOCKS, targetId)
      ? SCENE_UNLOCKS[targetId]
      : null;
    if (
      !unlock ||
      typeof unlock.id !== "string" ||
      !Number.isFinite(unlock.cost) ||
      unlock.cost < 0
    ) {
      return { ok: false, code: "UNKNOWN_SCENE" };
    }
    if (state.world?.scenes?.[unlock.id]) {
      return { ok: false, code: "ALREADY_UNLOCKED" };
    }
    if (coinsOf(state) < unlock.cost) {
      return { ok: false, code: "NO_COINS" };
    }
    return { ok: true, scene: unlock };
  }

  if (action === ACTION.COLLECT_RESOURCE) {
    const node = RESOURCE_BY_ID.get(targetId);
    if (!node) return { ok: false, code: "UNKNOWN_RESOURCE" };
    if (player.currentScene !== node.scene && node.scene) {
      return { ok: false, code: "WRONG_SCENE" };
    }
    const unlock = SCENE_UNLOCKS[node.scene];
    if (!unlock || !state.world?.scenes?.[node.scene]) {
      return { ok: false, code: "SCENE_LOCKED" };
    }
    const day = getDayKey(now);
    if (state.world?.forage?.[node.id]?.[playerId] === day) {
      return { ok: false, code: "ALREADY_COLLECTED" };
    }
    if (!Object.hasOwn(GOODS, node.goods)) {
      return { ok: false, code: "UNKNOWN_GOOD" };
    }
    return {
      ok: true,
      node,
      day,
      togetherBonus: togetherBonus(state, playerId, node.scene)
    };
  }

  if (action === ACTION.SELL_GOODS) {
    const good = Object.hasOwn(GOODS, targetId) ? GOODS[targetId] : null;
    if (!good) return { ok: false, code: "UNKNOWN_GOOD" };
    const count = Math.max(1, Math.floor(Number(payload?.count) || 1));
    const owned = Math.max(
      0,
      Math.floor(Number(state.inventory?.goods?.[targetId]) || 0)
    );
    if (owned < count) return { ok: false, code: "NOT_ENOUGH_GOODS" };
    return { ok: true, good, count };
  }

  return { ok: false, code: "NOT_SCENE_ACTION" };
}

export function applySceneAction(
  state,
  playerId,
  action,
  targetId,
  payload = null,
  now = Date.now()
) {
  const check = validateSceneAction(
    state,
    playerId,
    action,
    targetId,
    payload,
    now
  );
  if (!check.ok) return null;

  if (action === ACTION.UNLOCK_SCENE) {
    const world = cloneWorld(state.world);
    world.scenes[check.scene.id] = true;
    return withWallet({ ...state, world }, coinsOf(state) - check.scene.cost);
  }

  if (action === ACTION.COLLECT_RESOURCE) {
    const goods = sanitizeGoods(state.inventory?.goods);
    goods[check.node.goods] += check.node.amount + (check.togetherBonus ?? 0);
    const world = cloneWorld(state.world);
    world.forage[check.node.id] = {
      ...(world.forage[check.node.id] ?? {}),
      [playerId]: check.day
    };
    return withGoods({ ...state, world }, goods);
  }

  if (action === ACTION.SELL_GOODS) {
    const goods = sanitizeGoods(state.inventory?.goods);
    goods[check.good.id] = Math.max(0, goods[check.good.id] - check.count);
    return withWallet(
      withGoods(state, goods),
      coinsOf(state) + check.good.sellPrice * check.count
    );
  }

  return null;
}

export function getSceneNotice(action, state, payload = null, check = null) {
  if (action === ACTION.UNLOCK_SCENE) {
    const requested = payload?.sceneId ?? payload?.targetId;
    const unlock = Object.hasOwn(SCENE_UNLOCKS, requested)
      ? SCENE_UNLOCKS[requested]
      : check?.scene;
    return {
      text: unlock
        ? `${unlock.title}解锁了，去小院${unlock.entry ?? "入口"}看看吧。`
        : "新场景解锁了。",
      tone: "info"
    };
  }
  if (action === ACTION.COLLECT_RESOURCE) {
    const node = check?.node;
    const good = node ? GOODS[node.goods] : null;
    const amount = node ? node.amount + (check?.togetherBonus ?? 0) : 0;
    return {
      text:
        node && good
          ? `采到${good.label} ×${amount}${
              check?.togetherBonus
                ? "（两个人一起，多采了 1 个）"
                : ""
            }，已经放进仓库。`
          : "采集完成，已经放进仓库。",
      tone: "farm"
    };
  }
  if (action === ACTION.SELL_GOODS) {
    const good = check?.good;
    return {
      text:
        good && check
          ? `卖出${good.label} ×${check.count}，获得 ${good.sellPrice * check.count} 金币。`
          : "卖出完成。",
      tone: "harvest"
    };
  }
  return { text: "完成。", tone: "info" };
}
