import test from "node:test";
import assert from "node:assert/strict";
import { BEDROOMS, SCENE } from "../src/config.js";
import { createPlayerEntity } from "../src/game/player.js";
import { bedroomObstaclesFor } from "../src/game/movement.js";
import { findPath } from "../src/game/pathfinding.js";

function player(name) {
  return createPlayerEntity({
    id: "p1",
    name,
    currentScene: SCENE.INDOOR_1,
    position: { x: 0, y: 4.3 },
    facing: "north"
  });
}

test("each bedroom exposes exactly one owner and one door", () => {
  assert.equal(Object.keys(BEDROOMS).length, 2);
  assert.equal(BEDROOMS.A.owner, "A");
  assert.equal(BEDROOMS.B.owner, "B");
  assert.notDeepEqual(BEDROOMS.A.door, BEDROOMS.B.door);
});

test("a non-owner is blocked at the bedroom doorway", () => {
  const aOwner = player("A");
  const bOwner = player("B");
  assert.deepEqual(bedroomObstaclesFor(aOwner), [BEDROOMS.B.door]);
  assert.deepEqual(bedroomObstaclesFor(bOwner), [BEDROOMS.A.door]);

  const target = { x: -6.0, y: -3.0 };
  const aPath = findPath(
    SCENE.INDOOR_1,
    aOwner.position,
    target,
    bedroomObstaclesFor(aOwner)
  );
  assert.ok(aPath?.path?.length);
  const aFinal = aPath.path[aPath.path.length - 1];
  assert.ok(aFinal.x < -2.0, "owner reaches their bedroom");

  const blocked = findPath(
    SCENE.INDOOR_1,
    bOwner.position,
    target,
    bedroomObstaclesFor(bOwner)
  );
  assert.ok(
    !blocked || blocked.adjustedGoal,
    "the other owner's room snaps to an outside point"
  );
  if (blocked) {
    const blockedFinal = blocked.path[blocked.path.length - 1];
    assert.ok(blockedFinal.y > -1.25, "non-owner cannot cross the doorway");
  }
});
