import test from "node:test";
import assert from "node:assert/strict";
import { ACTION, CROPS, PLAYER_ID, SCENE } from "../src/config.js";
import {
  createEmptyPlots,
  getPlotHazard,
  seasonGrowthFactor
} from "../src/game/crop.js";
import { createPlayerEntity } from "../src/game/player.js";
import {
  applyFarmAction,
  getFarmNotice,
  harvestReward,
  validateFarmAction
} from "../src/game/farmRules.js";

function makeState(overrides = {}) {
  const player = createPlayerEntity({
    id: PLAYER_ID,
    name: "A",
    currentScene: overrides.scene ?? SCENE.OUTDOOR,
    position: { x: -1.35, y: -0.15 },
    facing: "south"
  });

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
    ui: {
      notice: null,
      nextNoticeId: 1,
      emptyRoomSeen: false,
      selectedPlotId: null
    }
  };
}

test("farm rules validate without depending on local plot selection", () => {
  const state = makeState();
  assert.equal(state.ui.selectedPlotId, null);

  const check = validateFarmAction(
    state,
    PLAYER_ID,
    ACTION.PLANT_CROP,
    "field_01",
    { cropType: "carrot" },
    1000
  );
  assert.equal(check.ok, true);
  assert.equal(check.cropType, "carrot");

  const planted = applyFarmAction(
    state,
    PLAYER_ID,
    ACTION.PLANT_CROP,
    "field_01",
    { cropType: "carrot" },
    1000
  );
  assert.equal(planted.plots.field_01.crop.type, "carrot");
  assert.equal(planted.plots.field_01.crop.plantedAt, 1000);
  assert.equal(planted.plots.field_01.crop.wateredAt, null);
  assert.equal(planted.inventory.seeds.carrot, 0);
  assert.equal(state.plots.field_01.crop, null, "input state is not mutated");
});

test("farm rules reject actions from another scene, locked plots and bad states", () => {
  const state = makeState();
  assert.equal(
    validateFarmAction(state, PLAYER_ID, ACTION.WATER_CROP, "field_01", null)
      .code,
    "PLOT_EMPTY"
  );

  const indoor = makeState({ scene: SCENE.INDOOR_1 });
  assert.equal(
    validateFarmAction(indoor, PLAYER_ID, ACTION.PLANT_CROP, "field_01", null)
      .code,
    "NOT_FARM_SCENE"
  );

  assert.equal(
    validateFarmAction(state, PLAYER_ID, ACTION.PLANT_CROP, "field_07", null)
      .code,
    "PLOT_LOCKED"
  );

  const noSeeds = makeState({
    inventory: { seeds: { radish: 0, carrot: 0, tomato: 0 } }
  });
  assert.equal(
    validateFarmAction(noSeeds, PLAYER_ID, ACTION.PLANT_CROP, "field_01", null)
      .code,
    "NO_SEEDS"
  );

  const outside = makeState();
  const planted = applyFarmAction(
    outside,
    PLAYER_ID,
    ACTION.PLANT_CROP,
    "field_01",
    null,
    1000
  );
  assert.equal(
    validateFarmAction(
      planted,
      PLAYER_ID,
      ACTION.HARVEST_CROP,
      "field_01",
      null,
      2000
    ).code,
    "NOT_READY"
  );
  assert.equal(
    validateFarmAction(
      planted,
      PLAYER_ID,
      ACTION.PLANT_CROP,
      "field_01",
      null,
      2000
    ).code,
    "PLOT_OCCUPIED"
  );
});

