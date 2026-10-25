import test from "node:test";
import assert from "node:assert/strict";
import {
  ACTION,
  DINING,
  KITCHEN,
  PLAYER_ID,
  SCENE
} from "../src/config.js";
import { createInitialState } from "../src/game/initialState.js";
import { createPlayerEntity } from "../src/game/player.js";
import { reducer } from "../src/game/reducer.js";
import {
  applyFarmAction,
  validateFarmAction
} from "../src/game/farmRules.js";
import {
  sanitizeDishes,
  sanitizeMeal,
  sanitizeProduce,
  sharedMealPlayers
} from "../src/game/kitchen.js";
import { createEmptyPlots } from "../src/game/crop.js";
import { sanitizeWorld } from "../src/game/world.js";
import { writeFarmSave, readFarmSave } from "../src/persistence/farmSave.js";

const OTHER_ID = "p_other";
const DAY = Date.UTC(2026, 9, 24, 12, 0, 0);

function player(id, name, position, scene = SCENE.INDOOR_1) {
  return createPlayerEntity({
    id,
    name,
    currentScene: scene,
    position,
    facing: "south"
  });
}

function kitchenState({
  position = { x: KITCHEN.stand.x, y: KITCHEN.stand.z },
  withOther = false,
  otherActivity = null
} = {}) {
  const base = createInitialState();
  const self = player(PLAYER_ID, "A", position);
  const players = { [PLAYER_ID]: self };
  if (withOther) {
    players[OTHER_ID] = {
      ...player(OTHER_ID, "B", { x: DINING.stand.x, y: DINING.stand.z }),
      activity: otherActivity
    };
  }
  return {
    ...base,
    players,
    stats: {
      ...base.stats,
      coins: 80,
      cooked: 0,
      meals: 0,
      mealDay: ""
    },
    inventory: {
      ...base.inventory,
      produce: { radish: 4, carrot: 0, tomato: 0 },
      dishes: { radish_soup: 0, honey_carrot: 0, tomato_fish: 0 },
      goods: { ...base.inventory.goods, honey: 1 }
    }
  };
}

function event(action, targetId = null, payload = null, when = DAY) {
  return { who: PLAYER_ID, when, action, targetId, payload };
}

function nearTableState(extra = {}) {
  return {
    ...kitchenState({ position: { x: DINING.stand.x, y: DINING.stand.z } }),
    ...extra
  };
}

test("every harvest leaves one ingredient without changing the coin reward", () => {
  const base = kitchenState({ position: { x: -1.35, y: -0.15 } });
  const state = {
    ...base,
    players: {
      [PLAYER_ID]: player(PLAYER_ID, "A", { x: -1.35, y: -0.15 }, SCENE.OUTDOOR)
    },
    plots: createEmptyPlots(),
    world: { ...base.world, greenhouse: false }
  };
  state.plots.field_01.crop = {
    type: "radish",
    plantedAt: 1000,
    wateredAt: 2000
  };
  const now = 2000 + 12000 * 2;
  state.plots.field_01.tendedAt = now;
  const beforeCoins = state.stats.coins;
  const next = applyFarmAction(
    state,
    PLAYER_ID,
    ACTION.HARVEST_CROP,
    "field_01",
    null,
    now
  );
  assert.equal(next.inventory.produce.radish, 5);
  assert.equal(next.stats.harvested, 1);
  assert.equal(next.stats.coins >= beforeCoins, true);
  assert.equal(next.plots.field_01.crop, null);
});

test("cooking consumes produce and goods and creates a dish", () => {
  const state = kitchenState();
  const check = validateFarmAction(
    state,
    PLAYER_ID,
    ACTION.COOK_DISH,
    null,
    { recipeId: "radish_soup" },
    DAY
  );
  assert.equal(check.ok, true);

  const next = applyFarmAction(
    state,
    PLAYER_ID,
    ACTION.COOK_DISH,
    null,
    { recipeId: "radish_soup" },
    DAY
  );
  assert.equal(next.inventory.produce.radish, 2);
  assert.equal(next.inventory.dishes.radish_soup, 1);
  assert.equal(next.stats.cooked, 1);
  assert.equal(state.inventory.produce.radish, 4, "input is not mutated");
});

