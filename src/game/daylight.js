/**
 * Coarse local-time daylight curve. Everything is derived from the shared
 * display clock; no lighting values are written into game state or saves.
 */
function smoothstep(edge0, edge1, value) {
  const t = Math.min(1, Math.max(0, (value - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}

const HOME_OFFSET_MS = 8 * 60 * 60 * 1000;

export function daylightAt(now = Date.now()) {
  const date = new Date((Number(now) || 0) + HOME_OFFSET_MS);
  const hours = date.getUTCHours() + date.getUTCMinutes() / 60;
  const dawn = smoothstep(5.5, 7.5, hours);
  const dusk = 1 - smoothstep(17.5, 19.5, hours);
  const light = Math.min(1, Math.max(0, dawn * dusk));

  let phase = "night";
  let label = "夜晚";
  if (hours >= 5.5 && hours < 7.5) {
    phase = "dawn";
    label = "清晨";
  } else if (hours >= 7.5 && hours < 17.5) {
    phase = "day";
    label = "白天";
  } else if (hours >= 17.5 && hours < 19.5) {
    phase = "dusk";
    label = "黄昏";
  }

  return {
    hours,
    light,
    nightness: 1 - light,
    phase,
    label,
    isNight: phase === "night"
  };
}

export function daylightLabel(now = Date.now()) {
  return daylightAt(now).label;
}
