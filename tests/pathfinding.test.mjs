import test from "node:test";
import assert from "node:assert/strict";
import {
  DECOR_OBSTACLES,
  PLAYER_ID,
  SCENE
} from "../src/config.js";
import {
  findPath,
  isWalkablePoint,
  obstaclesForScene
} from "../src/game/pathfinding.js";
import { canPlayerStand, planWalk } from "../src/game/movement.js";
import { createInitialState } from "../src/game/initialState.js";
import { createPlayerEntity } from "../src/game/player.js";

test("A* routes around a field and every waypoint is walkable", () => {
  const path = findPath(SCENE.OUTDOOR, { x: -1.35, y: -0.15 }, { x: 4.0, y: 8.0 });
  assert.ok(path?.path?.length >= 2);
  for (const point of path.path) {
    assert.equal(
      isWalkablePoint(SCENE.OUTDOOR, point.x, point.y),
      true,
      `blocked waypoint ${point.x},${point.y}`
    );
  }
  assert.ok(path.path.some((point) => Math.abs(point.x) > 1.5));
});

test("the walkable area reaches the visible fence, not an invisible camera band", () => {
  assert.equal(isWalkablePoint(SCENE.OUTDOOR, 11.5, 8.8), true);
  assert.equal(isWalkablePoint(SCENE.OUTDOOR, 11.5, 8.8), true);
  assert.equal(isWalkablePoint(SCENE.OUTDOOR, 12.4, 9.7), false);
});

test("A* goes through the west bedroom door instead of through its wall", () => {
  const path = findPath(
    SCENE.INDOOR_1,
    { x: 0, y: 4.3 },
    { x: -4.8, y: -1.2 }
  );
  assert.ok(path?.path?.length > 0);
  for (const point of path.path) {
    assert.equal(
      isWalkablePoint(SCENE.INDOOR_1, point.x, point.y),
      true
    );
  }
  assert.ok(
    path.path.some((point) => point.y < -0.5 && point.x < -2.4),
    "the route should enter the west bedroom"
  );
});

test("blocked decor is only a wall after it is owned", () => {
  assert.equal(canPlayerStand(SCENE.INDOOR_2, 0, -5.4), true);
  assert.equal(
    canPlayerStand(SCENE.INDOOR_2, 0, -5.4, {
      decor: { tv: true }
    }),
    false
  );

  const owned = findPath(
    SCENE.INDOOR_2,
    { x: 0, y: 1.0 },
    { x: 0, y: -5.4 },
    [DECOR_OBSTACLES.tv]
  );
  assert.ok(owned?.path?.length > 0);
  assert.ok(owned.adjustedGoal, "a target inside the bed should snap nearby");
  for (const point of owned.path) {
    assert.equal(
      isWalkablePoint(SCENE.INDOOR_2, point.x, point.y, [DECOR_OBSTACLES.tv]),
      true
    );
  }
});

test("planWalk produces a path and a final destination", () => {
  const base = createInitialState();
  const state = {
    ...base,
    players: {
      [PLAYER_ID]: createPlayerEntity({
        id: PLAYER_ID,
        name: "A",
        currentScene: SCENE.OUTDOOR,
        position: { x: 0, y: 0.5 },
        facing: "north"
      })
    }
  };
  const patch = planWalk(state, state.players[PLAYER_ID], { x: 9, y: 6 });
  assert.ok(patch?.path?.length > 0);
  assert.deepEqual(patch.destination, patch.path[patch.path.length - 1]);
  assert.equal(patch.pathIndex, 0);
  assert.ok(obstaclesForScene(SCENE.OUTDOOR).length > 0);
});
