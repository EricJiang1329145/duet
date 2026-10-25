import test from "node:test";
import assert from "node:assert/strict";
import { ACTION, PLAYER_ID, SCENE, SOFA } from "../src/config.js";
import { createInitialState } from "../src/game/initialState.js";
import { createPlayerEntity } from "../src/game/player.js";
import { reducer } from "../src/game/reducer.js";

const OTHER_ID = "local-other";

function player(id, name, position) {
  return createPlayerEntity({
    id,
    name,
    currentScene: SCENE.INDOOR_1,
    position,
    facing: "east"
  });
}

function stateWithOther(otherActivity = null) {
  const base = createInitialState();
  const other = {
    ...player(OTHER_ID, "B", { x: -2.2, y: 1.4 }),
    activity: otherActivity
  };
  return {
    ...base,
    players: {
      [PLAYER_ID]: player(PLAYER_ID, "A", { x: -2.2, y: 1.4 }),
      [OTHER_ID]: other
    }
  };
}

function event(action, targetId = null) {
  return { who: PLAYER_ID, when: 3000, action, targetId, payload: null };
}

test("the sofa has two seats and picks the free one", () => {
  const state = stateWithOther({
    kind: "sofa",
    slot: 0,
    since: 1
  });
  const next = reducer(state, event(ACTION.SIT_SOFA, "sofa"));
  assert.deepEqual(next.players[PLAYER_ID].activity, {
    kind: "sofa",
    slot: 1,
    since: 3000
  });
  assert.deepEqual(next.players[PLAYER_ID].position, {
    x: SOFA.seats[1].x,
    y: SOFA.seats[1].z
  });
});

test("both players can sit on the sofa at the same time", () => {
  let state = stateWithOther({
    kind: "sofa",
    slot: 0,
    since: 1
  });
  state = reducer(state, event(ACTION.SIT_SOFA, "sofa"));
  assert.equal(state.players[PLAYER_ID].activity.slot, 1);
  assert.equal(state.players[OTHER_ID].activity.slot, 0);
});

test("standing up from the sofa returns to the front of it", () => {
  let state = stateWithOther();
  state = reducer(state, event(ACTION.SIT_SOFA, "sofa"));
  state = reducer(state, event(ACTION.SIT_SOFA, "sofa"));
  assert.equal(state.players[PLAYER_ID].activity, null);
  assert.deepEqual(state.players[PLAYER_ID].position, {
    x: SOFA.stand.x,
    y: SOFA.stand.z
  });
});
