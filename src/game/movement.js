import {
  ACTION,
  APPROACH_POINTS,
  APPROACH_RADIUS,
  BEDROOMS,
  DECOR_IDS,
  DECOR_OBSTACLES,
  FACING_OCTANTS,
  GREENHOUSE_DOOR,
  MAX_WALK_STEP_SECONDS,
  SCENE,
  STAIRS,
  WALK_LAYOUTS,
  bedroomForPlayer
} from "../config.js";
import { findPath, isWalkablePoint } from "./pathfinding.js";
import {
  SEAT_TEXT,
  sitPlayer,
  validateSeat
} from "./playground.js";
import { hasAnyDecor } from "./world.js";
import {
  getActivePlayer,
  moveActivePlayer,
  replaceActivePlayer,
  withNotice
} from "./player.js";

export const SCENE_CHANGE_KINDS = Object.freeze({
  [ACTION.ENTER_HOUSE]: "enter",
  [ACTION.EXIT_HOUSE]: "exit",
  [ACTION.ENTER_GREENHOUSE]: "greenhouseEnter",
  [ACTION.EXIT_GREENHOUSE]: "greenhouseExit",
  [ACTION.ENTER_MEADOW]: "meadowEnter",
  [ACTION.EXIT_MEADOW]: "meadowExit",
  [ACTION.ENTER_DOCK]: "dockEnter",
  [ACTION.EXIT_DOCK]: "dockExit",
  [ACTION.ENTER_ORCHARD]: "orchardEnter",
  [ACTION.EXIT_ORCHARD]: "orchardExit",
  [ACTION.ENTER_SPRING]: "springEnter",
  [ACTION.EXIT_SPRING]: "springExit",
  [ACTION.GO_UPSTAIRS]: "upstairs",
  [ACTION.GO_DOWNSTAIRS]: "downstairs"
});

const SCENE_CHANGES = Object.freeze({
  enter: {
    from: SCENE.OUTDOOR,
    scene: SCENE.INDOOR_1,
    position: { x: 0, y: 4.3 },
    facing: "north",
    readsBoard: true
  },
  exit: {
    from: SCENE.INDOOR_1,
    scene: SCENE.OUTDOOR,
    position: { x: 0, y: -1.0 },
    facing: "south",
    readsBoard: false
  },
  greenhouseEnter: {
    from: SCENE.OUTDOOR,
    scene: SCENE.GREENHOUSE,
    position: { ...GREENHOUSE_DOOR.inside },
    facing: "north",
    readsBoard: false
  },
  greenhouseExit: {
    from: SCENE.GREENHOUSE,
    scene: SCENE.OUTDOOR,
    position: { ...GREENHOUSE_DOOR.outside },
    facing: "south",
    readsBoard: false
  },
  meadowEnter: {
    from: SCENE.OUTDOOR,
    scene: SCENE.MEADOW,
    position: { x: 0, y: 2.45 },
    facing: "north",
    readsBoard: false
  },
  meadowExit: {
    from: SCENE.MEADOW,
    scene: SCENE.OUTDOOR,
    position: { ...APPROACH_POINTS.meadowEnter },
    facing: "east",
    readsBoard: false
  },
  dockEnter: {
    from: SCENE.OUTDOOR,
    scene: SCENE.DOCK,
    position: { x: 0, y: 2.45 },
    facing: "north",
    readsBoard: false
  },
  dockExit: {
    from: SCENE.DOCK,
    scene: SCENE.OUTDOOR,
    position: { ...APPROACH_POINTS.dockEnter },
    facing: "north",
    readsBoard: false
  },
  orchardEnter: {
    from: SCENE.OUTDOOR,
    scene: SCENE.ORCHARD,
    position: { x: 0, y: 2.45 },
    facing: "north",
    readsBoard: false
  },
  orchardExit: {
    from: SCENE.ORCHARD,
    scene: SCENE.OUTDOOR,
    position: { ...APPROACH_POINTS.orchardEnter },
    facing: "east",
    readsBoard: false
  },
  springEnter: {
    from: SCENE.OUTDOOR,
    scene: SCENE.SPRING,
    position: { x: 0, y: 2.45 },
    facing: "north",
    readsBoard: false
  },
  springExit: {
    from: SCENE.SPRING,
    scene: SCENE.OUTDOOR,
    position: { ...APPROACH_POINTS.springEnter },
    facing: "south",
    readsBoard: false
  },
  upstairs: {
    from: SCENE.INDOOR_1,
    scene: SCENE.INDOOR_2,
    position: { ...STAIRS.top },
    facing: "south",
    readsBoard: false
  },
  downstairs: {
    from: SCENE.INDOOR_2,
    scene: SCENE.INDOOR_1,
    position: { ...STAIRS.bottom },
    facing: "north",
    readsBoard: true
  }
});