test("cooking rejects missing ingredients, unknown recipes and distant players", () => {
  const state = kitchenState();
  const missing = validateFarmAction(
    state,
    PLAYER_ID,
    ACTION.COOK_DISH,
    null,
    { recipeId: "tomato_fish" },
    DAY
  );
  assert.equal(missing.ok, false);
  assert.equal(missing.code, "MISSING_INGREDIENTS");

  const unknown = validateFarmAction(
    state,
    PLAYER_ID,
    ACTION.COOK_DISH,
    null,
    { recipeId: "moon_cake" },
    DAY
  );
  assert.equal(unknown.code, "UNKNOWN_RECIPE");

  const far = {
    ...state,
    players: {
      [PLAYER_ID]: player(PLAYER_ID, "A", { x: -1.35, y: -0.15 })
    }
  };
  assert.equal(
    validateFarmAction(far, PLAYER_ID, ACTION.COOK_DISH, null, { recipeId: "radish_soup" }, DAY)
      .code,
    "TOO_FAR_FROM_KITCHEN"
  );
});

test("selling a dish adds its full value and removes one dish", () => {
  const state = kitchenState();
  state.inventory.dishes.radish_soup = 1;
  const next = applyFarmAction(
    state,
    PLAYER_ID,
    ACTION.SELL_DISH,
    null,
    { dishId: "radish_soup" },
    DAY
  );
  assert.equal(next.inventory.dishes.radish_soup, 0);
  assert.equal(next.stats.coins, state.stats.coins + 16);
});

test("serving a dish leaves it on the shared table for later", () => {
  const state = kitchenState({
    position: { x: DINING.stand.x, y: DINING.stand.z }
  });
  state.inventory.dishes.tomato_fish = 1;
  const next = reducer(
    state,
    event(ACTION.SERVE_MEAL, null, { dishId: "tomato_fish" })
  );
  assert.equal(next.inventory.dishes.tomato_fish, 0);
  assert.deepEqual(next.world.meal, {
    dishId: "tomato_fish",
    byId: PLAYER_ID,
    byName: "A",
    at: DAY
  });
  assert.match(next.ui.notice.text, /留在了餐桌/);
});

test("the table seats two people and both can sit before eating", () => {
  const meal = {
    dishId: "radish_soup",
    byId: "p_someone",
    byName: "B",
    at: DAY - 1000
  };
  let state = {
    ...nearTableState(),
    world: { ...nearTableState().world, meal }
  };
  state = reducer(state, event(ACTION.SIT_MEAL, "dining"));
  assert.deepEqual(state.players[PLAYER_ID].activity, {
    kind: "meal",
    slot: 0,
    since: DAY
  });
  assert.deepEqual(state.players[PLAYER_ID].position, {
    x: DINING.seats[0].x,
    y: DINING.seats[0].z
  });

  state = reducer(state, event(ACTION.SIT_MEAL, "dining"));
  assert.equal(state.players[PLAYER_ID].activity, null);
  assert.deepEqual(state.players[PLAYER_ID].position, {
    x: DINING.stand.x,
    y: DINING.stand.z
  });
});

test("a shared meal pays the daily bonus only once", () => {
  const meal = {
    dishId: "tomato_fish",
    byId: OTHER_ID,
    byName: "B",
    at: DAY - 1000
  };
  let state = nearTableState({
    withOther: true,
    otherActivity: { kind: "meal", slot: 0, since: DAY - 2000 },
    world: { ...nearTableState().world, meal }
  });
  // Put the other player on the opposite seat.
  state.players[OTHER_ID] = {
    ...player(OTHER_ID, "B", {
      x: DINING.seats[1].x,
      y: DINING.seats[1].z
    }),
    activity: { kind: "meal", slot: 1, since: DAY - 2000 }
  };
  state = reducer(state, event(ACTION.SIT_MEAL, "dining"));
  // The first free seat is 0, but the other player is already there in this
  // test; the reducer should take the free slot instead.
  assert.equal(state.players[PLAYER_ID].activity.slot, 0);
  assert.equal(sharedMealPlayers(state).length, 2);

  const coins = state.stats.coins;
  const eaten = reducer(state, event(ACTION.EAT_MEAL, "dining"));
  assert.equal(eaten.world.meal, null);
  assert.equal(eaten.stats.meals, 1);
  assert.equal(eaten.stats.coins, coins + 12);
  assert.equal(eaten.stats.mealDay, "2026-10-24");
  assert.match(eaten.ui.notice.text, /两个人一起吃了/);

  // A second shared meal the same day is still eaten, but pays no coins.
  const second = reducer(
    {
      ...eaten,
      world: {
        ...eaten.world,
        meal: { ...meal, at: DAY + 1000 }
      }
    },
    event(ACTION.EAT_MEAL, "dining", null, DAY + 2000)
  );
  assert.equal(second.stats.coins, eaten.stats.coins + 0);
  assert.equal(second.stats.meals, 2);
});

