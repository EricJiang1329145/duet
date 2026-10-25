import test from "node:test";
import assert from "node:assert/strict";

import { characterNameFor } from "../src/config.js";
import {
  identityFromRow,
  resolveJoin,
  sanitizeFacing,
  sanitizeScene
} from "../worker/src/identity.js";

const SPAWN_A = { x: -1.35, y: -0.15 };
const SPAWN_B = { x: -1.9, y: 0.55 };

test("only the two configured character names are accepted", () => {
  assert.equal(characterNameFor("A"), "A");
  assert.equal(characterNameFor("A"), "A");
  assert.equal(characterNameFor("B"), "B");
  assert.equal(characterNameFor("B"), "B");
  assert.equal(characterNameFor("Alice"), "");
});

test("a brand new client gets the first spawn and the first character", () => {
  const joined = resolveJoin({
    id: "p_new1",
    requestedName: "",
    playerCount: 0,
    spawn: SPAWN_A
  });

  assert.equal(joined.id, "p_new1");
  assert.equal(joined.name, "A");
  assert.equal(joined.currentScene, "outdoor");
  assert.deepEqual(joined.position, SPAWN_A);
  assert.equal(joined.facing, "south");
  assert.equal(joined.resumed, false);
});

test("a second new client defaults to the second character", () => {
  const joined = resolveJoin({
    id: "p_new2",
    requestedName: "",
    playerCount: 1,
    spawn: SPAWN_B
  });

  assert.equal(joined.name, "B");
  assert.deepEqual(joined.position, SPAWN_B);
});

test("a stored identity resumes id, name, scene and position", () => {
  const stored = {
    playerId: "p_keep",
    name: "A",
    currentScene: "indoor_1",
    position: { x: 0.4, y: 1.2 },
    facing: "east"
  };

  const joined = resolveJoin({
    id: "p_keep",
    stored,
    requestedName: "",
    playerCount: 1,
    spawn: SPAWN_B
  });

  assert.equal(joined.id, "p_keep");
  assert.equal(joined.name, "A");
  assert.equal(joined.currentScene, "indoor_1");
  assert.deepEqual(joined.position, { x: 0.4, y: 1.2 });
  assert.equal(joined.facing, "east");
  assert.equal(joined.resumed, true);
});

test("a live player beats the stored position", () => {
  const stored = {
    playerId: "p_keep",
    name: "A",
    currentScene: "outdoor",
    position: { x: 0, y: 0 },
    facing: "south"
  };
  const live = {
    id: "p_keep",
    name: "A",
    currentScene: "indoor_2",
    position: { x: 2, y: -1 },
    facing: "west"
  };

  const joined = resolveJoin({
    id: "p_keep",
    stored,
    live,
    playerCount: 1,
    spawn: SPAWN_B
  });

  assert.equal(joined.currentScene, "indoor_2");
  assert.deepEqual(joined.position, { x: 2, y: -1 });
  assert.equal(joined.facing, "west");
});

test("an explicit character choice overrides the stored character", () => {
  const stored = {
    playerId: "p_keep",
    name: "A",
    currentScene: "outdoor",
    position: { x: 0, y: 0 },
    facing: "south"
  };

  const joined = resolveJoin({
    id: "p_keep",
    stored,
    requestedName: "B",
    playerCount: 1,
    spawn: SPAWN_B
  });

  assert.equal(joined.name, "B");
  assert.equal(joined.resumed, true);
});

test("a stored identity for another player id is not resumed", () => {
  const stored = {
    playerId: "p_other",
    name: "B",
    currentScene: "indoor_1",
    position: { x: 1, y: 1 },
    facing: "east"
  };

  const joined = resolveJoin({
    id: "p_new",
    stored,
    requestedName: "",
    playerCount: 0,
    spawn: SPAWN_A
  });

  assert.equal(joined.resumed, false);
  assert.equal(joined.currentScene, "outdoor");
  assert.deepEqual(joined.position, SPAWN_A);
});

test("identity rows are normalized and invalid rows rejected", () => {
  assert.equal(identityFromRow(null), null);
  assert.equal(identityFromRow({ player_id: "" }), null);

  const row = identityFromRow({
    player_id: "p_1",
    name: "A",
    scene: "somewhere_else",
    x: "1.5",
    y: "-2",
    facing: "sideways"
  });

  assert.equal(row.currentScene, "outdoor");
  assert.equal(row.facing, "south");
  assert.deepEqual(row.position, { x: 1.5, y: -2 });
  assert.equal(sanitizeScene("indoor_2"), "indoor_2");
  assert.equal(sanitizeFacing("north_east"), "north_east");
});

test("a missing id cannot be resolved", () => {
  assert.equal(resolveJoin({ id: "  ", spawn: SPAWN_A }), null);
});
