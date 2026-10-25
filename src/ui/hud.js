import { ROOM_MAX_PLAYERS, SCENE, SCENE_META } from "../config.js";
import { getActivePlayer } from "../game/player.js";
import { countDecor } from "../game/world.js";
import { weatherCountdownText } from "../runtime/weather.js";

/**
 * HUD reads state and updates DOM. It never dispatches.
 */
export function createHud() {
  const sceneCodeEl = document.getElementById("scene-code");
  const sceneTitleEl = document.getElementById("scene-title");
  const coinCountEl = document.getElementById("coin-count");
  const weatherPillEl = document.getElementById("weather-pill");
  const weatherLabelEl = document.getElementById("weather-label");
  const weatherCountEl = document.getElementById("weather-count");
  const hintTextEl = document.getElementById("hint-text");
  const roomPillEl = document.getElementById("room-pill");
  const roomCountEl = document.getElementById("room-count");
  const toastEl = document.getElementById("toast");
  const themeColorMeta = document.querySelector('meta[name="theme-color"]');

  function showToast(notice) {
    toastEl.textContent = notice.text;
    toastEl.dataset.tone = notice.tone || "info";
    toastEl.classList.add("is-visible");
  }

  function hideToast() {
    toastEl.classList.remove("is-visible");
  }

  function setWeather(weather) {
    if (!weatherPillEl || !weatherLabelEl || !weatherCountEl) return;
    const ready = weather?.status === "ready";
    const locating =
      weather?.status === "locating" || weather?.status === "idle";
    const place = weather?.location?.name || "深圳";
    weatherLabelEl.textContent = ready
      ? `${weather.label}${
          Number.isFinite(weather.temperature) ? ` ${weather.temperature}°` : ""
        }`
      : locating
        ? "同步中"
        : "天气未同步";
    weatherCountEl.textContent = ready ? weatherCountdownText(weather) : "";
    weatherPillEl.dataset.state = ready
      ? weather.rain
        ? "rain"
        : weather.sunny
          ? "sunny"
          : "cloudy"
      : locating
        ? "locating"
        : "error";
    weatherPillEl.dataset.place = place;
    weatherPillEl.title = ready
      ? `${place}天气 · ${
          weather.mode === "sunny"
            ? "晴天剩余时间（按当地日落）"
            : "距离下一个晴天"
        }`
      : locating
        ? `正在同步${place}天气`
        : `${place}天气暂时未同步`;
  }

  function sync(currentState, previousState = null) {
    const player = getActivePlayer(currentState);
    if (!player) return;

    const meta = SCENE_META[player.currentScene];
    sceneCodeEl.textContent = meta.code;
    sceneTitleEl.textContent = meta.title;
    const decorCount = countDecor(currentState.world);
    hintTextEl.textContent =
      player.currentScene === SCENE.INDOOR_2
        ? decorCount > 0
          ? `二层 · 已添置 ${decorCount} 件｜点装修牌继续添置`
          : currentState.ui.emptyRoomSeen
            ? "空房间 · 点装修牌添置家具"
            : meta.hint
        : meta.hint;
    if (coinCountEl) {
      coinCountEl.textContent = String(
        Math.max(0, Math.floor(Number(currentState.stats?.coins) || 0))
      );
    }

    const room = currentState.room;
    if (roomPillEl) {
      roomPillEl.hidden = !room;
      if (room) {
        const reconnecting =
          room.role === "reconnecting" || room.role === "connecting";
        roomCountEl.textContent =
          room.role === "rejected"
            ? room.code === "IDLE"
              ? "已断开"
              : "已满"
            : room.role === "reconnecting"
              ? "重连中"
              : room.role === "connecting"
                ? "连接中"
                : `${Object.keys(currentState.players).length}/${ROOM_MAX_PLAYERS}`;
        roomPillEl.dataset.state = reconnecting ? "offline" : room.role;
        const rtt = Number(room.rtt);
        roomPillEl.title =
          room.role === "server"
            ? `已连接${Number.isFinite(rtt) ? ` · ${rtt}ms` : ""}`
            : room.role === "reconnecting"
              ? "连接中断，正在重连…"
              : room.role === "rejected"
                ? "房间已满"
                : "正在加入房间…";
      }
    }
    document.documentElement.dataset.scene = player.currentScene;
    if (themeColorMeta) {
      themeColorMeta.setAttribute(
        "content",
        player.currentScene === SCENE.OUTDOOR
          ? "#e7efdc"
          : player.currentScene === SCENE.INDOOR_1
            ? "#efd9c5"
            : "#e7dccd"
      );
    }

    const previousNoticeId = previousState?.ui.notice?.id ?? null;
    const notice = currentState.ui.notice;
    if (notice) {
      if ((notice.id ?? null) !== previousNoticeId) showToast(notice);
    } else {
      // The deferred HUD sync after a scene transition has no previousState;
      // still hide a toast that was cleared while the curtain was down.
      hideToast();
    }
  }

  return { sync, setWeather };
}
