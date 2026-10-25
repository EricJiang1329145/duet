import test from "node:test";
import assert from "node:assert/strict";
import { CROP, PLAYER_ID, SCENE } from "../src/config.js";
import { createEmptyPlots } from "../src/game/crop.js";
import { createPlayerEntity } from "../src/game/player.js";
import {
  applyPresence,
  clonePlots,
  playerFromPresence,
  presenceOf,
  removePresence
} from "../src/game/sharedState.js";

function makeState() {
  const self = createPlayerEntity({
    id: PLAYER_ID,
    name: "A",
    currentScene: SCENE.OUTDOOR,
    position: { x: -1.35, y: -0.15 },
    facing: "south"
  });

  return {
    schemaVersion: 3,
    roomId: "MAIN",
    activePlayerId: PLAYER_ID,
    players: { [PLAYER_ID]: self },
    plots: createEmptyPlots(),
    stats: { harvested: 2 },
    ui: {
      notice: null,
      nextNoticeId: 1,
      emptyRoomSeen: false,
      selectedPlotId: null
    }
  };
}

test("presence round-trips only shared player fields", () => {
  const player = makeState().players[PLAYER_ID];
  const presence = presenceOf(player);

  assert.deepEqual(Object.keys(presence).sort(), [
    "activity",
    "currentScene",
    "destination",
    "facing",
    "id",
    "name",
    "position"
  ]);
  assert.equal(presence.destination, null);

  const restored = playerFromPresence(presence);
  assert.deepEqual(restored.position, player.position);
  assert.equal(restored.destination, null);
});

test("presence carries a sanitized destination for remote path guides", () => {
  const player = createPlayerEntity({
    id: "p_remote",
    name: "B",
    currentScene: SCENE.OUTDOOR,
    position: { x: 0, y: 0 },
    facing: "south",
    destination: { x: 3.2, y: 4.8 },
    path: [{ x: 1, y: 1 }],
    pathIndex: 0
  });
  const presence = presenceOf(player);
  assert.deepEqual(presence.destination, { x: 3.2, y: 4.8 });

  const restored = playerFromPresence(presence);
  assert.deepEqual(restored.destination, { x: 3.2, y: 4.8 });
  assert.deepEqual(restored.path, []);

  const clamped = playerFromPresence({
    id: "p_far",
    currentScene: SCENE.OUTDOOR,
    position: { x: 0, y: 0 },
    facing: "south",
    destination: { x: 999, y: -999 }
  });
  assert.ok(clamped.destination.x <= 11.8);
  assert.ok(clamped.destination.y >= -9.2);
});

test("untrusted presence is validated and clamped", () => {
  assert.equal(playerFromPresence(null), null);
  assert.equal(playerFromPresence({ id: "p1" }), null);
  assert.equal(
    playerFromPresence({ id: "p1", position: { x: Number.NaN, y: 0 } }),
    null
  );

  const clamped = playerFromPresence({
    id: "p1",
    name: "  小明  ",
    currentScene: SCENE.OUTDOOR,
    position: { x: 9999, y: -9999 },
    facing: "not-a-facing"
  });
  assert.equal(clamped.name, "小明");
  assert.ok(clamped.position.x <= 11.8);
  assert.ok(clamped.position.y >= -9.2);
  assert.equal(clamped.facing, "south");

  const fallbackScene = playerFromPresence({
    id: "p2",
    currentScene: "moon",
    position: { x: 0, y: 0 }
  });
  assert.equal(fallbackScene.currentScene, SCENE.OUTDOOR);
});

test("playground activity survives presence but rejects unknown shapes", () => {
  const swing = playerFromPresence({
    id: "p3",
    currentScene: SCENE.OUTDOOR,
    position: { x: -5.02, y: 1.78 },
    facing: "south",
    activity: { kind: "swing", slot: 1, since: 123 }
  });
  assert.deepEqual(swing.activity, { kind: "swing", slot: 1, since: 123 });

  const invalid = playerFromPresence({
    id: "p4",
    currentScene: SCENE.OUTDOOR,
    position: { x: 0, y: 0 },
    facing: "south",
    activity: { kind: "dance", since: 1 }
  });
  assert.equal(invalid.activity, null);
});

test("presence merges add and update players without touching farm state", () => {
  const state = makeState();
  const partner = {
    id: "p_partner",
    name: "B",
    currentScene: SCENE.OUTDOOR,
    position: { x: 0.5, y: 0.5 },
    facing: "east"
  };

  const added = applyPresence(state, partner);
  assert.equal(added.added, true);
  assert.equal(added.state.players.p_partner.name, "B");
  assert.deepEqual(added.state.plots, state.plots);

  const updated = applyPresence(added.state, { ...partner, name: "B2" });
  assert.equal(updated.added, false);
  assert.equal(updated.state.players.p_partner.name, "B2");

  const removed = removePresence(updated.state, "p_partner");
  assert.equal("p_partner" in removed.players, false);
});

test("clonePlots deep-copies crop records", () => {
  const plots = createEmptyPlots();
  plots.field_03 = {
    id: "field_03",
    unlocked: true,
    tendedAt: 7,
    crop: { type: CROP.type, plantedAt: 1, wateredAt: 2 }
  };

  const cloned = clonePlots(plots);
  cloned.field_03.crop.wateredAt = 99;
  cloned.field_03.tendedAt = 42;
  assert.equal(plots.field_03.crop.wateredAt, 2);
  assert.equal(plots.field_03.tendedAt, 7);
});
