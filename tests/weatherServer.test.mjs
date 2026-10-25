import test from "node:test";
import assert from "node:assert/strict";
import { ACTION, PLAYER_ID, SCENE } from "../src/config.js";
import { createPlayerEntity } from "../src/game/player.js";
import { createEmptyPlots } from "../src/game/crop.js";
import { getWeather } from "../src/game/season.js";
import { validateFarmAction } from "../src/game/farmRules.js";
import { sanitizeWeather } from "../src/game/weather.js";
import { fetchHomeWeather, parseHomeWeather } from "../worker/src/weather.js";

function makeState(extra = {}) {
  return {
    players: {
      [PLAYER_ID]: createPlayerEntity({
        id: PLAYER_ID,
        name: "A",
        currentScene: SCENE.OUTDOOR,
        position: { x: 0, y: 0 },
        facing: "south"
      })
    },
    plots: createEmptyPlots(),
    stats: { harvested: 0, coins: 24, giftDay: "" },
    inventory: { seeds: { radish: 0, carrot: 0, tomato: 0 }, goods: {} },
    world: { greenhouse: false },
    ...extra
  };
}

function findWeather(rain) {
  for (let hour = 0; hour < 24 * 365; hour += 6) {
    const at = Date.UTC(2026, 0, 1) + hour * 60 * 60 * 1000;
    if ((getWeather(at).id === "rain") === rain) return at;
  }
  throw new Error("no matching pseudo weather");
}

test("Worker weather parser maps Shenzhen readings into the shared shape", () => {
  const parsed = parseHomeWeather(
    {
      current: {
        time: 1792868400,
        temperature_2m: 22.6,
        weather_code: 61,
        is_day: 1
      }
    },
    1234
  );
  assert.equal(parsed.label, "小雨");
  assert.equal(parsed.rain, true);
  assert.equal(parsed.weatherId, "rain");
  assert.equal(parsed.temperature, 23);
  assert.equal(parsed.at, 1792868400 * 1000);
  assert.equal(parsed.fetchedAt, 1234);
  assert.equal(parsed.location.name, "深圳");
});

test("the DO weather fetch uses fixed Shenzhen coordinates and time zone", async () => {
  let seen = null;
  const fakeFetch = async (url, options) => {
    seen = { url: String(url), options };
    return {
      ok: true,
      json: async () => ({
        current: {
          time: 1792868400,
          temperature_2m: 22.5,
          weather_code: 61,
          is_day: 1
        }
      })
    };
  };
  const weather = await fetchHomeWeather({ fetchImpl: fakeFetch, now: 123 });
  assert.equal(weather.weatherId, "rain");
  assert.equal(weather.at, 1792868400000);
  assert.match(seen.url, /latitude=22\.5431/);
  assert.match(seen.url, /longitude=114\.0579/);
  assert.match(seen.url, /timezone=Asia%2FShanghai/);
  assert.match(seen.url, /timeformat=unixtime/);
});

test("server weather sanitizer rejects malformed values and keeps defaults", () => {
  const clean = sanitizeWeather({
    rain: 1,
    sunny: 0,
    weatherId: "rain",
    label: "小雨",
    temperature: "22.7",
    at: 1000,
    fetchedAt: 1200,
    location: { name: "深圳", timeZone: "Asia/Shanghai" }
  });
  assert.equal(clean.rain, true);
  assert.equal(clean.temperature, 23);
  assert.equal(clean.location.name, "深圳");
  assert.equal(sanitizeWeather(null), null);
  assert.equal(sanitizeWeather({ label: 42 }).rain, false);
});

test("the authority weather overrides the legacy pseudo-weather for RAIN_WATER", () => {
  const rainAt = findWeather(true);
  const dryAt = findWeather(false);
  const base = makeState();

  assert.equal(
    validateFarmAction(base, PLAYER_ID, ACTION.RAIN_WATER, null, null, rainAt).ok,
    true
  );
  const dryAuthority = { ...base, weather: { rain: false } };
  assert.equal(
    validateFarmAction(
      dryAuthority,
      PLAYER_ID,
      ACTION.RAIN_WATER,
      null,
      null,
      rainAt
    ).code,
    "NOT_RAINING"
  );
  const wetAuthority = { ...base, weather: { rain: true } };
  assert.equal(
    validateFarmAction(
      wetAuthority,
      PLAYER_ID,
      ACTION.RAIN_WATER,
      null,
      null,
      dryAt
    ).ok,
    true
  );
  assert.equal(
    validateFarmAction(
      base,
      PLAYER_ID,
      ACTION.RAIN_WATER,
      null,
      { reportedRain: true },
      dryAt
    ).ok,
    true
  );
  const authorityNoWeather = { ...base, weatherAuthority: true };
  assert.equal(
    validateFarmAction(
      authorityNoWeather,
      PLAYER_ID,
      ACTION.RAIN_WATER,
      null,
      { reportedRain: true },
      dryAt
    ).code,
    "NOT_RAINING"
  );
  assert.equal(
    validateFarmAction(
      base,
      PLAYER_ID,
      ACTION.RAIN_WATER,
      null,
      null,
      dryAt
    ).code,
    "NOT_RAINING"
  );
});
