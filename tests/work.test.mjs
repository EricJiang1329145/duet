import test from "node:test";
import assert from "node:assert/strict";
import { ACTION, PLAYER_ID, SCENE, STUDIES } from "../src/config.js";
import { createInitialState } from "../src/game/initialState.js";
import { createPlayerEntity } from "../src/game/player.js";
import { reducer } from "../src/game/reducer.js";

function stateAt(position) {
  const base = createInitialState();
  return {
    ...base,
    players: {
      [PLAYER_ID]: createPlayerEntity({
        id: PLAYER_ID,
        name: "A",
        currentScene: SCENE.INDOOR_1,
        position,
        facing: "north"
      })
    }
  };
}

function event(action, targetId = null) {
  return { who: PLAYER_ID, when: 2000, action, targetId, payload: null };
}

test("studies toggle work and return the player to the desk-side stand point", () => {
  let state = stateAt({ x: -7.2, y: 2.2 });
  state = reducer(state, event(ACTION.WORK, "study_a"));
  assert.deepEqual(state.players[PLAYER_ID].activity, {
    kind: "work",
    studyId: "study_a",
    slot: 0,
    since: 2000
  });
  assert.deepEqual(state.players[PLAYER_ID].position, {
    x: STUDIES.A.seats[0].x,
    y: STUDIES.A.seats[0].z
  });

  state = reducer(state, event(ACTION.WORK, "study_a"));
  assert.equal(state.players[PLAYER_ID].activity, null);
  assert.deepEqual(state.players[PLAYER_ID].position, {
    x: STUDIES.A.stand.x,
    y: STUDIES.A.stand.z
  });
});

test("work requires standing inside the matching study", () => {
  const state = stateAt({ x: -3, y: 1.2 });
  const same = reducer(state, event(ACTION.WORK, "study_a"));
  assert.equal(same.players[PLAYER_ID].activity, null);
  assert.match(same.ui.notice.text, /先走进书房/);
});

test("walking while working leaves the chair", () => {
  let state = stateAt({ x: 7.2, y: 2.2 });
  state = reducer(state, event(ACTION.WORK, "study_b"));
  state = reducer(state, {
    ...event(ACTION.WALK_TO),
    payload: { x: 0, y: 1 }
  });
  assert.equal(state.players[PLAYER_ID].activity, null);
  assert.deepEqual(state.players[PLAYER_ID].position, {
    x: STUDIES.B.stand.x,
    y: STUDIES.B.stand.z
  });
});

test("two players can study at the same desk in different chairs", () => {
  const base = stateAt({ x: -7.2, y: 2.2 });
  const otherId = "other-player";
  const other = createPlayerEntity({
    id: otherId,
    name: "B",
    currentScene: SCENE.INDOOR_1,
    position: { x: -7.2, y: 2.2 },
    facing: "north",
    activity: { kind: "work", studyId: "study_a", slot: 0, since: 1 }
  });
  const state = {
    ...base,
    players: {
      ...base.players,
      [otherId]: other
    }
  };
  const next = reducer(state, event(ACTION.WORK, "study_a"));
  assert.equal(next.players[PLAYER_ID].activity.slot, 1);
  assert.equal(next.players[otherId].activity.slot, 0);
});

test("work activity survives presence sanitization", () => {
  const player = createPlayerEntity({
    id: "p1",
    name: "A",
    currentScene: SCENE.INDOOR_1,
    position: { x: -7.2, y: 2.72 },
    facing: "north",
    activity: { kind: "work", studyId: "study_a", slot: 0, since: 42 }
  });
  assert.deepEqual(player.activity, {
    kind: "work",
    studyId: "study_a",
    slot: 0,
    since: 42
  });
});
