import test from "node:test";
import assert from "node:assert/strict";
import {
  ACTION,
  CROPS,
  PLAYER_ID,
  SCENE
} from "../src/config.js";
import {
  createEmptyPlots,
  getCropStage,
  getPlotHazard,
  seasonGrowthFactor
} from "../src/game/crop.js";
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
  const player = overrides.player ?? makePlayer();
  return {
    schemaVersion: 3,
    activePlayerId: PLAYER_ID,
    players: { [PLAYER_ID]: player },
    plots: overrides.plots ?? createEmptyPlots(),
    stats: overrides.stats ?? { harvested: 0, coins: 24, giftDay: "" },
    inventory: overrides.inventory ?? {
      seeds: { radish: 3, carrot: 1, tomato: 0 }
    },
    world: overrides.world ?? { greenhouse: false },
    board: overrides.board ?? { messages: [], lastReadAt: 0 },
    ui: {
      notice: null,
      nextNoticeId: 1,
      emptyRoomSeen: false,
      selectedPlotId: null,
      boardOpen: false,
      pendingScene: null,
      pendingSeat: null,
      ...overrides.ui
    }
  };
}

function event(action, targetId = null, payload = null, when = 1000) {
  return { who: PLAYER_ID, when, action, targetId, payload };
}

function walkUntilArrived(state, limit = 240) {
  let next = state;
  for (let i = 0; i < limit; i += 1) {
    if (!next.players[PLAYER_ID].destination && !next.ui.pendingScene) return next;
    next = reducer(next, event(ACTION.MOVE_TICK, null, { delta: 0.05 }, 1200));
    if (next.ui.pendingScene === null && next.players[PLAYER_ID].currentScene !== state.players[PLAYER_ID].currentScene) {
      return next;
    }
  }
  return next;
}

test("player keeps the required fields and a non-enumerable remote hook", () => {
  const player = makePlayer();
  for (const key of ["id", "name", "currentScene", "position", "facing"]) {
    assert.ok(key in player, `missing ${key}`);
  }

  assert.equal(player.setRemoteTarget(1, 2), undefined);
  assert.equal(
    Object.prototype.propertyIsEnumerable.call(player, "setRemoteTarget"),
    false
  );
  assert.deepEqual(JSON.parse(JSON.stringify(player)), {
    id: PLAYER_ID,
    name: "A",
    currentScene: SCENE.OUTDOOR,
    position: { x: -1.35, y: -0.15 },
    facing: "south",
    destination: null,
    path: [],
    pathIndex: 0,
    activity: null
  });
});

test("farming loop plants with a seed, waters, grows and harvests", () => {
  let state = makeState();

  state = reducer(state, event(ACTION.FIELD_CLICKED, "field_01"));
  assert.equal(state.ui.selectedPlotId, "field_01");

  state = reducer(state, event(ACTION.PLANT_CROP, "field_01", null, 10_000));
  assert.equal(state.plots.field_01.crop.type, CROPS.radish.id);
  assert.equal(state.plots.field_01.crop.plantedAt, 10_000);
  assert.equal(state.plots.field_01.crop.wateredAt, null);
  assert.equal(state.inventory.seeds.radish, 2);
  assert.equal(getCropStage(state.plots.field_01, 12_000), "seeded");

  state = reducer(state, event(ACTION.WATER_CROP, "field_01", null, 12_000));
  assert.equal(state.plots.field_01.crop.wateredAt, 12_000);
  const radishFactor = seasonGrowthFactor(CROPS.radish, 12_000);
  assert.equal(
    getCropStage(
      state.plots.field_01,
      12_000 + CROPS.radish.leafyAfterMs * radishFactor
    ),
    "growing"
  );
  assert.equal(
    getCropStage(
      state.plots.field_01,
      12_000 + CROPS.radish.readyAfterMs * radishFactor
    ),
    "ready"
  );

  const harvestAt = 12_000 + CROPS.radish.readyAfterMs * radishFactor;
  const hazard = getPlotHazard(state.plots.field_01, harvestAt);
  if (hazard) {
    state = reducer(state, event(ACTION.CLEAR_HAZARD, "field_01", null, harvestAt));
  }

  const coinsBefore = state.stats.coins;
  state = reducer(state, event(ACTION.HARVEST_CROP, "field_01", null, harvestAt));
  assert.equal(state.plots.field_01.crop, null);
  assert.equal(state.stats.harvested, 1);
  assert.equal(state.stats.coins, coinsBefore + CROPS.radish.sellPrice);
  assert.equal(state.ui.notice.tone, "harvest");
});

