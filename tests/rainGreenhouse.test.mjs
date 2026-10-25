import test from "node:test";
import assert from "node:assert/strict";
import { ACTION, CROPS, PLAYER_ID, SCENE, plotSceneFor } from "../src/config.js";
import { createEmptyPlots, getCropStage, hasUnwateredRainCrops, seasonGrowthFactor } from "../src/game/crop.js";
import { getWeather } from "../src/game/season.js";
import { createPlayerEntity } from "../src/game/player.js";
import { applyFarmAction, validateFarmAction } from "../src/game/farmRules.js";
import { createInitialState } from "../src/game/initialState.js";
import { reducer } from "../src/game/reducer.js";

function makeState({ world = { greenhouse: false }, plots = createEmptyPlots() } = {}) {
  const player = createPlayerEntity({
    id: PLAYER_ID,
    name: "A",
    currentScene: SCENE.OUTDOOR,
    position: { x: -1.35, y: -0.15 },
    facing: "south"
  });
  return {
    schemaVersion: 3,
    activePlayerId: PLAYER_ID,
    players: { [PLAYER_ID]: player },
    plots,
    stats: { harvested: 0, coins: 24, giftDay: "" },
    inventory: { seeds: { radish: 1, carrot: 0, tomato: 0 } },
    world,
    ui: { notice: null, nextNoticeId: 1, selectedPlotId: null }
  };
}

function rainyTimestamp() {
  let at = Date.UTC(2026, 0, 1, 12);
  for (let i = 0; i < 366; i += 1) {
    if (getWeather(at).id === "rain") return at;
    at += 24 * 60 * 60 * 1000;
  }
  throw new Error("no rainy day in test year");
}

function plantedPlots() {
  const plots = createEmptyPlots();
  for (const id of ["field_01", "field_11"]) {
    plots[id] = {
      ...plots[id],
      unlocked: true,
      crop: { type: CROPS.radish.id, plantedAt: 1, wateredAt: null }
    };
  }
  return plots;
}

test("rain waters outdoor crops but not greenhouse beds", () => {
  const rainy = rainyTimestamp();
  const outdoor = makeState({ plots: plantedPlots() });
  assert.equal(
    validateFarmAction(outdoor, PLAYER_ID, ACTION.RAIN_WATER, null, null, rainy).ok,
    true
  );
  const watered = applyFarmAction(
    outdoor,
    PLAYER_ID,
    ACTION.RAIN_WATER,
    null,
    null,
    rainy
  );
  assert.equal(watered.plots.field_01.crop.wateredAt, rainy);
  assert.equal(watered.plots.field_11.crop.wateredAt, rainy);

  const greenhouseState = makeState({
    world: { greenhouse: true, decor: {} },
    plots: plantedPlots()
  });
  assert.equal(hasUnwateredRainCrops(greenhouseState), true);
  const greenhouseRain = applyFarmAction(
    greenhouseState,
    PLAYER_ID,
    ACTION.RAIN_WATER,
    null,
    null,
    rainy
  );
  assert.equal(greenhouseRain.plots.field_01.crop.wateredAt, rainy);
  assert.equal(greenhouseRain.plots.field_11.crop.wateredAt, null);
});

test("rain still waters the field while both players are inside", () => {
  const rainy = rainyTimestamp();
  const state = makeState({ plots: plantedPlots() });
  state.players[PLAYER_ID] = createPlayerEntity({
    id: PLAYER_ID,
    name: "A",
    currentScene: SCENE.INDOOR_1,
    position: { x: 0, y: 0 },
    facing: "south"
  });
  state.weather = { rain: true };
  assert.equal(
    validateFarmAction(state, PLAYER_ID, ACTION.RAIN_WATER, null, null, rainy).ok,
    true
  );
  const watered = applyFarmAction(
    state,
    PLAYER_ID,
    ACTION.RAIN_WATER,
    null,
    null,
    rainy
  );
  assert.equal(watered.plots.field_01.crop.wateredAt, rainy);
  assert.equal(watered.plots.field_11.crop.wateredAt, rainy);
});

test("solo rain keeps the client rain report in the reducer", () => {
  let dry = Date.UTC(2026, 0, 1, 12);
  while (getWeather(dry).id === "rain") dry += 24 * 60 * 60 * 1000;
  const state = createInitialState({});
  state.plots.field_01 = {
    ...state.plots.field_01,
    unlocked: true,
    crop: { type: CROPS.radish.id, plantedAt: 1, wateredAt: null }
  };
  const next = reducer(state, {
    who: PLAYER_ID,
    when: dry,
    action: ACTION.RAIN_WATER,
    targetId: null,
    payload: { reportedRain: true }
  });
  assert.equal(next.plots.field_01.crop.wateredAt, dry);
});

test("rain cannot be applied on a sunny day", () => {
  let at = Date.UTC(2026, 0, 1, 12);
  while (getWeather(at).id === "rain") at += 24 * 60 * 60 * 1000;
  const state = makeState({ plots: plantedPlots() });
  assert.equal(
    validateFarmAction(state, PLAYER_ID, ACTION.RAIN_WATER, null, null, at).code,
    "NOT_RAINING"
  );
});

test("season changes growth speed and greenhouse plots route to their scene", () => {
  const spring = Date.UTC(2026, 2, 15, 12);
  const autumn = Date.UTC(2026, 9, 15, 12);
  assert.equal(CROPS.radish.season, "spring");
  assert.equal(seasonGrowthFactor(CROPS.radish, spring), 0.8);
  assert.equal(seasonGrowthFactor(CROPS.radish, autumn), 1.25);

  const plot = {
    id: "field_01",
    unlocked: true,
    tendedAt: 0,
    crop: { type: "radish", plantedAt: spring, wateredAt: spring }
  };
  assert.equal(getCropStage(plot, spring + CROPS.radish.readyAfterMs * 0.8), "ready");

  assert.equal(plotSceneFor({ greenhouse: false }, "field_11"), SCENE.OUTDOOR);
  assert.equal(plotSceneFor({ greenhouse: true }, "field_11"), SCENE.GREENHOUSE);
  assert.equal(plotSceneFor({ greenhouse: true }, "field_01"), SCENE.OUTDOOR);
});
