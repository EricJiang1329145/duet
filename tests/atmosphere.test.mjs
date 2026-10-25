import test from "node:test";
import assert from "node:assert/strict";
import { daylightAt } from "../src/game/daylight.js";
import { SPIRIT_NAME, spiritPose } from "../src/game/spirit.js";

function localTime(hour) {
  return new Date(2026, 0, 1, hour, 0, 0, 0).getTime();
}

test("daylight has readable dawn, day, dusk and night phases", () => {
  assert.equal(daylightAt(localTime(6)).phase, "dawn");
  assert.equal(daylightAt(localTime(12)).phase, "day");
  assert.equal(daylightAt(localTime(18)).phase, "dusk");
  assert.equal(daylightAt(localTime(23)).phase, "night");
  assert.equal(daylightAt(localTime(12)).light, 1);
  assert.equal(daylightAt(localTime(23)).isNight, true);
});

test("the garden spirit loafs by day and sleeps at night", () => {
  assert.equal(SPIRIT_NAME, "团子");
  const day = spiritPose(localTime(12));
  assert.equal(day.sleeping, false);
  assert.ok(Number.isFinite(day.x));
  assert.ok(Number.isFinite(day.y));

  const night = spiritPose(localTime(23));
  assert.equal(night.sleeping, true);
  assert.equal(night.x, 2.65);
  assert.equal(night.y, -0.35);
});

test("spirit pose is deterministic for the same shared timestamp", () => {
  const at = localTime(12);
  assert.deepEqual(spiritPose(at), spiritPose(at));
});