test("planting requires an unlocked plot and an available seed", () => {
  let state = makeState();
  state = reducer(state, event(ACTION.FIELD_CLICKED, "field_07"));
  const locked = reducer(state, event(ACTION.PLANT_CROP, "field_07", null, 1000));
  assert.strictEqual(locked, state, "locked plot cannot be planted");

  const noSeeds = makeState({
    inventory: { seeds: { radish: 0, carrot: 0, tomato: 0 } }
  });
  let selected = reducer(noSeeds, event(ACTION.FIELD_CLICKED, "field_01"));
  assert.strictEqual(
    reducer(selected, event(ACTION.PLANT_CROP, "field_01", null, 1000)),
    selected,
    "cannot plant without seeds"
  );
});

test("invalid farm actions are no-ops", () => {
  const state = makeState();

  assert.strictEqual(
    reducer(state, event(ACTION.WATER_CROP, "field_01")),
    state,
    "cannot water an empty plot"
  );

  let planted = reducer(state, event(ACTION.FIELD_CLICKED, "field_01"));
  planted = reducer(planted, event(ACTION.PLANT_CROP, "field_01", null, 2000));
  assert.strictEqual(
    reducer(planted, event(ACTION.HARVEST_CROP, "field_01", null, 3000)),
    planted,
    "cannot harvest before maturity"
  );
  assert.strictEqual(
    reducer(planted, event(ACTION.WATER_CROP, "field_02", null, 3000)),
    planted,
    "cannot act on a plot that is not selected"
  );
});

test("door and stairs walk to the approach point before changing scene", () => {
  let state = makeState();
  state = reducer(state, event(ACTION.ENTER_HOUSE));
  assert.equal(state.players[PLAYER_ID].currentScene, SCENE.OUTDOOR);
  assert.equal(state.ui.pendingScene.kind, "enter");
  assert.ok(state.players[PLAYER_ID].destination);

  state = walkUntilArrived(state);
  assert.equal(state.players[PLAYER_ID].currentScene, SCENE.INDOOR_1);
  assert.equal(state.ui.pendingScene, null);
  assert.equal(state.ui.selectedPlotId, null);

  state = reducer(state, event(ACTION.GO_UPSTAIRS));
  assert.equal(state.ui.pendingScene?.kind, "upstairs");
  state = walkUntilArrived(state);
  assert.equal(state.players[PLAYER_ID].currentScene, SCENE.INDOOR_2);

  state = reducer(state, event(ACTION.GO_DOWNSTAIRS));
  assert.equal(state.players[PLAYER_ID].currentScene, SCENE.INDOOR_1);

  state = reducer(state, event(ACTION.EXIT_HOUSE));
  assert.equal(state.ui.pendingScene?.kind, "exit");
  state = walkUntilArrived(state);
  assert.equal(state.players[PLAYER_ID].currentScene, SCENE.OUTDOOR);
});

test("walking away cancels a pending scene change", () => {
  let state = makeState();
  state = reducer(state, event(ACTION.ENTER_HOUSE));
  assert.equal(state.ui.pendingScene.kind, "enter");

  state = reducer(
    state,
    event(ACTION.WALK_TO, null, { x: -1.5, y: 1.5 }, 1000)
  );
  assert.equal(state.ui.pendingScene, null);
  state = walkUntilArrived(state);
  assert.equal(state.players[PLAYER_ID].currentScene, SCENE.OUTDOOR);
});

test("unlocking a plot, buying seeds and claiming the daily gift spend coins", () => {
  let state = makeState({ stats: { harvested: 0, coins: 100, giftDay: "" } });

  state = reducer(state, event(ACTION.FIELD_CLICKED, "field_07"));
  state = reducer(state, event(ACTION.UNLOCK_PLOT, "field_07", null, 1000));
  assert.equal(state.plots.field_07.unlocked, true);
  assert.equal(state.stats.coins, 75);

  state = reducer(
    state,
    event(ACTION.BUY_SEED, null, { cropType: "radish", count: 2 }, 1000)
  );
  assert.equal(state.inventory.seeds.radish, 5);
  assert.equal(state.stats.coins, 71);

  state = reducer(state, event(ACTION.CLAIM_GIFT, null, null, 1000));
  assert.equal(state.inventory.seeds.radish, 7);
  assert.equal(state.stats.coins, 77);
  assert.ok(state.stats.giftDay);

  assert.strictEqual(
    reducer(state, event(ACTION.CLAIM_GIFT, null, null, 2000)),
    state,
    "the gift is once per day"
  );
});

