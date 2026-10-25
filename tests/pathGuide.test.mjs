import test from "node:test";
import assert from "node:assert/strict";
import { samplePathPoints } from "../src/game/pathSamples.js";

test("a straight path is resampled into evenly spaced dots", () => {
  const dots = samplePathPoints(
    [{ x: 0, y: 0 }, { x: 1, y: 0 }],
    { spacing: 0.25, start: 0.1, end: 0.1 }
  );
  assert.equal(dots.length, 4);
  for (let i = 1; i < dots.length; i += 1) {
    assert.ok(Math.abs(dots[i].x - dots[i - 1].x - 0.25) < 1e-6);
  }
  assert.equal(dots[0].y, 0);
});

test("dots follow a bend instead of cutting the corner", () => {
  const dots = samplePathPoints(
    [
      { x: 0, y: 0 },
      { x: 1, y: 0 },
      { x: 1, y: 1 }
    ],
    { spacing: 0.2, start: 0.1, end: 0.1 }
  );
  assert.ok(dots.length > 5);
  for (const dot of dots) {
    const onFirst = Math.abs(dot.y) < 1e-6 && dot.x <= 1.000001;
    const onSecond = Math.abs(dot.x - 1) < 1e-6 && dot.y >= -1e-6;
    assert.ok(onFirst || onSecond);
  }
});

test("short paths and bad input do not emit dots", () => {
  assert.deepEqual(samplePathPoints([], {}), []);
  assert.deepEqual(samplePathPoints([{ x: 0, y: 0 }], {}), []);
  assert.deepEqual(
    samplePathPoints([{ x: 0, y: 0 }, { x: 0.1, y: 0 }], { start: 0.2, end: 0.2 }),
    []
  );
});

test("the guide respects the dot cap", () => {
  const dots = samplePathPoints(
    [{ x: 0, y: 0 }, { x: 100, y: 0 }],
    { spacing: 0.3, start: 0, end: 0, max: 12 }
  );
  assert.equal(dots.length, 12);
});
