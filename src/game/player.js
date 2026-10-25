/**
 * Player records are serializable game data except for the non-enumerable
 * network interpolation hook. The required public fields are always present.
 */
function sanitizeActivity(activity) {
  if (!activity || typeof activity !== "object") return null;
  if (
    activity.kind !== "swing" &&
    activity.kind !== "seesaw" &&
    activity.kind !== "sleep" &&
    activity.kind !== "work" &&
    activity.kind !== "sofa" &&
    activity.kind !== "meal"
  ) {
    return null;
  }

  const since = Number(activity.since);
  if (activity.kind === "sleep") {
    return {
      kind: "sleep",
      bedId: activity.bedId === "B" ? "B" : "A",
      since: Number.isFinite(since) ? since : 0
    };
  }

  if (activity.kind === "work") {
    const slot = Number(activity.slot);
    return {
      kind: "work",
      studyId: activity.studyId === "study_b" ? "study_b" : "study_a",
      slot: Number.isFinite(slot) ? Math.max(0, Math.min(1, Math.floor(slot))) : 0,
      since: Number.isFinite(since) ? since : 0
    };
  }

  if (activity.kind === "sofa") {
    const slot = Number(activity.slot);
    return {
      kind: "sofa",
      slot: Number.isFinite(slot) ? Math.max(0, Math.min(1, Math.floor(slot))) : 0,
      since: Number.isFinite(since) ? since : 0
    };
  }

  if (activity.kind === "meal") {
    const slot = Number(activity.slot);
    return {
      kind: "meal",
      slot: Number.isFinite(slot) ? Math.max(0, Math.min(1, Math.floor(slot))) : 0,
      since: Number.isFinite(since) ? since : 0
    };
  }
  if (activity.kind === "swing") {
    const slot = Number(activity.slot);
    return {
      kind: "swing",
      slot: Number.isFinite(slot) ? Math.max(0, Math.min(1, Math.floor(slot))) : 0,
      since: Number.isFinite(since) ? since : 0
    };
  }

  const side = activity.side === "b" ? "b" : "a";
  return {
    kind: "seesaw",
    side,
    since: Number.isFinite(since) ? since : 0
  };
}

function sanitizePath(path) {
  if (!Array.isArray(path)) return [];
  return path
    .map((point) => ({ x: Number(point?.x), y: Number(point?.y) }))
    .filter((point) => Number.isFinite(point.x) && Number.isFinite(point.y));
}

export function createPlayerEntity(data) {
  const destination = data.destination
    ? { x: data.destination.x, y: data.destination.y }
    : null;
  const path = destination ? sanitizePath(data.path) : [];
  const rawIndex = Number(data.pathIndex);
  const player = {
    id: data.id,
    name: data.name,
    currentScene: data.currentScene,
    position: { x: data.position.x, y: data.position.y },
    facing: data.facing,
    destination,
    path,
    pathIndex:
      destination && Number.isFinite(rawIndex)
        ? Math.max(0, Math.min(path.length, Math.floor(rawIndex)))
        : 0,
    activity: sanitizeActivity(data.activity)
  };

  // Reserved for the future multiplayer client. It is intentionally a no-op
  // now: a network adapter will write an interpolation target here later. The
  // property is non-enumerable so JSON snapshots stay plain data.
  Object.defineProperty(player, "setRemoteTarget", {
    value: function setRemoteTarget(x, y) {
      void x;
      void y;
    },
    enumerable: false,
    writable: false,
    configurable: false
  });

  return player;
}

export function getActivePlayer(currentState) {
  return currentState.players[currentState.activePlayerId] ?? null;
}

export function playerIsMoving(player) {
  return Boolean(player?.destination);
}

export function replacePlayer(currentState, playerId, patch) {
  const oldPlayer = currentState.players?.[playerId];
  if (!oldPlayer) return currentState;

  const destination = Object.prototype.hasOwnProperty.call(patch, "destination")
    ? patch.destination
      ? { x: patch.destination.x, y: patch.destination.y }
      : null
    : oldPlayer.destination;

  const activity = Object.prototype.hasOwnProperty.call(patch, "activity")
    ? sanitizeActivity(patch.activity)
    : oldPlayer.activity;

  let path = oldPlayer.path ?? [];
  let pathIndex = oldPlayer.pathIndex ?? 0;
  if (Object.prototype.hasOwnProperty.call(patch, "path")) {
    path = sanitizePath(patch.path);
    pathIndex = Number(patch.pathIndex) || 0;
  } else if (!destination) {
    path = [];
    pathIndex = 0;
  } else if (
    Object.prototype.hasOwnProperty.call(patch, "destination") &&
    (!oldPlayer.destination ||
      oldPlayer.destination.x !== destination.x ||
      oldPlayer.destination.y !== destination.y)
  ) {
    // A new destination without a path would reuse stale waypoints.
    path = [];
    pathIndex = 0;
  }

  const nextPlayer = createPlayerEntity({
    ...oldPlayer,
    ...patch,
    position: patch.position
      ? { x: patch.position.x, y: patch.position.y }
      : oldPlayer.position,
    destination,
    path,
    pathIndex,
    activity
  });

  return {
    ...currentState,
    players: {
      ...currentState.players,
      [oldPlayer.id]: nextPlayer
    }
  };
}

export function replaceActivePlayer(currentState, patch) {
  const player = getActivePlayer(currentState);
  if (!player) return currentState;
  return replacePlayer(currentState, player.id, patch);
}

export function withNotice(currentState, text, tone = "info") {
  const id = currentState.ui.nextNoticeId;
  return {
    ...currentState,
    ui: {
      ...currentState.ui,
      nextNoticeId: id + 1,
      notice: { id, text, tone }
    }
  };
}

export function withoutNotice(currentState) {
  if (!currentState.ui.notice) return currentState;
  return {
    ...currentState,
    ui: { ...currentState.ui, notice: null }
  };
}

export function clearPlotSelection(currentState) {
  if (!currentState.ui.selectedPlotId) return currentState;
  return {
    ...currentState,
    ui: { ...currentState.ui, selectedPlotId: null }
  };
}

export function stopActiveMovement(currentState) {
  const player = getActivePlayer(currentState);
  if (!player?.destination && !(player?.path?.length > 0)) return currentState;
  return replaceActivePlayer(currentState, { destination: null, path: [] });
}

export function moveActivePlayer(currentState, currentScene, position, facing) {
  let next = replaceActivePlayer(currentState, {
    currentScene,
    position: { x: position.x, y: position.y },
    facing,
    destination: null,
    path: [],
    pathIndex: 0,
    activity: null
  });

  next = withoutNotice(next);
  next = clearPlotSelection(next);
  // Kitchen cooking is an indoor modal; leaving the floor must dismiss it.
  next = { ...next, ui: { ...next.ui, kitchenOpen: false } };
  return next;
}
