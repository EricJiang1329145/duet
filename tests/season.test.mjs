import test from "node:test";
import assert from "node:assert/strict";
import {
  getDayKey,
  getSeason,
  getSeasonLabel,
  getWeather,
  seasonTheme
} from "../src/game/season.js";

const at = (month) => new Date(2026, month, 15, 12, 0, 0).getTime();

test("seasons follow the calendar month", () => {
  assert.equal(getSeason(at(2)).id, "spring");
  assert.equal(getSeason(at(5)).id, "summer");
  assert.equal(getSeason(at(8)).id, "autumn");
  assert.equal(getSeason(at(11)).id, "winter");
});

test("weather is deterministic for a given day", () => {
  const day = at(9);
  assert.equal(getWeather(day), getWeather(day + 60 * 60 * 1000));
  assert.ok(["sunny", "cloudy", "rain"].includes(getWeather(day).id));
  assert.match(getSeasonLabel(day), /^秋 · /);
});

test("seasonTheme exposes the light and sky palette", () => {
  const theme = seasonTheme(at(5));
  assert.equal(theme.season, "summer");
  assert.equal(theme.weather, getWeather(at(5)).id);
  assert.equal(Array.isArray(theme.sky), true);
  assert.equal(typeof theme.sun, "number");
  assert.ok(theme.sunIntensity > 0);
});

test("day keys use the fixed Shenzhen date so rooms agree", () => {
  assert.equal(getDayKey(Date.UTC(2026, 9, 24, 1, 0, 0)), "2026-10-24");
  assert.equal(getDayKey(Date.UTC(2026, 9, 24, 17, 0, 0)), "2026-10-25");
});
