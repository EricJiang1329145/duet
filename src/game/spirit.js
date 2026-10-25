import { daylightAt } from "./daylight.js";

/**
 * The garden spirit is an ambient companion, not a simulated animal: it loafs
 * on the porch by day and folds into a sleepy seed at night. Its position is
 * derived from the shared clock, so both clients see the same little spirit
 * without any extra network traffic.
 */
export const SPIRIT_NAME = "团子";
export const SPIRIT_HOME = Object.freeze({ x: 2.65, y: -0.35 });

export function spiritPose(now = Date.now()) {
  const day = daylightAt(now);
  if (day.isNight) {
    return {
      x: SPIRIT_HOME.x,
      y: SPIRIT_HOME.y,
      sleeping: true,
      moving: false,
      facing: "south",
      phase: day.phase
    };
  }

  const t = (Number(now) || 0) / 1000;
  // A tiny sun-drift, always facing the fixed isometric camera.
  return {
    x: SPIRIT_HOME.x + Math.sin(t * 0.22) * 0.1,
    y: SPIRIT_HOME.y + Math.sin(t * 0.17 + 1.1) * 0.06,
    sleeping: false,
    moving: false,
    facing: "south",
    phase: day.phase
  };
}

export function spiritAffectionLabel() {
  return "团子";
}
