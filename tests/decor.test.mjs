import test from "node:test";
import assert from "node:assert/strict";
import { ACTION, DECOR, PLAYER_ID, SCENE } from "../src/config.js";
import {
  applyDecorPurchase,
  validateDecorPurchase
} from "../src/game/decor.js";
import { createInitialState } from "../src/game/initialState.js";
import { createPlayerEntity } from "../src/game/player.js";
import { reducer } from "../src/game/reducer.js";
import {
  cloneWorld,
  countDecor,
  sanitizeWorld
} from "../src/game/world.js";

function makeState(scene = SCENE.INDOOR_2, coins = 60) {
  const base = createInitialState();
  return {
    ...base,
    stats: { ...base.stats, coins },
    players: {
      [PLAYER_ID]: createPlayerEntity({
        id: PLAYER_ID,
        name: "A",
        currentScene: scene,
        position: { x: 0.4, y: 0.6 },
        facing: "north"
      })
    }
  };
}

function event(action, targetId = null, payload = null, when = 1000) {
  return { who: PLAYER_ID, when, action, targetId, payload };
}

test("decor purchases require the second floor, coins and an unowned piece", () => {
  const indoor = makeState();
  assert.equal(
    validateDecorPurchase(indoor, PLAYER_ID, "tv").ok,
    true
  );

  const outdoor = makeState(SCENE.OUTDOOR);
  assert.equal(
    validateDecorPurchase(outdoor, PLAYER_ID, "tv").code,
    "DECOR_INDOOR"
  );

  const poor = makeState(SCENE.INDOOR_2, 0);
  assert.equal(
    validateDecorPurchase(poor, PLAYER_ID, "tv").code,
    "NO_COINS"
  );

  const owned = {
    ...indoor,
    world: { ...indoor.world, decor: { tv: true } }
  };
  assert.equal(
    validateDecorPurchase(owned, PLAYER_ID, "tv").code,
    "DECOR_OWNED"
  );
  assert.equal(
    validateDecorPurchase(indoor, PLAYER_ID, "castle").code,
    "NO_DECOR"
  );
});

test("buying decor deducts coins and marks the world slice", () => {
  const state = makeState(SCENE.INDOOR_2, 60);
  const bought = applyDecorPurchase(state, PLAYER_ID, "tv");
  assert.equal(bought.stats.coins, 20);
  assert.equal(bought.world.decor.tv, true);
  assert.equal(countDecor(bought.world), 1);
  assert.equal(state.stats.coins, 60, "input state is not mutated");
  assert.equal(applyDecorPurchase(bought, PLAYER_ID, "tv"), null);
});

test("reducer opens the catalogue only upstairs and buys through events", () => {
  let state = makeState(SCENE.INDOOR_2, 60);
  state = reducer(state, event(ACTION.OPEN_DECOR));
  assert.equal(state.ui.decorOpen, true);

  state = reducer(state, event(ACTION.BUY_DECOR, "plant"));
  assert.equal(state.world.decor.plant, true);
  assert.equal(state.stats.coins, 60 - DECOR.plant.cost);
  assert.equal(state.ui.notice.tone, "harvest");

  state = reducer(state, event(ACTION.CLOSE_DECOR));
  assert.equal(state.ui.decorOpen, false);

  const outdoor = makeState(SCENE.OUTDOOR, 60);
  const opened = reducer(outdoor, event(ACTION.OPEN_DECOR));
  assert.strictEqual(opened, outdoor);
  assert.strictEqual(
    reducer(outdoor, event(ACTION.BUY_DECOR, "plant")),
    outdoor
  );
});

test("owned decor can be refunded in full on the second floor", () => {
  let state = makeState(SCENE.INDOOR_2, 60);
  state = reducer(state, event(ACTION.BUY_DECOR, "plant"));
  assert.equal(state.stats.coins, 60 - DECOR.plant.cost);
  const refunded = reducer(state, event(ACTION.REMOVE_DECOR, "plant"));
  assert.equal(refunded.world.decor.plant, undefined);
  assert.equal(refunded.stats.coins, 60);
  assert.equal(refunded.ui.notice.text, `退还了${DECOR.plant.label}，${DECOR.plant.cost} 金币已全额返还。`);
  assert.strictEqual(
    reducer(refunded, event(ACTION.REMOVE_DECOR, "plant")),
    refunded
  );
});

test("world cloning keeps decor but drops unknown ids", () => {
  const raw = {
    greenhouse: true,
    decor: { tv: true, plant: true, castle: true, rug: false }
  };
  const clean = sanitizeWorld(raw);
  assert.deepEqual(clean, {
    greenhouse: true,
    decor: { tv: true, plant: true },
    scenes: { meadow: false, dock: false, orchard: false, spring: false },
    forage: {},
    meal: null
  });
  const cloned = cloneWorld(clean);
  cloned.decor.tv = false;
  assert.equal(clean.decor.tv, true);
  assert.equal(countDecor(clean), 2);
});
