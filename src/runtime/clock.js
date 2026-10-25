/**
 * Display clock shared by UI and presentation. Single-player keeps offset 0;
 * room mode feeds the measured server offset so crop countdowns and growth
 * stages agree with the authoritative timestamps instead of the device clock.
 */
let offsetMs = 0;

export function setClockOffset(value) {
  const next = Number(value);
  offsetMs = Number.isFinite(next) ? next : 0;
  return offsetMs;
}

export function getClockOffset() {
  return offsetMs;
}

export function clockNow() {
  return Date.now() + offsetMs;
}
