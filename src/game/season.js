import { SEASONS, WEATHERS } from "../config.js";

/**
 * Seasons and weather are derived from the clock, not stored in game state.
 * Both the local client and the room client use server-offset time, so they
 * read the same season without any network traffic.
 */
const SEASON_BY_MONTH = [
  "winter",
  "winter",
  "spring",
  "spring",
  "spring",
  "summer",
  "summer",
  "summer",
  "autumn",
  "autumn",
  "autumn",
  "winter"
];

const WEATHER_IDS = Object.keys(WEATHERS);

function hashDay(value) {
  let hash = 2166136261;
  const text = String(value ?? "");
  for (let i = 0; i < text.length; i += 1) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

// The house is fixed in Shenzhen (UTC+8, no DST). Daily gifts, meals and
// forage resets must follow the same local day as the weather/sunset HUD.
const HOME_OFFSET_MS = 8 * 60 * 60 * 1000;

function homeDate(now) {
  const date = new Date(Number(now) || 0);
  if (!Number.isFinite(date.getTime())) return null;
  return new Date(date.getTime() + HOME_OFFSET_MS);
}

export function getSeason(now = Date.now()) {
  const date = homeDate(now);
  if (!date) return SEASONS.spring;
  const month = date.getUTCMonth();
  return SEASONS[SEASON_BY_MONTH[month]] ?? SEASONS.spring;
}

export function getDayKey(now = Date.now()) {
  const date = homeDate(now);
  if (!date) return "";
  return date.toISOString().slice(0, 10);
}

export function getWeather(now = Date.now()) {
  const key = getDayKey(now);
  const roll = hashDay(`weather:${key}`) % 100;
  if (roll < 18) return WEATHERS.rain;
  if (roll < 48) return WEATHERS.cloudy;
  return WEATHERS.sunny;
}

export function getSeasonLabel(now = Date.now()) {
  return `${getSeason(now).label} · ${getWeather(now).label}`;
}

export function seasonTheme(now = Date.now()) {
  const season = getSeason(now);
  return {
    season: season.id,
    label: season.label,
    weather: getWeather(now).id,
    sky: season.sky,
    sun: season.sun,
    sunIntensity: season.sunIntensity,
    ambient: season.ambient,
    ambientIntensity: season.ambientIntensity
  };
}

export { WEATHER_IDS };
