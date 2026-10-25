import { HOME_LOCATION } from "../../src/config.js";
import { describeWeatherCode } from "../../src/game/weather.js";

const WEATHER_API = "https://api.open-meteo.com/v1/forecast";
const FETCH_TIMEOUT_MS = 5000;

/**
 * Normalize the current-weather part of an Open-Meteo response. Pure and
 * exported so the Worker mapping can be tested without network access.
 */
export function parseHomeWeather(data, now = Date.now()) {
  const current = data?.current ?? {};
  const code = Number(current.weather_code);
  const isDay = Number(current.is_day) === 1;
  const summary = describeWeatherCode(code, isDay);
  const at = Number(current.time) * 1000;
  const temperature = Number(current.temperature_2m);
  return {
    code,
    label: summary.label,
    rain: summary.rain,
    sunny: summary.sunny,
    weatherId: summary.weatherId,
    isDay,
    temperature: Number.isFinite(temperature) ? Math.round(temperature) : null,
    at: Number.isFinite(at) && at > 0 ? at : now,
    fetchedAt: now,
    location: {
      name: HOME_LOCATION.name,
      timeZone: HOME_LOCATION.timeZone
    }
  };
}

/**
 * The room authority's one real-world weather reading. The DO caches this for
 * a few minutes; it is deliberately not persisted so a hibernated room simply
 * fetches a fresh reading before the next rain action.
 */
export async function fetchHomeWeather({
  fetchImpl = fetch,
  now = Date.now()
} = {}) {
  const url = new URL(WEATHER_API);
  url.searchParams.set("latitude", String(HOME_LOCATION.lat));
  url.searchParams.set("longitude", String(HOME_LOCATION.lon));
  url.searchParams.set("current", "temperature_2m,weather_code,is_day");
  url.searchParams.set("timezone", HOME_LOCATION.timeZone);
  url.searchParams.set("timeformat", "unixtime");

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const response = await fetchImpl(url, {
      headers: { accept: "application/json" },
      signal: controller.signal
    });
    if (!response.ok) throw new Error(`weather ${response.status}`);
    return parseHomeWeather(await response.json(), now);
  } finally {
    clearTimeout(timer);
  }
}
