import test from "node:test";
import assert from "node:assert/strict";
import {
  ACTION,
  FIELD_GRID,
  INITIAL_UNLOCKED_PLOTS,
  PLOT_IDS,
  PLOT_SCENE,
  SCENE
} from "../src/config.js";
import { createEmptyPlots } from "../src/game/crop.js";
import { createInitialState } from "../src/game/initialState.js";
import { createPlayerEntity } from "../src/game/player.js";
import { reducer } from "../src/game/reducer.js";
import { PLAYER_ID } from "../src/config.js";

function stateAt(scene, position) {
  const base = createInitialState();
  return {
    ...base,
    players: {
      [PLAYER_ID]: createPlayerEntity({
        id: PLAYER_ID,
        name: "A",
        currentScene: scene,
        position,
        facing: "south"
      })
    }
  };
}

function event(action, targetId = null, payload = null, when = 1000) {
  return { who: PLAYER_ID, when, action, targetId, payload };
}

test("the merged farm has twelve plots on one outdoor map", () => {
  assert.equal(PLOT_IDS.length, 12);
  assert.equal(FIELD_GRID.columns, 4);
  assert.equal(FIELD_GRID.rows, 3);
  assert.equal(INITIAL_UNLOCKED_PLOTS.length, 6);
  assert.equal(createEmptyPlots().field_06.unlocked, true);
  assert.equal(createEmptyPlots().field_07.unlocked, false);
  for (const id of PLOT_IDS) {
    assert.equal(PLOT_SCENE[id], SCENE.OUTDOOR);
  }
});

test("villa doors and stairs use the new large-floor approach points", () => {
  let state = stateAt(SCENE.OUTDOOR, { x: 0, y: -1.2 });
  state = reducer(state, event(ACTION.ENTER_HOUSE));
  assert.equal(state.players[PLAYER_ID].currentScene, SCENE.INDOOR_1);
  assert.deepEqual(state.players[PLAYER_ID].position, { x: 0, y: 4.3 });

  state = {
    ...state,
    players: {
      ...state.players,
      [PLAYER_ID]: {
        ...state.players[PLAYER_ID],
        position: { x: 4.8, y: 4.35 }
      }
    }
  };
  state = reducer(state, event(ACTION.GO_UPSTAIRS, null, null, 1100));
  assert.equal(state.players[PLAYER_ID].currentScene, SCENE.INDOOR_2);
  assert.deepEqual(state.players[PLAYER_ID].position, { x: 4.8, y: 2.3 });
});

test("the large map can reach its visible edges without a camera band", async () => {
  const { canPlayerStand } = await import("../src/game/movement.js");
  assert.equal(canPlayerStand(SCENE.OUTDOOR, 11.5, 8.8), true);
  assert.equal(canPlayerStand(SCENE.OUTDOOR, 12.4, 9.7), false);
});

test("all twelve plots survive the local save round trip", async () => {
  const { readFarmSave, writeFarmSave } = await import(
    "../src/persistence/farmSave.js"
  );
  const store = new Map();
  const storage = {
    getItem: (key) => store.get(key) ?? null,
    setItem: (key, value) => store.set(key, value)
  };
  const state = createInitialState();
  writeFarmSave(state, storage);
  const restored = readFarmSave(storage);
  assert.equal(Object.keys(restored.plots).length, 12);
  assert.equal(restored.plots.field_12.unlocked, false);
});
