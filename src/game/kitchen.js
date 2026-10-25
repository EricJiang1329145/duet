import {
  ACTION,
  CROPS,
  CROP_IDS,
  DINING,
  DISHES,
  DISH_IDS,
  GOODS,
  KITCHEN,
  KITCHEN_ECONOMY,
  RECIPES,
  SCENE
} from "../config.js";
import { getDayKey } from "./season.js";

const KITCHEN_ACTIONS = new Set([
  ACTION.COOK_DISH,
  ACTION.SELL_DISH,
  ACTION.SERVE_MEAL,
  ACTION.EAT_MEAL
]);

export function isKitchenAction(action) {
  return KITCHEN_ACTIONS.has(action);
}

function normalizeCount(value) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0
    ? Math.min(9999, Math.floor(number))
    : 0;
}

export function emptyProduce() {
  const produce = {};
  for (const cropId of CROP_IDS) produce[cropId] = 0;
  return produce;
}

export function sanitizeProduce(raw) {
  const produce = {};
  for (const cropId of CROP_IDS) produce[cropId] = normalizeCount(raw?.[cropId]);
  return produce;
}

export function emptyDishes() {
  const dishes = {};
  for (const dishId of DISH_IDS) dishes[dishId] = 0;
  return dishes;
}

export function sanitizeDishes(raw) {
  const dishes = {};
  for (const dishId of DISH_IDS) dishes[dishId] = normalizeCount(raw?.[dishId]);
  return dishes;
}

export function produceCount(state, cropId) {
  return normalizeCount(state?.inventory?.produce?.[cropId]);
}

export function dishCount(state, dishId) {
  return normalizeCount(state?.inventory?.dishes?.[dishId]);
}

export function totalProduce(state) {
  return CROP_IDS.reduce((sum, id) => sum + produceCount(state, id), 0);
}

export function totalDishes(state) {
  return DISH_IDS.reduce((sum, id) => sum + dishCount(state, id), 0);
}

export function distanceTo(player, point) {
  if (!player?.position || !point) return Infinity;
  return Math.hypot(player.position.x - point.x, player.position.y - point.z);
}

export function nearKitchen(player) {
  return player?.currentScene === SCENE.INDOOR_1
    ? distanceTo(player, KITCHEN.center) <= KITCHEN.radius
    : false;
}

export function nearDining(player) {
  return player?.currentScene === SCENE.INDOOR_1
    ? distanceTo(player, DINING.center) <= DINING.radius
    : false;
}

export function recipeMissing(state, recipe) {
  const produce = [];
  const goods = [];
  for (const [cropId, need] of Object.entries(recipe?.produce ?? {})) {
    const have = produceCount(state, cropId);
    if (have < need) produce.push({ id: cropId, need, have });
  }
  for (const [goodId, need] of Object.entries(recipe?.goods ?? {})) {
    const have = normalizeCount(state?.inventory?.goods?.[goodId]);
    if (have < need) goods.push({ id: goodId, need, have });
  }
  return { produce, goods, ok: produce.length === 0 && goods.length === 0 };
}

export function canCookRecipe(state, recipeId) {
  const recipe = Object.hasOwn(RECIPES, recipeId) ? RECIPES[recipeId] : null;
  if (!recipe) return false;
  return recipeMissing(state, recipe).ok;
}

/**
 * A meal is shared when both seats are occupied by players in the first
 * floor. The daily coin reward is only paid once, so eating together stays a
 * ritual instead of a loop to farm.
 */
export function sharedMealPlayers(state) {
  const seated = Object.values(state?.players ?? {}).filter(
    (player) =>
      player?.currentScene === SCENE.INDOOR_1 &&
      player.activity?.kind === "meal"
  );
  const slots = new Set(seated.map((player) => player.activity.slot));
  return slots.size >= 2 ? seated : [];
}

export function isSharedMeal(state, playerId) {
  return sharedMealPlayers(state).some((player) => player.id === playerId);
}

export function sanitizeMeal(raw) {
  const dish = Object.hasOwn(DISHES, raw?.dishId) ? DISHES[raw.dishId] : null;
  if (!dish) return null;
  const at = Number(raw?.at);
  if (!Number.isFinite(at) || at <= 0) return null;
  const byId =
    typeof raw?.byId === "string" ? raw.byId.trim().slice(0, 64) : "";
  const byName =
    typeof raw?.byName === "string" ? raw.byName.trim().slice(0, 12) : "";
  return {
    dishId: dish.id,
    byId,
    byName: byName || "对方",
    at
  };
}