test("watering and harvesting produce the authoritative farm result", () => {
  let state = makeState();
  state = applyFarmAction(
    state,
    PLAYER_ID,
    ACTION.PLANT_CROP,
    "field_01",
    null,
    1000
  );
  state = applyFarmAction(
    state,
    PLAYER_ID,
    ACTION.WATER_CROP,
    "field_01",
    null,
    2000
  );
  assert.equal(state.plots.field_01.crop.wateredAt, 2000);
  const readyAt =
    2000 +
    CROPS.radish.readyAfterMs * seasonGrowthFactor(CROPS.radish, 2000);
  if (getPlotHazard(state.plots.field_01, readyAt)) {
    state = applyFarmAction(
      state,
      PLAYER_ID,
      ACTION.CLEAR_HAZARD,
      "field_01",
      null,
      readyAt
    );
  }
  assert.equal(
    validateFarmAction(
      state,
      PLAYER_ID,
      ACTION.HARVEST_CROP,
      "field_01",
      null,
      readyAt
    ).ok,
    true
  );

  const reward = harvestReward(state.plots.field_01, state);
  const harvested = applyFarmAction(
    state,
    PLAYER_ID,
    ACTION.HARVEST_CROP,
    "field_01",
    null,
    readyAt
  );
  assert.equal(harvested.plots.field_01.crop, null);
  assert.equal(harvested.stats.harvested, 1);
  assert.equal(harvested.stats.coins, 24 + reward.coins);
  assert.equal(state.stats.harvested, 0, "input state is not mutated");

  const notice = getFarmNotice(ACTION.HARVEST_CROP, harvested, {
    cropType: "radish",
    coins: reward.coins,
    seeds: reward.seeds
  });
  assert.equal(notice.tone, "harvest");
  assert.match(notice.text, /累计 1 株/);
});

test("greenhouse money and seed bonuses only apply to its two beds", () => {
  const state = makeState({ world: { greenhouse: true, decor: {} } });
  const home = {
    id: "field_01",
    unlocked: true,
    tendedAt: 0,
    crop: { type: "radish", plantedAt: 1000, wateredAt: 2000 }
  };
  const greenhouse = { ...home, id: "field_11" };
  assert.deepEqual(harvestReward(home, state), {
    coins: CROPS.radish.sellPrice,
    seeds: 0,
    produce: 1,
    cropType: "radish"
  });
  assert.deepEqual(harvestReward(greenhouse, state), {
    coins: Math.round(CROPS.radish.sellPrice * 1.25),
    seeds: 1,
    produce: 1,
    cropType: "radish"
  });
});

test("economy actions require coins and stay pure", () => {
  const state = makeState({ stats: { harvested: 0, coins: 100, giftDay: "" } });
  const unlocked = applyFarmAction(
    state,
    PLAYER_ID,
    ACTION.UNLOCK_PLOT,
    "field_07",
    null,
    1000
  );
  assert.equal(unlocked.plots.field_07.unlocked, true);
  assert.equal(unlocked.stats.coins, 75);
  assert.equal(state.plots.field_07.unlocked, false);

  const bought = applyFarmAction(
    unlocked,
    PLAYER_ID,
    ACTION.BUY_SEED,
    null,
    { cropType: "tomato", count: 2 },
    1000
  );
  assert.equal(bought.inventory.seeds.tomato, 2);
  assert.equal(bought.stats.coins, 75 - CROPS.tomato.seedCost * 2);

  const poor = makeState({ stats: { harvested: 0, coins: 0, giftDay: "" } });
  assert.equal(
    validateFarmAction(poor, PLAYER_ID, ACTION.BUY_SEED, null, {
      cropType: "tomato",
      count: 1
    }).code,
    "NO_COINS"
  );

  const greenhouse = applyFarmAction(
    state,
    PLAYER_ID,
    ACTION.BUY_GREENHOUSE,
    null,
    null,
    1000
  );
  assert.equal(greenhouse.world.greenhouse, true);
  assert.equal(greenhouse.stats.coins, 20);
});

test("invalid farm actions return null and leave the state untouched", () => {
  const state = makeState();
  assert.equal(
    applyFarmAction(state, PLAYER_ID, ACTION.WATER_CROP, "field_01", null, 1000),
    null
  );
  assert.equal(
    applyFarmAction(
      state,
      "missing-player",
      ACTION.PLANT_CROP,
      "field_01",
      null,
      1000
    ),
    null
  );
  assert.equal(
    applyFarmAction(
      state,
      PLAYER_ID,
      ACTION.PLANT_CROP,
      "field_99",
      null,
      1000
    ),
    null
  );
  assert.equal(
    applyFarmAction(state, PLAYER_ID, "WALK_TO", "field_01", null, 1000),
    null
  );
});
