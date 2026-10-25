import { PLAYGROUND, PLAYER_RADIUS } from "../config.js";
import { replacePlayer } from "./player.js";

const SEAT_KINDS = new Set(["swing", "seesaw"]);

export function isSeated(player) {
  return Boolean(player?.activity && SEAT_KINDS.has(player.activity.kind));
}

export function getActivity(player) {
  const activity = player?.activity;
  if (!activity || !SEAT_KINDS.has(activity.kind)) return null;
  return activity;
}

export function distanceToProp(player, kind) {
  const prop = PLAYGROUND[kind];
  const anchor = prop?.seat ?? prop?.pivot;
  if (!anchor) return Infinity;
  return Math.hypot(player.position.x - anchor.x, player.position.y - anchor.y);
}

export function swingersFrom(players) {
  return (players ?? []).filter(
    (player) => getActivity(player)?.kind === "swing"
  );
}

export function seesawRidersFrom(players) {
  return (players ?? []).filter(
    (player) => getActivity(player)?.kind === "seesaw"
  );
}

export function availableSwingSlot(state, exceptPlayerId = null) {
  const taken = new Set(
    swingersFrom(Object.values(state.players ?? {}))
      .filter((player) => player.id !== exceptPlayerId)
      .map((player) => getActivity(player).slot)
  );
  for (const seat of PLAYGROUND.swing.seats) {
    if (!taken.has(seat.slot)) return seat.slot;
  }
  return null;
}

export function seesawSides(state, exceptPlayerId = null) {
  const sides = { a: null, b: null };
  for (const player of Object.values(state.players ?? {})) {
    if (player.id === exceptPlayerId) continue;
    const activity = getActivity(player);
    if (activity?.kind === "seesaw" && (activity.side === "a" || activity.side === "b")) {
      sides[activity.side] = player;
    }
  }
  return sides;
}

/**
 * Decide whether a seat can be taken right now.
 * Returns `{ ok:true, ...slotInfo }`, `{ ok:false, code }`, or a special
 * `{ ok:false, code:"TOO_FAR", stand }` so the reducer can walk over first.
 */
export function validateSeat(state, playerId, kind, payload = null) {
  const player = state.players?.[playerId];
  if (!player) return { ok: false, code: "NO_PLAYER" };

  const prop = PLAYGROUND[kind];
  if (!prop) return { ok: false, code: "NO_SEAT" };

  const current = getActivity(player);
  if (current?.kind === kind) return { ok: true, stand: true };

  if (distanceToProp(player, kind) > prop.walkRadius) {
    const stand =
      kind === "seesaw"
        ? (prop.ends.find((end) => end.side === payload?.side) ?? prop.ends[0])
            .stand
        : prop.stand;
    return { ok: false, code: "TOO_FAR", stand };
  }

  if (kind === "swing") {
    const slot = availableSwingSlot(state, playerId);
    if (slot === null) return { ok: false, code: "SEAT_TAKEN" };
    return { ok: true, kind, slot };
  }

  const sides = seesawSides(state, playerId);
  const wanted = payload?.side === "a" || payload?.side === "b" ? payload.side : null;
  if (wanted) {
    if (sides[wanted]) return { ok: false, code: "SEAT_TAKEN" };
    return { ok: true, kind, side: wanted };
  }
  if (!sides.a) return { ok: true, kind, side: "a" };
  if (!sides.b) return { ok: true, kind, side: "b" };
  return { ok: false, code: "SEAT_TAKEN" };
}

function seatAnchor(kind, info) {
  if (kind === "swing") {
    const seat =
      PLAYGROUND.swing.seats.find((item) => item.slot === info.slot) ??
      PLAYGROUND.swing.seats[0];
    return { x: seat.x, y: seat.y, facing: "south" };
  }
  const end =
    PLAYGROUND.seesaw.ends.find((item) => item.side === info.side) ??
    PLAYGROUND.seesaw.ends[0];
  return {
    x: end.x,
    y: end.y,
    facing: end.side === "a" ? "east" : "west"
  };
}