export function mealDish(meal) {
  return meal && Object.hasOwn(DISHES, meal.dishId)
    ? DISHES[meal.dishId]
    : null;
}

export function mealLabel(meal) {
  const dish = mealDish(meal);
  if (!dish) return "";
  return `${meal.byName || "对方"}留的${dish.short}`;
}

function withInventory(state, patch) {
  return {
    ...state,
    inventory: { ...state.inventory, ...patch }
  };
}

function withCoins(state, coins) {
  return {
    ...state,
    stats: {
      ...state.stats,
      coins: Math.max(0, Math.floor(Number(coins) || 0))
    }
  };
}

function withMeal(state, meal) {
  return { ...state, world: { ...state.world, meal } };
}

export function validateKitchenAction(
  state,
  playerId,
  action,
  targetId,
  payload = null,
  now = Date.now()
) {
  const player = state?.players?.[playerId];
  if (!player) return { ok: false, code: "NO_PLAYER" };
  if (player.currentScene !== SCENE.INDOOR_1) {
    return { ok: false, code: "NOT_KITCHEN_SCENE" };
  }

  if (action === ACTION.COOK_DISH || action === ACTION.SELL_DISH) {
    if (!nearKitchen(player)) return { ok: false, code: "TOO_FAR_FROM_KITCHEN" };
  }
  // Serving is a narrative "carry the dish over" action from the stove panel;
  // only sitting/eating needs the player to be beside the table.
  if (action === ACTION.EAT_MEAL) {
    if (!nearDining(player)) return { ok: false, code: "TOO_FAR_FROM_TABLE" };
  }

  if (action === ACTION.COOK_DISH) {
    const recipe = Object.hasOwn(RECIPES, payload?.recipeId)
      ? RECIPES[payload.recipeId]
      : null;
    if (!recipe) return { ok: false, code: "UNKNOWN_RECIPE" };
    const missing = recipeMissing(state, recipe);
    if (!missing.ok) {
      return { ok: false, code: "MISSING_INGREDIENTS", recipe, missing };
    }
    return { ok: true, recipe, dish: DISHES[recipe.dishId] };
  }

  if (action === ACTION.SELL_DISH) {
    const dishId = payload?.dishId ?? targetId;
    const dish = Object.hasOwn(DISHES, dishId) ? DISHES[dishId] : null;
    if (!dish) return { ok: false, code: "UNKNOWN_DISH" };
    if (dishCount(state, dish.id) < 1) {
      return { ok: false, code: "NO_DISH" };
    }
    return { ok: true, dish };
  }

  if (action === ACTION.SERVE_MEAL) {
    const dishId = payload?.dishId ?? targetId;
    const dish = Object.hasOwn(DISHES, dishId) ? DISHES[dishId] : null;
    if (!dish) return { ok: false, code: "UNKNOWN_DISH" };
    if (dishCount(state, dish.id) < 1) {
      return { ok: false, code: "NO_DISH" };
    }
    if (state.world?.meal) return { ok: false, code: "MEAL_EXISTS" };
    return { ok: true, dish };
  }

  const meal = state.world?.meal;
  const dish = mealDish(meal);
  if (!meal || !dish) return { ok: false, code: "NO_MEAL" };
  const shared = isSharedMeal(state, playerId);
  const day = getDayKey(Number.isFinite(now) ? now : Date.now());
  const bonus = shared && state.stats?.mealDay !== day;
  return { ok: true, meal, dish, shared, bonus };
}