export function facingFromDelta(dx, dy) {
  if (Math.abs(dx) < 0.00001 && Math.abs(dy) < 0.00001) return null;
  const octant = Math.round(Math.atan2(dx, dy) / (Math.PI / 4));
  return FACING_OCTANTS[Math.max(-4, Math.min(4, octant)) + 4];
}

export function pointInsideRect(x, y, rect) {
  return x >= rect.minX && x <= rect.maxX && y >= rect.minZ && y <= rect.maxZ;
}

export function isInsideEmptyRoom(layout, position) {
  return Boolean(
    layout?.emptyRoom && pointInsideRect(position.x, position.y, layout.emptyRoom)
  );
}

/**
 * Decor collision exists only for furniture the room actually owns. Empty
 * reserved slots must never behave like invisible walls.
 */
export function decorObstaclesFor(scene, world) {
  if (scene !== SCENE.INDOOR_2) return [];
  const decor = world?.decor ?? {};
  return DECOR_IDS.filter((id) => decor[id] && DECOR_OBSTACLES[id]).map(
    (id) => DECOR_OBSTACLES[id]
  );
}

export function bedroomObstaclesFor(player) {
  if (player?.currentScene !== SCENE.INDOOR_1) return [];
  const own = bedroomForPlayer(player);
  return Object.values(BEDROOMS)
    .filter((bedroom) => bedroom.id !== own?.id)
    .map((bedroom) => bedroom.door);
}

export function canPlayerStand(currentScene, x, y, world = null) {
  return isWalkablePoint(
    currentScene,
    x,
    y,
    decorObstaclesFor(currentScene, world)
  );
}

/**
 * Plan a route from the player's current position to a target. Returns a
 * player patch with destination/path/pathIndex, or null when no route exists.
 */
export function planWalk(currentState, player, target) {
  if (!player || !Number.isFinite(target?.x) || !Number.isFinite(target?.y)) {
    return null;
  }

  const extra = [
    ...decorObstaclesFor(player.currentScene, currentState.world),
    ...bedroomObstaclesFor(player)
  ];
  const result = findPath(
    player.currentScene,
    player.position,
    target,
    extra
  );
  if (!result?.path?.length) return null;

  const final = result.path[result.path.length - 1];
  const first = result.path[0];
  const facing =
    facingFromDelta(
      first.x - player.position.x,
      first.y - player.position.y
    ) ?? player.facing;

  return {
    destination: { x: final.x, y: final.y },
    path: result.path.map((point) => ({ x: point.x, y: point.y })),
    pathIndex: 0,
    facing,
    activity: null,
    adjusted: Boolean(result.adjustedGoal)
  };
}

export function walkPlayerTo(currentState, target) {
  const player = getActivePlayer(currentState);
  if (!player) return currentState;
  const patch = planWalk(currentState, player, target);
  if (!patch) return currentState;
  const { adjusted, ...playerPatch } = patch;
  void adjusted;
  return replaceActivePlayer(currentState, playerPatch);
}

export function approachPointFor(kind) {
  return APPROACH_POINTS[kind] ?? null;
}

export function isNearApproach(player, kind, radius = APPROACH_RADIUS) {
  const point = approachPointFor(kind);
  if (!point || !player) return false;
  return (
    Math.hypot(player.position.x - point.x, player.position.y - point.y) <=
    radius
  );
}

