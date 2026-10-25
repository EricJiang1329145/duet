/**
 * Pure presence throttling decision. Moving players are sent at the 10Hz
 * sampling rate; an unchanged player only sends an idle heartbeat, which keeps
 * the Durable Object quiet when both people are standing still.
 */
export const PRESENCE_MIN_GAP_MS = 45;
export const PRESENCE_IDLE_INTERVAL_MS = 5000;

export function presenceSignature(payload) {
  const position = payload?.position ?? { x: 0, y: 0 };
  const destination = payload?.destination;
  const goal = destination
    ? `${Number(destination.x ?? 0).toFixed(3)},${Number(destination.y ?? 0).toFixed(3)}`
    : "";
  return [
    payload?.currentScene ?? "",
    payload?.facing ?? "",
    Number(position.x ?? 0).toFixed(3),
    Number(position.y ?? 0).toFixed(3),
    goal,
    payload?.name ?? ""
  ].join("|");
}

export function shouldSendPresence({
  force = false,
  signature,
  lastSignature = "",
  now,
  lastSentAt = 0,
  minGapMs = PRESENCE_MIN_GAP_MS,
  idleIntervalMs = PRESENCE_IDLE_INTERVAL_MS
}) {
  if (force) return true;

  const changed = signature !== lastSignature;
  const gap = now - lastSentAt;
  if (!changed && gap < idleIntervalMs) return false;
  if (changed && gap < minGapMs) return false;
  return true;
}
