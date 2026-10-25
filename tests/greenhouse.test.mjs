import test from "node:test";
import assert from "node:assert/strict";
import { ACTION, CROPS, PLAYER_ID, SCENE } from "../src/config.js";
import { createEmptyPlots } from "../src/game/crop.js";
import { createPlayerEntity } from "../src/game/player.js";
import { reducer } from "../src/game/reducer.js";

function makePlayer(overrides = {}) {
  return createPlayerEntity({
    id: PLAYER_ID,
    name: "A",
    currentScene: SCENE.OUTDOOR,
    position: { x: -1.35, y: -0.15 },
    facing: "south",
    ...overrides
  });
}

function makeState(overrides = {}) {
  return {
    schemaVersion: 3,
    activePlayerId: PLAYER_ID,
    players: { [PLAYER_ID]: overrides.player ?? makePlayer() },
    plots: overrides.plots ?? createEmptyPlots(),
    stats: { harvested: 0, coins: 100, giftDay: "" },
    inventory: { seeds: { radish: 3, carrot: 1, tomato: 1 } },
    world: overrides.world ?? { greenhouse: true, decor: {} },
    board: { messages: [], lastReadAt: 0 },
    ui: { notice: null, nextNoticeId: 1, selectedPlotId: null }
  };
}

function event(action, targetId = null, payload = null, when = 1000) {
  return { who: PLAYER_ID, when, action, targetId, payload };
}

test("the greenhouse door enters and exits the greenhouse scene", () => {
  let state = makeState({
    player: makePlayer({ position: { x: 2.075, y: 7.65 } })
  });
  state = reducer(state, event(ACTION.ENTER_GREENHOUSE));
  assert.equal(state.players[PLAYER_ID].currentScene, SCENE.GREENHOUSE);
  assert.deepEqual(state.players[PLAYER_ID].position, { x: 0, y: 1.4 });

  state = reducer(state, event(ACTION.EXIT_GREENHOUSE));
  assert.equal(state.players[PLAYER_ID].currentScene, SCENE.OUTDOOR);
  assert.deepEqual(state.players[PLAYER_ID].position, { x: 2.075, y: 7.65 });
});

test("the two premium beds are farmed from inside the greenhouse", () => {
  const state = makeState({
    player: makePlayer({ currentScene: SCENE.GREENHOUSE, position: { x: 0, y: 1.4 } })
  });
  const greenhouseState = {
    ...state,
    plots: {
      ...state.plots,
      field_11: { ...state.plots.field_11, unlocked: true }
    }
  };
  let next = reducer(
    greenhouseState,
    event(ACTION.FIELD_CLICKED, "field_11")
  );
  assert.equal(next.ui.selectedPlotId, "field_11");
  next = reducer(
    next,
    event(ACTION.PLANT_CROP, "field_11", { cropType: CROPS.radish.id }, 2000)
  );
  assert.equal(next.plots.field_11.crop.type, CROPS.radish.id);
});

test("moved greenhouse beds cannot be selected from the outdoor view", () => {
  const state = makeState({
    player: makePlayer({ currentScene: SCENE.OUTDOOR }),
    world: { greenhouse: true, decor: {} }
  });
  const next = reducer(state, event(ACTION.FIELD_CLICKED, "field_11"));
  assert.equal(next, state);
});