export function sceneChangeFor(currentScene, kind) {
  const change = SCENE_CHANGES[kind];
  if (!change || change.from !== currentScene) return null;
  return change;
}

export function clearPendingUi(state) {
  const ui = state.ui;
  if (!ui.pendingScene && !ui.pendingSeat) return state;
  return {
    ...state,
    ui: { ...ui, pendingScene: null, pendingSeat: null }
  };
}

function settlePendingArrival(state, player, now = Date.now()) {
  const pendingScene = state.ui.pendingScene;
  const pendingSeat = state.ui.pendingSeat;

  if (pendingScene) {
    const change = sceneChangeFor(player.currentScene, pendingScene.kind);
    if (!change) return clearPendingUi(state);
    return clearPendingUi(
      moveActivePlayer(state, change.scene, change.position, change.facing)
    );
  }

  if (pendingSeat) {
    const seat = validateSeat(state, player.id, pendingSeat.kind, pendingSeat);
    let next = clearPendingUi(state);
    if (!seat.ok) {
      return withNotice(
        next,
        SEAT_TEXT[seat.code] ?? "这里坐不了。",
        "info"
      );
    }
    return sitPlayer(next, player.id, seat, now);
  }

  return state;
}

function stopWithoutArrival(state) {
  const player = getActivePlayer(state);
  if (!player) return state;
  return clearPendingUi(
    replaceActivePlayer(state, {
      destination: null,
      path: [],
      pathIndex: 0
    })
  );
}

/**
 * Follow the precomputed A* waypoints. The reducer remains deterministic; no
 * per-frame collision solving and no sliding along invisible walls.
 */
export function advancePlayerMovement(currentState, deltaSeconds, now = Date.now()) {
  const player = getActivePlayer(currentState);
  if (!player) return currentState;

  const layout = WALK_LAYOUTS[player.currentScene];
  if (!layout) return currentState;
  if (!player.destination) return currentState;

  const path = Array.isArray(player.path) ? player.path : [];
  if (!path.length) return stopWithoutArrival(currentState);

  const delta = Math.min(
    Math.max(Number(deltaSeconds) || 0, 0),
    MAX_WALK_STEP_SECONDS
  );
  if (delta <= 0) return currentState;

  let index = Math.max(0, Math.min(path.length, Number(player.pathIndex) || 0));
  let x = player.position.x;
  let y = player.position.y;
  let remaining = layout.speed * delta;
  let movedX = 0;
  let movedY = 0;

  while (remaining > 0 && index < path.length) {
    const waypoint = path[index];
    const dx = waypoint.x - x;
    const dy = waypoint.y - y;
    const distance = Math.hypot(dx, dy);

    if (distance < 0.0001) {
      index += 1;
      continue;
    }

    const step = Math.min(distance, remaining);
    movedX += (dx / distance) * step;
    movedY += (dy / distance) * step;
    x += (dx / distance) * step;
    y += (dy / distance) * step;
    remaining -= step;

    if (step >= distance - 0.0001) {
      x = waypoint.x;
      y = waypoint.y;
      index += 1;
    }
  }

  if (Math.hypot(movedX, movedY) < 0.00001) {
    return stopWithoutArrival(currentState);
  }

  const arrived = index >= path.length;
  const nextFacing = facingFromDelta(movedX, movedY) ?? player.facing;
  let nextState = replaceActivePlayer(currentState, {
    position: { x, y },
    facing: nextFacing,
    destination: arrived ? null : player.destination,
    path: arrived ? [] : path,
    pathIndex: arrived ? 0 : index
  });

  if (arrived) {
    nextState = settlePendingArrival(nextState, player, now);
  }

  if (
    layout.emptyRoom &&
    !hasAnyDecor(currentState.world) &&
    !isInsideEmptyRoom(layout, player.position) &&
    isInsideEmptyRoom(layout, nextState.players[player.id].position)
  ) {
    nextState = withNotice(nextState, "还没装修", "empty");
    nextState = {
      ...nextState,
      ui: { ...nextState.ui, emptyRoomSeen: true }
    };
  }

  return nextState;
}
