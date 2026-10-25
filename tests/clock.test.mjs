import test from "node:test";
import assert from "node:assert/strict";

import {
  clockNow,
  getClockOffset,
  setClockOffset
} from "../src/runtime/clock.js";

test("the display clock starts at the local time", () => {
  setClockOffset(0);
  const before = Date.now();
  const now = clockNow();
  const after = Date.now();

  assert.ok(now >= before && now <= after);
});

test("a server offset shifts the display clock", () => {
  setClockOffset(4500);
  const before = Date.now();
  const now = clockNow();

  assert.equal(getClockOffset(), 4500);
  assert.ok(now >= before + 4500 && now <= before + 4500 + 1000);
});

test("negative offsets are supported and invalid values reset", () => {
  setClockOffset(-2500);
  assert.equal(getClockOffset(), -2500);

  setClockOffset(Number.NaN);
  assert.equal(getClockOffset(), 0);
  assert.ok(Math.abs(clockNow() - Date.now()) < 1000);
});