export function sitPlayer(state, playerId, info, now = Date.now()) {
  const player = state.players?.[playerId];
  if (!player || !info?.ok) return state;

  const anchor = seatAnchor(info.kind, info);
  const activity =
    info.kind === "swing"
      ? { kind: "swing", slot: info.slot, since: now }
      : { kind: "seesaw", side: info.side, since: now };

  return replacePlayer(state, playerId, {
    position: { x: anchor.x, y: anchor.y },
    facing: anchor.facing,
    destination: null,
    activity
  });
}

export function standPlayer(state, playerId) {
  const player = state.players?.[playerId];
  const activity = getActivity(player);
  if (!activity) return state;

  const prop = PLAYGROUND[activity.kind];
  const end =
    activity.kind === "seesaw"
      ? prop.ends.find((item) => item.side === activity.side)
      : null;
  const stand = end?.stand ?? prop?.stand ?? player.position;
  return replacePlayer(state, playerId, {
    position: { x: stand.x, y: stand.y },
    destination: null,
    activity: null
  });
}

export function clearActivity(state, playerId) {
  const player = state.players?.[playerId];
  if (!getActivity(player)) return state;
  return replacePlayer(state, playerId, { activity: null });
}

export const SEAT_TEXT = Object.freeze({
  SEAT_TAKEN: "这里已经坐满了。",
  TOO_FAR: "先走到旁边再坐下。",
  NO_SEAT: "这里坐不了。"
});

/**
 * Swing phase shared by both clients. It only depends on the shared `since`
 * timestamp and the clock, not on a realtime stream.
 */
export function swingMotion(players, now = Date.now()) {
  const swingers = swingersFrom(players);
  if (!swingers.length) {
    return { angle: Math.sin(now / 1800) * 0.05, count: 0, since: now };
  }
  const since = Math.min(
    ...swingers.map((player) => Number(getActivity(player).since) || 0)
  );
  const amplitude =
    swingers.length >= 2
      ? PLAYGROUND.swing.duoAmplitude
      : PLAYGROUND.swing.amplitude;
  const phase = ((now - since) / PLAYGROUND.swing.periodMs) * Math.PI * 2;
  return { angle: Math.sin(phase) * amplitude, count: swingers.length, since };
}

/**
 * Seesaw tilt: two riders oscillate, one rider rests on their side, nobody
 * leaves it almost level with a tiny idle sway.
 */
export function seesawMotion(players, now = Date.now()) {
  const riders = seesawRidersFrom(players);
  const sides = { a: 0, b: 0 };
  let since = now;
  for (const rider of riders) {
    const activity = getActivity(rider);
    if (activity.side === "a") sides.a += 1;
    if (activity.side === "b") sides.b += 1;
    since = Math.min(since, Number(activity.since) || now);
  }

  const both = sides.a > 0 && sides.b > 0;
  const one = !both && (sides.a > 0 || sides.b > 0);
  let angle = 0;
  if (both) {
    const phase = ((now - since) / PLAYGROUND.seesaw.periodMs) * Math.PI * 2;
    angle = Math.sin(phase) * 0.2;
  } else if (one) {
    angle = sides.a > 0 ? -PLAYGROUND.seesaw.restAngle : PLAYGROUND.seesaw.restAngle;
  } else {
    angle = Math.sin(now / 2400) * 0.014;
  }
  return { angle, sides, both, one };
}

export function seatPoseFor(player) {
  const activity = getActivity(player);
  if (!activity) return null;
  const anchor = seatAnchor(activity.kind, activity);
  return {
    kind: activity.kind,
    slot: activity.slot ?? null,
    side: activity.side ?? null,
    x: anchor.x,
    y: anchor.y,
    facing: anchor.facing
  };
}

export function seatRadius() {
  return PLAYER_RADIUS;
}
