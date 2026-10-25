import test from "node:test";
import assert from "node:assert/strict";
import {
  isRainCode,
  isSunnyWeather,
  weatherCountdownText,
  weatherLabel
} from "../src/runtime/weather.js";

test("WMO weather codes map to readable labels and rain/sunny buckets", () => {
  assert.equal(weatherLabel(0), "晴");
  assert.equal(weatherLabel(61), "小雨");
  assert.equal(isRainCode(61), true);
  assert.equal(isRainCode(3), false);
  assert.equal(isSunnyWeather(0, 1), true);
  assert.equal(isSunnyWeather(1, 0), false);
});

test("sunny countdown shows remaining daylight and time to next sunny", () => {
  const now = 1_000_000;
  assert.equal(
    weatherCountdownText(
      { status: "ready", mode: "sunny", nextSunnyAt: now + 3_661_000 },
      now
    ),
    "剩 01:01:01"
  );
  assert.equal(
    weatherCountdownText(
      { status: "ready", mode: "waiting", nextSunnyAt: now + 90_061_000 },
      now
    ),
    "距晴 1天 01:01"
  );
  assert.equal(
    weatherCountdownText({ status: "error" }, now),
    "未同步"
  );
});
