import test from "node:test";
import assert from "node:assert/strict";
import { ACTION, PLAYGROUND, PLAYER_ID, SCENE } from "../src/config.js";
import { createEmptyPlots } from "../src/game/crop.js";
import {
  sitPlayer,
  standPlayer,
  swingMotion,
  validateSeat
} from "../src/game/playground.js";
import { createPlayerEntity } from "../src/game/player.js";
import { reducer } from "../src/game/reducer.js";

function player(id, overrides = {}) {
  return createPlayerEntity({
    id,
    name: id === PLAYER_ID ? "A" : "B",
    currentScene: SCENE.OUTDOOR,
    position: { x: -1.35, y: -0.15 },
    facing: "south",
    ...overrides
  });
}

function makeState(overrides = {}) {
  const self = overrides.player ?? player(PLAYER_ID);
  const players = { [self.id]: self, ...(overrides.players ?? {}) };
  return {
    schemaVersion: 3,
    activePlayerId: PLAYER_ID,
    players,
    plots: createEmptyPlots(),
    stats: { harvested: 0, coins: 24, giftDay: "" },
    inventory: { seeds: { radish: 3, carrot: 1, tomato: 0 } },
    world: { greenhouse: false },
    board: { messages: [], lastReadAt: 0 },
    ui: {
      notice: null,
      nextNoticeId: 1,
      emptyRoomSeen: false,
      selectedPlotId: null,
      boardOpen: false,
      pendingScene: null,
      pendingSeat: null
    }
  };
}

function event(action, targetId = null, payload = null, when = 1000) {
  return { who: PLAYER_ID, when, action, targetId, payload };
}

test("swing slots fill in order and reject a third sitter", () => {
  let state = makeState({
    player: player(PLAYER_ID, {
      position: {
        x: PLAYGROUND.swing.stand.x,
        y: PLAYGROUND.swing.stand.y
      }
    })
  });
  const first = validateSeat(state, PLAYER_ID, "swing");
  assert.equal(first.ok, true);
  assert.equal(first.slot, 0);
  state = sitPlayer(state, PLAYER_ID, first, 100);
  assert.deepEqual(state.players[PLAYER_ID].activity, {
    kind: "swing",
    slot: 0,
    since: 100
  });
  assert.deepEqual(state.players[PLAYER_ID].position, {
    x: PLAYGROUND.swing.seats[0].x,
    y: PLAYGROUND.swing.seats[0].y
  });

  const partner = player("p_partner", {
    position: {
      x: PLAYGROUND.swing.stand.x,
      y: PLAYGROUND.swing.stand.y
    }
  });
  state = { ...state, players: { ...state.players, p_partner: partner } };
  const second = validateSeat(state, "p_partner", "swing");
  assert.equal(second.ok, true);
  assert.equal(second.slot, 1);
  state = sitPlayer(state, "p_partner", second, 200);

  const third = player("p_third", {
    position: {
      x: PLAYGROUND.swing.stand.x,
      y: PLAYGROUND.swing.stand.y
    }
  });
  state = { ...state, players: { ...state.players, p_third: third } };
  assert.equal(validateSeat(state, "p_third", "swing").code, "SEAT_TAKEN");
});

test("seesaw gives each player a free side and stands up cleanly", () => {
  let state = makeState({
    player: player(PLAYER_ID, {
      position: {
        x: PLAYGROUND.seesaw.ends[0].stand.x,
        y: PLAYGROUND.seesaw.ends[0].stand.y
      }
    })
  });
  const a = validateSeat(state, PLAYER_ID, "seesaw");
  assert.equal(a.ok, true);
  assert.equal(a.side, "a");
  state = sitPlayer(state, PLAYER_ID, a, 100);

  const partner = player("p_partner", {
    position: {
      x: PLAYGROUND.seesaw.ends[1].stand.x,
      y: PLAYGROUND.seesaw.ends[1].stand.y
    }
  });
  state = { ...state, players: { ...state.players, p_partner: partner } };
  const b = validateSeat(state, "p_partner", "seesaw");
  assert.equal(b.ok, true);
  assert.equal(b.side, "b");

  const seated = sitPlayer(state, "p_partner", b, 200);
  assert.equal(validateSeat(seated, "p_partner", "seesaw").ok, true);

  const stood = standPlayer(seated, PLAYER_ID);
  assert.equal(stood.players[PLAYER_ID].activity, null);
  assert.deepEqual(stood.players[PLAYER_ID].position, {
    x: PLAYGROUND.seesaw.ends[0].stand.x,
    y: PLAYGROUND.seesaw.ends[0].stand.y
  });
});

test("swing motion is deterministic and stronger with two riders", () => {
  const one = [player(PLAYER_ID, { activity: { kind: "swing", slot: 0, since: 0 } })];
  const two = [
    ...one,
    player("p_partner", { activity: { kind: "swing", slot: 1, since: 0 } })
  ];
  const at = 650;
  const single = swingMotion(one, at);
  const dual = swingMotion(two, at);
  assert.equal(single.count, 1);
  assert.equal(dual.count, 2);
  assert.ok(Math.abs(dual.angle) >= Math.abs(single.angle));
});

test("clicking the swing walks over first, then sits; standing up restores walking", () => {
  let state = makeState();
  state = reducer(state, event(ACTION.SIT_SWING, "swing", null, 1000));
  assert.equal(state.ui.pendingSeat.kind, "swing");
  assert.equal(state.players[PLAYER_ID].currentScene, SCENE.OUTDOOR);

  for (let i = 0; i < 240 && !state.players[PLAYER_ID].activity; i += 1) {
    state = reducer(state, event(ACTION.MOVE_TICK, null, { delta: 0.05 }, 1200));
  }
  assert.equal(state.players[PLAYER_ID].activity.kind, "swing");
  assert.equal(state.ui.pendingSeat, null);

  state = reducer(state, event(ACTION.STAND_UP, null, null, 1400));
  assert.equal(state.players[PLAYER_ID].activity, null);
});

test("walking away from a seat relocates to the stand point first", () => {
  let state = makeState({
    player: player(PLAYER_ID, {
      position: {
        x: PLAYGROUND.seesaw.ends[0].stand.x,
        y: PLAYGROUND.seesaw.ends[0].stand.y
      }
    })
  });
  const seat = validateSeat(state, PLAYER_ID, "seesaw");
  state = sitPlayer(state, PLAYER_ID, seat, 100);
  assert.equal(state.players[PLAYER_ID].activity.kind, "seesaw");

  const seatPosition = { ...state.players[PLAYER_ID].position };
  state = reducer(
    state,
    event(ACTION.WALK_TO, null, { x: -1.5, y: 1.5 }, 1000)
  );
  assert.equal(state.players[PLAYER_ID].activity, null);
  assert.notDeepEqual(state.players[PLAYER_ID].position, seatPosition);
  assert.ok(state.players[PLAYER_ID].destination);
  assert.equal(
    state.players[PLAYER_ID].position.x,
    PLAYGROUND.seesaw.ends[0].stand.x
  );
});