test("eating a leftover dish alone has no daily coin bonus", () => {
  const state = nearTableState({
    world: {
      ...nearTableState().world,
      meal: {
        dishId: "radish_soup",
        byId: OTHER_ID,
        byName: "B",
        at: DAY - 1000
      }
    }
  });
  const coins = state.stats.coins;
  const next = reducer(state, event(ACTION.EAT_MEAL, "dining"));
  assert.equal(next.world.meal, null);
  assert.equal(next.stats.coins, coins);
  assert.equal(next.stats.meals, 0);
  assert.match(next.ui.notice.text, /B留/);
});

test("world and pantry sanitizers reject unknown dishes and clamp counts", () => {
  assert.deepEqual(sanitizeProduce({ radish: "2.9", carrot: -3, tomato: 1 }), {
    radish: 2,
    carrot: 0,
    tomato: 1
  });
  assert.deepEqual(sanitizeDishes({ radish_soup: 2, moon_cake: 9 }), {
    radish_soup: 2,
    honey_carrot: 0,
    tomato_fish: 0
  });
  assert.equal(sanitizeMeal({ dishId: "moon_cake", at: 1 }), null);
  assert.deepEqual(
    sanitizeWorld({
      meal: { dishId: "radish_soup", byId: "p1", byName: "B", at: 5 }
    }).meal,
    { dishId: "radish_soup", byId: "p1", byName: "B", at: 5 }
  );
});

test("the local save round-trips produce, dishes and a waiting meal", () => {
  const storage = new Map();
  const target = {
    getItem: (key) => (storage.has(key) ? storage.get(key) : null),
    setItem: (key, value) => storage.set(key, String(value)),
    removeItem: (key) => storage.delete(key)
  };
  const state = kitchenState();
  state.inventory.produce.carrot = 2;
  state.inventory.dishes.honey_carrot = 1;
  state.stats.cooked = 1;
  state.stats.meals = 2;
  state.stats.mealDay = "2026-10-24";
  state.world = {
    ...state.world,
    meal: {
      dishId: "honey_carrot",
      byId: PLAYER_ID,
      byName: "A",
      at: DAY
    }
  };
  writeFarmSave(state, target);
  const restored = readFarmSave(target);
  assert.equal(restored.inventory.produce.radish, 4);
  assert.equal(restored.inventory.produce.carrot, 2);
  assert.equal(restored.inventory.dishes.honey_carrot, 1);
  assert.equal(restored.stats.cooked, 1);
  assert.equal(restored.stats.meals, 2);
  assert.equal(restored.stats.mealDay, "2026-10-24");
  assert.deepEqual(restored.world.meal, state.world.meal);
});

test("old saves without kitchen fields still load", () => {
  const storage = new Map();
  const target = {
    getItem: (key) => (storage.has(key) ? storage.get(key) : null),
    setItem: (key, value) => storage.set(key, String(value))
  };
  target.setItem(
    "duet.farm.v3",
    JSON.stringify({
      version: 3,
      plots: {},
      stats: { harvested: 2, coins: 40 },
      inventory: { seeds: { radish: 1 } },
      world: { greenhouse: true },
      board: { messages: [], lastReadAt: 0 }
    })
  );
  const restored = readFarmSave(target);
  assert.equal(restored.stats.cooked, 0);
  assert.equal(restored.inventory.produce.radish, 0);
  assert.equal(restored.inventory.dishes.radish_soup, 0);
  assert.equal(restored.world.meal, null);
});