export function applyKitchenAction(
  state,
  playerId,
  action,
  targetId,
  payload = null,
  now = Date.now()
) {
  const check = validateKitchenAction(
    state,
    playerId,
    action,
    targetId,
    payload,
    now
  );
  if (!check.ok) return null;

  const at = Number.isFinite(now) ? now : Date.now();
  const player = state.players[playerId];

  if (action === ACTION.COOK_DISH) {
    const { recipe } = check;
    const produce = { ...state.inventory?.produce };
    const goods = { ...state.inventory?.goods };
    const dishes = { ...state.inventory?.dishes };
    for (const [cropId, need] of Object.entries(recipe.produce ?? {})) {
      produce[cropId] = produceCount(state, cropId) - need;
    }
    for (const [goodId, need] of Object.entries(recipe.goods ?? {})) {
      goods[goodId] = normalizeCount(goods[goodId]) - need;
    }
    dishes[recipe.dishId] = dishCount(state, recipe.dishId) + 1;
    const next = withInventory(state, { produce, goods, dishes });
    return {
      ...next,
      stats: {
        ...next.stats,
        cooked: Math.max(0, Math.floor(Number(next.stats?.cooked) || 0)) + 1
      }
    };
  }

  if (action === ACTION.SELL_DISH) {
    const { dish } = check;
    const dishes = { ...state.inventory?.dishes };
    dishes[dish.id] = dishCount(state, dish.id) - 1;
    const sold = withInventory(state, { dishes });
    return withCoins(sold, Math.floor(Number(state.stats?.coins) || 0) + dish.sellPrice);
  }

  if (action === ACTION.SERVE_MEAL) {
    const { dish } = check;
    const dishes = { ...state.inventory?.dishes };
    dishes[dish.id] = dishCount(state, dish.id) - 1;
    const served = withInventory(state, { dishes });
    return withMeal(served, {
      dishId: dish.id,
      byId: player.id,
      byName: player.name,
      at
    });
  }

  // EAT_MEAL
  const eaten = withMeal(state, null);
  return {
    ...eaten,
    stats: {
      ...eaten.stats,
      meals:
        Math.max(0, Math.floor(Number(eaten.stats?.meals) || 0)) +
        (check.shared ? 1 : 0),
      coins:
        Math.floor(Number(eaten.stats?.coins) || 0) +
        (check.bonus ? KITCHEN_ECONOMY.sharedMealCoins : 0),
      mealDay: check.bonus
        ? getDayKey(at)
        : String(eaten.stats?.mealDay ?? "")
    }
  };
}

export function recipeIngredientText(recipe) {
  const parts = [];
  for (const [cropId, need] of Object.entries(recipe.produce ?? {})) {
    parts.push(`${CROPS[cropId]?.short ?? cropId}×${need}`);
  }
  for (const [goodId, need] of Object.entries(recipe.goods ?? {})) {
    parts.push(`${GOODS[goodId]?.short ?? goodId}×${need}`);
  }
  return parts.join(" + ");
}

export function getKitchenNotice(action, state, payload = null, check = null) {
  if (action === ACTION.COOK_DISH) {
    const recipe = check?.recipe ??
      (Object.hasOwn(RECIPES, payload?.recipeId)
        ? RECIPES[payload.recipeId]
        : null);
    const dish = check?.dish ??
      (Object.hasOwn(DISHES, recipe?.dishId) ? DISHES[recipe.dishId] : null);
    if (!recipe || !dish) return null;
    return {
      text: `做好了${dish.label}：${recipeIngredientText(recipe)}。`,
      tone: "harvest"
    };
  }

  if (action === ACTION.SELL_DISH) {
    const dish = check?.dish ??
      (Object.hasOwn(DISHES, payload?.dishId) ? DISHES[payload.dishId] : null);
    if (!dish) return null;
    return {
      text: `卖掉了${dish.label}，+${dish.sellPrice} 金币。`,
      tone: "harvest"
    };
  }

  if (action === ACTION.SERVE_MEAL) {
    const dish = check?.dish ??
      (Object.hasOwn(DISHES, payload?.dishId) ? DISHES[payload.dishId] : null);
    if (!dish) return null;
    return {
      text: `把${dish.label}留在了餐桌上，等对方回来一起吃。`,
      tone: "info"
    };
  }

  if (action === ACTION.EAT_MEAL) {
    const dish = check?.dish;
    if (!dish) return null;
    if (check?.shared) {
      return {
        text: check.bonus
          ? `两个人一起吃了${dish.label}，+${KITCHEN_ECONOMY.sharedMealCoins} 金币。`
          : `两个人一起吃了${dish.label}，桌上暖暖的。`,
        tone: check.bonus ? "harvest" : "info"
      };
    }
    const byName = check?.meal?.byName ?? "";
    const own = check?.meal?.byId && check.meal.byId === payload?.actorId;
    return {
      text: own
        ? `吃掉了一份${dish.label}。`
        : `吃了${byName || "对方"}留的${dish.label}，心里暖暖的。`,
      tone: "info"
    };
  }

  return null;
}

