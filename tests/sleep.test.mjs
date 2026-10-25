import test from "node:test";
import assert from "node:assert/strict";
import { ACTION, BEDROOMS, PLAYER_ID, SCENE } from "../src/config.js";
import { createInitialState } from "../src/game/initialState.js";
import { createPlayerEntity } from "../src/game/player.js";
import { reducer } from "../src/game/reducer.js";
import { offlineSleepers } from "../src/game/sleep.js";

function stateWith(name, position) {
  const base = createInitialState();
  const player = createPlayerEntity({
    id: PLAYER_ID,
    name,
    currentScene: SCENE.INDOOR_1,
    position,
    facing: "north"
  });
  return {
    ...base,
    players: { [PLAYER_ID]: player },
    stats: { ...base.stats, coins: 100 }
  };
}

function event(action, targetId = null) {
  return { who: PLAYER_ID, when: 1000, action, targetId, payload: null };
}

test("own bed toggles sleep and wake at the correct anchor", () => {
  let state = stateWith("A", { x: -6, y: -2.8 });
  state = reducer(state, event(ACTION.SLEEP, "A"));
  assert.equal(state.players[PLAYER_ID].activity.kind, "sleep");
  assert.deepEqual(state.players[PLAYER_ID].position, {
    x: BEDROOMS.A.sleep.x,
    y: BEDROOMS.A.sleep.z
  });

  state = reducer(state, event(ACTION.SLEEP, "A"));
  assert.equal(state.players[PLAYER_ID].activity, null);
  assert.deepEqual(state.players[PLAYER_ID].position, {
    x: BEDROOMS.A.wake.x,
    y: BEDROOMS.A.wake.z
  });
});

test("a player cannot fall asleep in the other bedroom", () => {
  const state = stateWith("A", { x: -6, y: -2.8 });
  const same = reducer(state, event(ACTION.SLEEP, "B"));
  assert.equal(same.players[PLAYER_ID].activity, null);
  assert.match(same.ui.notice.text, /别人的床/);
});

test("walking while asleep wakes at the bedside", () => {
  let state = stateWith("A", { x: -6, y: -2.8 });
  state = reducer(state, event(ACTION.SLEEP, "A"));
  state = reducer(
    state,
    {
      ...event(ACTION.WALK_TO),
      payload: { x: -3, y: 1 }
    }
  );
  assert.equal(state.players[PLAYER_ID].activity, null);
  assert.deepEqual(state.players[PLAYER_ID].position, {
    x: BEDROOMS.A.wake.x,
    y: BEDROOMS.A.wake.z
  });
});

test("offline characters default to sleeping in their own bed", () => {
  const sleepers = offlineSleepers([{ name: "A" }]);
  assert.deepEqual(
    sleepers.map((player) => [player.name, player.activity.bedId]),
    [["B", "B"]]
  );
  assert.equal(offlineSleepers([{ name: "A" }, { name: "B" }]).length, 0);
});

test("sleep survives player entity and presence sanitization", () => {
  const player = createPlayerEntity({
    id: "p1",
    name: "A",
    currentScene: SCENE.INDOOR_1,
    position: { x: -6, y: -3.25 },
    facing: "north",
    activity: { kind: "sleep", bedId: "A", since: 42 }
  });
  assert.deepEqual(player.activity, { kind: "sleep", bedId: "A", since: 42 });
});
