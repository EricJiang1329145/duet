import test from "node:test";
import assert from "node:assert/strict";
import {
  ACTION,
  KITCHEN,
  PLAYER_ID,
  SCENE
} from "../src/config.js";
import { createInitialState } from "../src/game/initialState.js";
import { createPlayerEntity } from "../src/game/player.js";
import { validateSceneAction } from "../src/game/sceneRules.js";
import {
  sanitizeMeal,
  validateKitchenAction
} from "../src/game/kitchen.js";

const INHERITED = ["__proto__", "constructor", "toString"];

function indoorState() {
  const state = createInitialState({});
  state.players[PLAYER_ID] = createPlayerEntity({
    id: PLAYER_ID,
    name: "A",
    currentScene: SCENE.INDOOR_1,
    position: { x: KITCHEN.center.x, y: KITCHEN.center.z },
    facing: "south"
  });
  return state;
}

test("scene actions reject inherited object keys", () => {
  const state = indoorState();
  for (const key of INHERITED) {
    assert.equal(
      validateSceneAction(
        state,
        PLAYER_ID,
        ACTION.UNLOCK_SCENE,
        key,
        null,
        Date.now()
      ).code,
      "UNKNOWN_SCENE"
    );
    assert.equal(
      validateSceneAction(
        state,
        PLAYER_ID,
        ACTION.SELL_GOODS,
        key,
        { count: 1 },
        Date.now()
      ).code,
      "UNKNOWN_GOOD"
    );
  }
});

test("kitchen actions and meal sanitizer reject inherited keys", () => {
  const state = indoorState();
  for (const key of INHERITED) {
    assert.equal(
      validateKitchenAction(
        state,
        PLAYER_ID,
        ACTION.COOK_DISH,
        null,
        { recipeId: key },
        Date.now()
      ).code,
      "UNKNOWN_RECIPE"
    );
    assert.equal(
      validateKitchenAction(
        state,
        PLAYER_ID,
        ACTION.SELL_DISH,
        key,
        null,
        Date.now()
      ).code,
      "UNKNOWN_DISH"
    );
    assert.equal(
      sanitizeMeal({
        dishId: key,
        byId: "p1",
        byName: "A",
        at: Date.now()
      }),
      null
    );
  }
});