test("the greenhouse raises the harvest value and guarantees a seed", () => {
  let state = makeState({
    stats: { harvested: 0, coins: 300, giftDay: "" },
    inventory: { seeds: { radish: 1, carrot: 0, tomato: 0 } }
  });

  state = reducer(state, event(ACTION.BUY_GREENHOUSE, null, null, 1000));
  assert.equal(state.world.greenhouse, true);
  assert.equal(state.stats.coins, 220);

  state = {
    ...state,
    players: {
      [PLAYER_ID]: makePlayer({
        currentScene: SCENE.GREENHOUSE,
        position: { x: 0, y: 1.4 }
      })
    }
  };
  state = reducer(state, event(ACTION.FIELD_CLICKED, "field_11"));
  state = reducer(state, event(ACTION.UNLOCK_PLOT, "field_11", null, 1500));
  assert.equal(state.stats.coins, 140);
  state = reducer(state, event(ACTION.PLANT_CROP, "field_11", null, 2000));
  state = reducer(state, event(ACTION.WATER_CROP, "field_11", null, 3000));

  const harvestAt =
    3000 + CROPS.radish.readyAfterMs * seasonGrowthFactor(CROPS.radish, 3000);
  if (getPlotHazard(state.plots.field_11, harvestAt)) {
    state = reducer(state, event(ACTION.CLEAR_HAZARD, "field_11", null, harvestAt));
  }
  state = reducer(state, event(ACTION.HARVEST_CROP, "field_11", null, harvestAt));
  assert.equal(state.inventory.seeds.radish, 1, "greenhouse returns one seed");
  assert.equal(
    state.stats.coins,
    140 + Math.round(CROPS.radish.sellPrice * 1.25)
  );
});

test("weeds or pests block harvest until cleared", () => {
  const plots = createEmptyPlots();
  plots.field_01 = {
    id: "field_01",
    unlocked: true,
    tendedAt: 0,
    crop: { type: "radish", plantedAt: 1000, wateredAt: 2000 }
  };
  const now =
    2000 +
    CROPS.radish.readyAfterMs * seasonGrowthFactor(CROPS.radish, 2000);
  const hazard = getPlotHazard(plots.field_01, now);
  assert.ok(hazard, "this seed is deterministic and should sprout a hazard");

  let state = makeState({ plots });
  state = reducer(state, event(ACTION.FIELD_CLICKED, "field_01"));
  assert.strictEqual(
    reducer(state, event(ACTION.HARVEST_CROP, "field_01", null, now)),
    state,
    "harvest is blocked while a hazard is active"
  );

  const cleared = reducer(state, event(ACTION.CLEAR_HAZARD, "field_01", null, now));
  assert.equal(getPlotHazard(cleared.plots.field_01, now), null);
  const harvested = reducer(
    cleared,
    event(ACTION.HARVEST_CROP, "field_01", null, now)
  );
  assert.equal(harvested.plots.field_01.crop, null);
});

test("walking into the second-floor empty zone emits the placeholder notice once", () => {
  let state = makeState({
    player: makePlayer({
      currentScene: SCENE.INDOOR_2,
      position: { x: 0.2, y: 5.0 }
    })
  });
  state = reducer(state, event(ACTION.WALK_TO, null, { x: 0.2, y: 0.4 }));

  for (let i = 0; i < 120 && !state.ui.emptyRoomSeen; i += 1) {
    state = reducer(state, event(ACTION.MOVE_TICK, null, { delta: 0.05 }));
  }

  assert.equal(state.players[PLAYER_ID].currentScene, SCENE.INDOOR_2);
  assert.equal(state.ui.emptyRoomSeen, true);
  assert.equal(state.ui.notice.text, "还没装修");
  assert.equal(state.ui.notice.tone, "empty");
});

test("the selected plot can be closed without changing the crop", () => {
  let state = makeState();
  state = reducer(state, event(ACTION.FIELD_CLICKED, "field_04"));
  state = reducer(state, event(ACTION.PLANT_CROP, "field_04", null, 5000));
  const crop = state.plots.field_04.crop;

  state = reducer(state, event(ACTION.CLOSE_PLOT_PANEL));
  assert.equal(state.ui.selectedPlotId, null);
  assert.deepEqual(state.plots.field_04.crop, crop);
});

