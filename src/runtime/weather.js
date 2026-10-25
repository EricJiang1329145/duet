import { HOME_LOCATION } from "../config.js";
import {
  describeWeatherCode,
  isRainCode,
  isSunnyWeather,
  weatherLabel
} from "../game/weather.js";

export { isRainCode, isSunnyWeather, weatherLabel };

export function weatherCountdownText(state, now = Date.now()) {
  if (!state || state.status !== "ready") {
    return state?.status === "locating" ? "同步中" : "未同步";
  }
  if (!state.nextSunnyAt) {
    return state.mode === "sunny" ? "晴天" : "暂无晴天";
  }
  const remaining = Math.max(0, Number(state.nextSunnyAt) - Number(now));
  return state.mode === "sunny"
    ? `剩 ${toDuration(remaining)}`
    : `距晴 ${toDuration(remaining)}`;
}

const WEATHER_API = "https://api.open-meteo.com/v1/forecast";
const REFRESH_MS = 15 * 60 * 1000;
const ERROR_RETRY_MS = 60 * 1000;

function pad(value, size = 2) {
  return String(value).padStart(size, "0");
}

function toDuration(ms) {
  const total = Math.max(0, Math.floor(ms / 1000));
  const days = Math.floor(total / 86400);
  const hours = Math.floor((total % 86400) / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const seconds = total % 60;
  if (days > 0) return `${days}天 ${pad(hours)}:${pad(minutes)}`;
  return `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
}

export function createRealWeather({ onChange = null } = {}) {
  let state = {
    status: "idle",
    weatherId: null,
    label: "天气",
    temperature: null,
    isDay: true,
    rain: false,
    sunny: false,
    mode: "waiting",
    nextSunnyAt: null,
    updatedAt: 0,
    location: { ...HOME_LOCATION },
    error: null
  };
  let started = false;
  let refreshTimer = null;
  let tickTimer = null;

  function emit() {
    onChange?.({ ...state });
  }

  function update(patch) {
    state = { ...state, ...patch };
    emit();
  }

  function stopTimers() {
    if (refreshTimer) window.clearTimeout(refreshTimer);
    if (tickTimer) window.clearInterval(tickTimer);
    refreshTimer = null;
    tickTimer = null;
  }

  function parseForecast(data) {
    const current = data?.current ?? {};
    const hourly = data?.hourly ?? {};
    const daily = data?.daily ?? {};
    const code = Number(current.weather_code);
    const isDay = Number(current.is_day) === 1;
    const summary = describeWeatherCode(code, isDay);
    const now = Date.now();
    const times = Array.isArray(hourly.time) ? hourly.time : [];
    const codes = Array.isArray(hourly.weather_code)
      ? hourly.weather_code
      : [];
    const days = Array.isArray(hourly.is_day) ? hourly.is_day : [];
    const points = times
      .map((time, index) => ({
        at: Number(time) * 1000,
        code: Number(codes[index]),
        isDay: Number(days[index]) === 1
      }))
      .filter((point) => Number.isFinite(point.at) && point.at > now);

    let nextSunnyAt = null;
    let mode = "waiting";
    if (isSunnyWeather(code, isDay)) {
      mode = "sunny";
      const sunset = Number(daily.sunset?.[0]) * 1000;
      if (Number.isFinite(sunset) && sunset > now) {
        nextSunnyAt = sunset;
      } else {
        const nextChange = points.find(
          (point) => !isSunnyWeather(point.code, point.isDay)
        );
        nextSunnyAt = nextChange?.at ?? null;
      }
    } else {
      const next = points.find((point) =>
        isSunnyWeather(point.code, point.isDay)
      );
      nextSunnyAt = next?.at ?? null;
    }

    update({
      status: "ready",
      weatherId: summary.weatherId,
      label: summary.label,
      temperature: Number.isFinite(Number(current.temperature_2m))
        ? Math.round(Number(current.temperature_2m))
        : null,
      isDay,
      rain: summary.rain,
      sunny: summary.sunny,
      mode,
      nextSunnyAt,
      updatedAt: now,
      location: { ...HOME_LOCATION },
      error: null
    });
  }

  async function fetchForecast() {
    const url = new URL(WEATHER_API);
    url.searchParams.set("latitude", String(HOME_LOCATION.lat));
    url.searchParams.set("longitude", String(HOME_LOCATION.lon));
    url.searchParams.set(
      "current",
      "temperature_2m,weather_code,is_day"
    );
    url.searchParams.set("hourly", "weather_code,is_day");
    url.searchParams.set("daily", "sunset");
    url.searchParams.set("forecast_days", "3");
    // One fixed home time zone, and epoch timestamps so the countdown does not
    // depend on the device's local time zone.
    url.searchParams.set("timezone", HOME_LOCATION.timeZone);
    url.searchParams.set("timeformat", "unixtime");
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 8000);
    try {
      const response = await fetch(url, {
        headers: { accept: "application/json" },
        signal: controller.signal
      });
      if (!response.ok) throw new Error(`weather ${response.status}`);
      parseForecast(await response.json());
    } finally {
      clearTimeout(timer);
    }
  }

  async function refresh() {
    try {
      await fetchForecast();
    } catch (error) {
      update({ status: state.updatedAt ? "ready" : "error", error: error?.message });
    } finally {
      if (started) {
        refreshTimer = window.setTimeout(
          refresh,
          state.status === "error" ? ERROR_RETRY_MS : REFRESH_MS
        );
      }
    }
  }

  function start() {
    if (started) return;
    started = true;
    update({
      status: "locating",
      location: { ...HOME_LOCATION },
      error: null
    });
    void refresh();
    tickTimer = window.setInterval(() => emit(), 1000);
  }

  function stop() {
    started = false;
    stopTimers();
  }

  return {
    start,
    stop,
    refresh,
    getState: () => ({ ...state })
  };
}
