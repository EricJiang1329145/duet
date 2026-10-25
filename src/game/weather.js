/**
 * WMO weather-code mapping shared by the browser, the Worker weather cache and
 * tests. Pure: no DOM, no timers, no storage.
 */
const WEATHER_TEXT = Object.freeze({
  0: "晴",
  1: "晴间多云",
  2: "多云",
  3: "阴",
  45: "有雾",
  48: "雾凇",
  51: "毛毛雨",
  53: "细雨",
  55: "密雨",
  56: "冻毛雨",
  57: "冻雨",
  61: "小雨",
  63: "中雨",
  65: "大雨",
  66: "冻雨",
  67: "强冻雨",
  71: "小雪",
  73: "中雪",
  75: "大雪",
  77: "米雪",
  80: "阵雨",
  81: "强阵雨",
  82: "暴雨",
  85: "阵雪",
  86: "强阵雪",
  95: "雷雨",
  96: "雷雨冰雹",
  99: "强雷雨冰雹"
});

export function weatherLabel(code) {
  return WEATHER_TEXT[Number(code)] ?? "天气";
}

export function isRainCode(code) {
  const value = Number(code);
  return (
    (value >= 51 && value <= 67) ||
    (value >= 80 && value <= 82) ||
    value >= 95
  );
}

export function isSunnyWeather(code, isDay = true) {
  return Number(isDay) === 1 && (Number(code) === 0 || Number(code) === 1);
}

export function describeWeatherCode(code, isDay = true) {
  const value = Number(code);
  const rain = isRainCode(value);
  // Clear sky at night still reads as "晴" in the HUD; only daytime clear
  // weather counts toward the next-sunny countdown (handled by the caller).
  const sunny = value === 0 || value === 1;
  return {
    code: value,
    label: weatherLabel(value),
    rain,
    sunny,
    weatherId: rain ? "rain" : sunny ? "sunny" : "cloudy",
    isDay: Number(isDay) === 1
  };
}

/**
 * Defensive copy of a server-provided weather slice. The room authority owns
 * the data, but the client still avoids trusting arbitrary objects for UI.
 */
export function sanitizeWeather(raw) {
  if (!raw || typeof raw !== "object") return null;
  const rain = typeof raw.rain === "boolean"
    ? raw.rain
    : raw.weatherId === "rain" || isRainCode(raw.code);
  const sunny = typeof raw.sunny === "boolean"
    ? raw.sunny
    : isSunnyWeather(raw.code, raw.isDay);
  const weatherId = ["rain", "sunny", "cloudy"].includes(raw.weatherId)
    ? raw.weatherId
    : rain
      ? "rain"
      : sunny
        ? "sunny"
        : "cloudy";
  const label =
    typeof raw.label === "string" && raw.label.trim()
      ? raw.label.trim().slice(0, 12)
      : weatherLabel(raw.code);
  const temperature = Number(raw.temperature);
  const at = Number(raw.at);
  const fetchedAt = Number(raw.fetchedAt);
  return {
    code: Number.isFinite(Number(raw.code)) ? Number(raw.code) : null,
    label,
    rain,
    sunny,
    weatherId,
    isDay: Boolean(raw.isDay),
    temperature: Number.isFinite(temperature) ? Math.round(temperature) : null,
    at: Number.isFinite(at) && at > 0 ? at : 0,
    fetchedAt: Number.isFinite(fetchedAt) && fetchedAt > 0 ? fetchedAt : 0,
    location: {
      name:
        typeof raw.location?.name === "string" && raw.location.name.trim()
          ? raw.location.name.trim().slice(0, 12)
          : "深圳",
      timeZone:
        typeof raw.location?.timeZone === "string"
          ? raw.location.timeZone.slice(0, 64)
          : ""
    }
  };
}