test("notice clearing is id-guarded", () => {
  let state = makeState({
    player: makePlayer({ currentScene: SCENE.INDOOR_1 }),
    ui: { notice: { id: 1, text: "留言板有 1 条新留言", tone: "board" } }
  });

  assert.equal(state.ui.notice.id, 1);
  assert.equal(state.ui.notice.tone, "board");

  const withWrongId = reducer(
    state,
    event(ACTION.CLEAR_NOTICE, null, { noticeId: 999 })
  );
  assert.strictEqual(withWrongId, state);

  state = reducer(state, event(ACTION.CLEAR_NOTICE, null, { noticeId: 1 }));
  assert.equal(state.ui.notice, null);
});

test("farm save round-trips wallet, seeds, unlocks and hazards through storage", async () => {
  const { FARM_SAVE_KEY } = await import("../src/config.js");
  const { readFarmSave, writeFarmSave } = await import(
    "../src/persistence/farmSave.js"
  );
  const store = new Map();
  const storage = {
    getItem: (key) => store.get(key) ?? null,
    setItem: (key, value) => store.set(key, value)
  };

  let state = makeState({
    stats: { harvested: 3, coins: 41, giftDay: "2026-10-23" }
  });
  state = reducer(state, event(ACTION.FIELD_CLICKED, "field_07"));
  state = reducer(state, event(ACTION.UNLOCK_PLOT, "field_07", null, 4000));
  state = reducer(
    state,
    event(ACTION.PLANT_CROP, "field_07", null, 5000)
  );
  state = reducer(state, event(ACTION.WATER_CROP, "field_07", null, 6000));
  state = reducer(state, event(ACTION.CLEAR_HAZARD, "field_07", null, 20_000));

  writeFarmSave(state, storage);
  assert.ok(store.has(FARM_SAVE_KEY));

  const restored = readFarmSave(storage);
  assert.equal(restored.stats.harvested, 3);
  assert.equal(restored.stats.coins, 16);
  assert.equal(restored.plots.field_07.unlocked, true);
  assert.equal(restored.plots.field_07.crop.type, "radish");
  assert.equal(restored.plots.field_07.crop.plantedAt, 5000);
  assert.equal(restored.plots.field_07.crop.wateredAt, 6000);
  assert.equal(restored.plots.field_07.tendedAt, 20_000);
  assert.equal(restored.plots.field_01.crop, null);
  assert.equal(restored.inventory.seeds.radish, 2);

  store.set(FARM_SAVE_KEY, "{broken");
  assert.equal(readFarmSave(storage), null);
});

test("a v2 save is migrated with all plots unlocked and starter supplies", async () => {
  const { LEGACY_FARM_SAVE_KEY } = await import("../src/config.js");
  const { readFarmSave } = await import("../src/persistence/farmSave.js");
  const store = new Map([
    [
      LEGACY_FARM_SAVE_KEY,
      JSON.stringify({
        version: 2,
        plots: {
          field_01: {
            id: "field_01",
            crop: { type: "radish", plantedAt: 1, wateredAt: 2 }
          }
        },
        stats: { harvested: 5 },
        board: { messages: [], lastReadAt: 0 }
      })
    ]
  ]);
  const storage = {
    getItem: (key) => store.get(key) ?? null,
    setItem: (key, value) => store.set(key, value)
  };

  const restored = readFarmSave(storage);
  assert.equal(restored.stats.harvested, 5);
  assert.equal(restored.stats.coins, 24);
  assert.equal(restored.plots.field_05.unlocked, true);
  assert.equal(restored.plots.field_01.crop.type, "radish");
  assert.equal(restored.inventory.seeds.radish, 3);
});

test("initial state can consume a farm snapshot without touching storage", async () => {
  const { createInitialState } = await import("../src/game/initialState.js");
  const { createEmptyPlots } = await import("../src/game/crop.js");
  const plots = createEmptyPlots();
  plots.field_02 = {
    id: "field_02",
    unlocked: true,
    tendedAt: 0,
    crop: { type: "carrot", plantedAt: 1, wateredAt: 2 }
  };

  const state = createInitialState({
    plots,
    stats: { harvested: 3, coins: 12 },
    inventory: { seeds: { radish: 1, carrot: 0, tomato: 2 } },
    world: { greenhouse: true }
  });

  assert.equal(state.stats.harvested, 3);
  assert.equal(state.stats.coins, 12);
  assert.equal(state.plots.field_02.crop.wateredAt, 2);
  assert.equal(state.plots.field_02.crop.type, "carrot");
  assert.equal(state.inventory.seeds.tomato, 2);
  assert.equal(state.world.greenhouse, true);
  assert.equal(state.ui.selectedPlotId, null);
  assert.equal(state.players[PLAYER_ID].currentScene, SCENE.OUTDOOR);
  assert.equal(state.players[PLAYER_ID].name, "A");
});
