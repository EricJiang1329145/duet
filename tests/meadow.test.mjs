import test from "node:test";
import assert from "node:assert/strict";
import {
  ACTION,
  PLAYER_ID,
  SCENE,
  SCENE_RESOURCES,
  SCENE_UNLOCKS
} from "../src/config.js";
import { createEmptyPlots } from "../src/game/crop.js";
import { createPlayerEntity } from "../src/game/player.js";
import {
  applySceneAction,
  validateSceneAction
} from "../src/game/sceneRules.js";
import { getDayKey } from "../src/game/season.js";
import { sanitizeGoods } from "../src/game/warehouse.js";
import { sanitizeWorld } from "../src/game/world.js";

function makeState(overrides = {}) {
  const player = createPlayerEntity({
    id: PLAYER_ID,
    name: "A",
    currentScene: SCENE.MEADOW,
    position: { x: 0, y: 2.45 },
    facing: "north"
  });
  return {
    schemaVersion: 3,
    activePlayerId: PLAYER_ID,
    players: { [PLAYER_ID]: player },
    plots: createEmptyPlots(),
    stats: { harvested: 0, coins: 200, giftDay: "" },
    inventory: {
      seeds: { radish: 1, carrot: 0, tomato: 0 },
      goods: sanitizeGoods(null)
    },
    world: sanitizeWorld({
      scenes: { meadow: true },
      forage: {}
    }),
    board: { messages: [], lastReadAt: 0 },
    ui: { notice: null, nextNoticeId: 1, selectedPlotId: null },
    ...overrides
  };
}

const NOW = Date.UTC(2026, 9, 24, 12);

test("unlocking the meadow costs coins and makes it shared", () => {
  const state = makeState({
    world: sanitizeWorld({}),
    stats: { harvested: 0, coins: 200, giftDay: "" }
  });
  const check = validateSceneAction(
    state,
    PLAYER_ID,
    ACTION.UNLOCK_SCENE,
    "meadow",
    null,
    NOW
  );
  assert.equal(check.ok, true);
  const next = applySceneAction(
    state,
    PLAYER_ID,
    ACTION.UNLOCK_SCENE,
    "meadow",
    null,
    NOW
  );
  assert.equal(next.world.scenes.meadow, true);
  assert.equal(next.stats.coins, 200 - SCENE_UNLOCKS.meadow.cost);
  assert.equal(state.world.scenes.meadow, false);
});

test("the meadow gives one flower and one honey collection per day", () => {
  const state = makeState();
  const flower = applySceneAction(
    state,
    PLAYER_ID,
    ACTION.COLLECT_RESOURCE,
    "meadow_flowers",
    null,
    NOW
  );
  assert.equal(flower.inventory.goods.flower, 2);
  assert.equal(
    flower.world.forage.meadow_flowers[PLAYER_ID],
    getDayKey(NOW)
  );
  assert.equal(
    validateSceneAction(
      flower,
      PLAYER_ID,
      ACTION.COLLECT_RESOURCE,
      "meadow_flowers",
      null,
      NOW
    ).code,
    "ALREADY_COLLECTED"
  );
  const hive = applySceneAction(
    flower,
    PLAYER_ID,
    ACTION.COLLECT_RESOURCE,
    "meadow_hive",
    null,
    NOW
  );
  assert.equal(hive.inventory.goods.honey, 1);
});

test("warehouse goods can be sold for coins", () => {
  const state = makeState({
    inventory: {
      seeds: { radish: 1, carrot: 0, tomato: 0 },
      goods: sanitizeGoods({ flower: 3, honey: 1 })
    }
  });
  const next = applySceneAction(
    state,
    PLAYER_ID,
    ACTION.SELL_GOODS,
    "flower",
    { count: 2 },
    NOW
  );
  assert.equal(next.inventory.goods.flower, 1);
  assert.equal(next.stats.coins, 208);
  assert.equal(state.inventory.goods.flower, 3);
});

test("meadow resources require the scene and the shared unlock", () => {
  const outside = makeState({
    players: {
      [PLAYER_ID]: {
        ...makeState().players[PLAYER_ID],
        currentScene: SCENE.OUTDOOR
      }
    }
  });
  assert.equal(
    validateSceneAction(
      outside,
      PLAYER_ID,
      ACTION.COLLECT_RESOURCE,
      "meadow_flowers",
      null,
      NOW
    ).code,
    "WRONG_SCENE"
  );
  const locked = makeState({ world: sanitizeWorld({}) });
  assert.equal(
    validateSceneAction(
      locked,
      PLAYER_ID,
      ACTION.COLLECT_RESOURCE,
      "meadow_flowers",
      null,
      NOW
    ).code,
    "SCENE_LOCKED"
  );
});

test("every extra scene exposes a daily resource and per-player warehouse", () => {
  const state = makeState({
    world: sanitizeWorld({
      scenes: { meadow: true, dock: true, orchard: true, spring: true },
      forage: {}
    })
  });
  let next = state;
  for (const nodes of Object.values(SCENE_RESOURCES)) {
    for (const node of nodes) {
      const sceneState = {
        ...next,
        players: {
          [PLAYER_ID]: {
            ...next.players[PLAYER_ID],
            currentScene: Object.entries(SCENE_RESOURCES).find(([, list]) =>
              list.includes(node)
            )[0]
          }
        }
      };
      const collected = applySceneAction(
        sceneState,
        PLAYER_ID,
        ACTION.COLLECT_RESOURCE,
        node.id,
        null,
        NOW
      );
      assert.ok(collected, `collect ${node.id}`);
      assert.ok(collected.inventory.goods[node.goods] >= node.amount);
      next = collected;
    }
  }
  assert.ok(next.inventory.goods.fish > 0);
  assert.ok(next.inventory.goods.fruit > 0);
  assert.ok(next.inventory.goods.tea > 0);
});

test("two players in the same meadow collect one extra item", () => {
  const base = makeState();
  const partner = {
    ...base.players[PLAYER_ID],
    id: "p_partner",
    name: "B"
  };
  const state = {
    ...base,
    players: { ...base.players, p_partner: partner }
  };
  const next = applySceneAction(
    state,
    PLAYER_ID,
    ACTION.COLLECT_RESOURCE,
    "meadow_flowers",
    null,
    NOW
  );
  assert.equal(next.inventory.goods.flower, 3);
  assert.equal(base.inventory.goods.flower, 0);
});
