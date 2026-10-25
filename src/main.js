import * as THREE from "three";
import {
  ACTION,
  CAMERA_RIG,
  CHARACTERS,
  DEFAULT_ROOM_ID,
  INPUT,
  LIGHTING,
  SCENE,
  SOLO_PARAM,
  characterNameFor
} from "./config.js";
import { createInitialState } from "./game/initialState.js";
import { getActivePlayer, playerIsMoving } from "./game/player.js";
import { daylightAt } from "./game/daylight.js";
import { getWeather, seasonTheme } from "./game/season.js";
import { hasUnwateredRainCrops } from "./game/crop.js";
import { createScenePointer } from "./input/scenePointer.js";
import { readFarmSave } from "./persistence/farmSave.js";
import { createPresentation } from "./render/presentation.js";
import { clockNow } from "./runtime/clock.js";
import { createGameSession } from "./runtime/session.js";
import { createBoardPanel } from "./ui/boardPanel.js";
import { createChatPanel } from "./ui/chat.js";
import { createDecorPanel } from "./ui/decorPanel.js";
import { createFarmPanel } from "./ui/farmPanel.js";
import { createHud } from "./ui/hud.js";
import { createKitchenPanel } from "./ui/kitchenPanel.js";
import { createMinimap } from "./ui/minimap.js";
import { createPanel } from "./ui/panel.js";
import { createRoomFull } from "./ui/roomFull.js";
import { createSceneFade } from "./ui/sceneFade.js";
import { createAmbience } from "./audio/ambience.js";
import { createRealWeather } from "./runtime/weather.js";
import { createShopPanel } from "./ui/shopPanel.js";

const stageEl = document.getElementById("stage");
const labelLayerEl = document.getElementById("label-layer");
const bootEl = document.getElementById("boot");

// ---------------------------------------------------------------------------
// Renderer and fixed isometric camera
// ---------------------------------------------------------------------------
const renderer = new THREE.WebGLRenderer({
  antialias: true,
  alpha: true,
  powerPreference: "high-performance"
});
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight, false);
renderer.shadowMap.enabled = false;
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.setClearColor(0x000000, 0);
renderer.domElement.setAttribute("role", "img");
renderer.domElement.setAttribute(
  "aria-label",
  "等距视角游戏场景。轻点场景中的田地、门、留言板或楼梯进行互动。"
);
stageEl.appendChild(renderer.domElement);

const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 200);
const cameraTarget = new THREE.Vector3(
  CAMERA_RIG.target.x,
  CAMERA_RIG.target.y,
  CAMERA_RIG.target.z
);
const cameraOffset = new THREE.Vector3(
  CAMERA_RIG.offset.x,
  CAMERA_RIG.offset.y,
  CAMERA_RIG.offset.z
);
camera.position.copy(cameraTarget).add(cameraOffset);
camera.lookAt(cameraTarget);

function projectToScreen(x, y, z) {
  const point = new THREE.Vector3(x, y, z).project(camera);
  return {
    x: (point.x * 0.5 + 0.5) * window.innerWidth,
    y: (-point.y * 0.5 + 0.5) * window.innerHeight
  };
}

// Exactly one directional light and one ambient light, shared by both scenes.
const sunLight = new THREE.DirectionalLight(
  LIGHTING.sun.color,
  LIGHTING.sun.intensity
);
sunLight.position.set(
  LIGHTING.sun.position.x,
  LIGHTING.sun.position.y,
  LIGHTING.sun.position.z
);
sunLight.target.position.set(
  LIGHTING.sun.target.x,
  LIGHTING.sun.target.y,
  LIGHTING.sun.target.z
);
sunLight.castShadow = false;

const ambientLight = new THREE.AmbientLight(
  LIGHTING.ambient.color,
  LIGHTING.ambient.intensity
);

const scenes = {
  outdoor: new THREE.Scene(),
  indoor: new THREE.Scene()
};

// ---------------------------------------------------------------------------
// Presentation
// ---------------------------------------------------------------------------
const fade = createSceneFade();

const presentation = createPresentation({
  camera,
  canvas: renderer.domElement,
  labelLayerEl,
  scenes,
  sunLight,
  ambientLight,
  fade
});

// ---------------------------------------------------------------------------
// State + UI + input
// ---------------------------------------------------------------------------
let session;
let chatPanel = null;
let shopPanel = null;

const PREVIEW_PARAM = "preview";
const PREVIEW_SCENES = new Set([
  SCENE.MEADOW,
  SCENE.DOCK,
  SCENE.ORCHARD,
  SCENE.SPRING
]);

function readPreviewScene() {
  try {
    const value = new URLSearchParams(window.location.search).get(
      PREVIEW_PARAM
    );
    return PREVIEW_SCENES.has(value) ? value : null;
  } catch {
    return null;
  }
}

function readRoomConfig() {
  try {
    const params = new URLSearchParams(window.location.search);
    // Hidden offline mode for development/QA; normal URLs always join one of
    // the two fixed rooms.
    if (params.get(SOLO_PARAM) === "1") return null;
    // Read-only map preview: no room, no unlock, no login.
    if (PREVIEW_SCENES.has(params.get(PREVIEW_PARAM))) return null;
    // Local static preview defaults to single-player; production always opens
    // the single formal room (MAIN).
    const localHost = ["127.0.0.1", "localhost", "::1", "0.0.0.0"].includes(
      window.location.hostname
    );
    if (localHost && !params.has("room") && !params.has("ws")) return null;
    const requestedName = params.get("name") || params.get("character");
    // There is one online room. The old ?room=test entry is retired; any room
    // query is ignored so old links still land in the formal room.
    return {
      roomId: DEFAULT_ROOM_ID,
      // No name means "let the room assign the first free character"; an
      // explicit A/B selects A/B. Arbitrary names are never accepted.
      name: requestedName
        ? characterNameFor(requestedName, CHARACTERS.A.name)
        : "",
      ws: (params.get("ws") || "").trim()
    };
  } catch {
    return null;
  }
}

function transitionKind(from, to) {
  if (from === SCENE.OUTDOOR && to === SCENE.INDOOR_1) return "enter";
  if (from === SCENE.INDOOR_1 && to === SCENE.OUTDOOR) return "exit";
  if (from === SCENE.OUTDOOR && to === SCENE.GREENHOUSE) return "greenhouseEnter";
  if (from === SCENE.GREENHOUSE && to === SCENE.OUTDOOR) return "greenhouseExit";
  if (from === SCENE.OUTDOOR && to === SCENE.MEADOW) return "meadowEnter";
  if (from === SCENE.MEADOW && to === SCENE.OUTDOOR) return "meadowExit";
  if (from === SCENE.OUTDOOR && to === SCENE.DOCK) return "dockEnter";
  if (from === SCENE.DOCK && to === SCENE.OUTDOOR) return "dockExit";
  if (from === SCENE.OUTDOOR && to === SCENE.ORCHARD) return "orchardEnter";
  if (from === SCENE.ORCHARD && to === SCENE.OUTDOOR) return "orchardExit";
  if (from === SCENE.OUTDOOR && to === SCENE.SPRING) return "springEnter";
  if (from === SCENE.SPRING && to === SCENE.OUTDOOR) return "springExit";
  if (from === SCENE.INDOOR_1 && to === SCENE.INDOOR_2) return "upstairs";
  if (from === SCENE.INDOOR_2 && to === SCENE.INDOOR_1) return "downstairs";
  return null;
}

let pendingHudSync = false;
// Room mode starts from a local placeholder player at the garden gate. Keep
// the loading cover up until the authoritative welcome has supplied the real
// scene and position, so the placeholder is never shown as a visual jump.
let roomBootReady = true;

function handleStateApplied({ previousState, state, event }) {
  const isContinuousControl = event?.action === ACTION.MOVE_TICK;
  const noticeChanged =
    (state.ui.notice?.id ?? null) !== (previousState.ui.notice?.id ?? null);

  if (
    !roomBootReady &&
    (event?.action === "ROOM_WELCOME" ||
      event?.action === "ROOM_REPLACED" ||
      event?.action === "ROOM_IDLE" ||
      state.room?.role === "rejected")
  ) {
    roomBootReady = true;
  }

  if (event?.action === ACTION.OPEN_SHOP) shopPanel?.open();
  if (event?.action === ACTION.CLOSE_SHOP) shopPanel?.close();

  const previousPlayer = previousState.players?.[previousState.activePlayerId];
  const nextPlayer = state.players?.[state.activePlayerId];
  const sceneChanged =
    previousPlayer &&
    nextPlayer &&
    previousPlayer.currentScene !== nextPlayer.currentScene;

  if (sceneChanged && event?.action !== "ROOM_WELCOME") {
    const kind = transitionKind(
      previousPlayer.currentScene,
      nextPlayer.currentScene
    );
    if (kind) {
      presentation.beginSceneTransition({
        kind,
        toScene: nextPlayer.currentScene,
        players: Object.values(state.players),
        localPlayerId: state.activePlayerId,
        at: performance.now()
      });
      // Keep the old scene title / theme while the outgoing scene is still
      // on screen; the HUD catches up when the curtain finishes.
      pendingHudSync = true;
      return;
    }
    presentation.resetScene();
  }

  if (
    (!isContinuousControl || noticeChanged) &&
    !pendingHudSync &&
    !presentation.isTransitioning()
  ) {
    hud.sync(state, previousState);
    syncHudWeather(state, clockNow());
  }
}

const hud = createHud();
const previewScene = readPreviewScene();

const audioToggleEl = document.getElementById("audio-toggle");
const ambience = createAmbience({
  onChange: () => syncAudioToggle()
});
const realWeather = createRealWeather();

function syncHudWeather(state, now) {
  const server = effectiveServerWeather(state, now);
  const local = realWeather.getState();
  if (!server) {
    hud.setWeather(local);
    return;
  }
  const clientReady = local.status === "ready";
  const clientMatches =
    clientReady && local.weatherId === server.weatherId;
  const mode = server.rain ? "waiting" : server.sunny ? "sunny" : "waiting";
  hud.setWeather({
    ...local,
    status: "ready",
    weatherId: server.weatherId,
    label: server.label,
    rain: server.rain,
    sunny: server.sunny,
    isDay: server.isDay,
    temperature: server.temperature,
    location: server.location,
    mode,
    nextSunnyAt: clientMatches ? local.nextSunnyAt : null
  });
}

function syncAudioToggle() {
  if (!audioToggleEl) return;
  const enabled = ambience.getEnabled();
  audioToggleEl.classList.toggle("is-muted", !enabled);
  audioToggleEl.setAttribute("aria-pressed", String(enabled));
  audioToggleEl.title = enabled ? "关闭背景音乐和雨声" : "打开背景音乐和雨声";
}

audioToggleEl?.addEventListener(
  "pointerdown",
  (event) => {
    if (event.pointerType === "mouse" && event.button !== 0) return;
    event.preventDefault();
    event.stopPropagation();
    ambience.toggle();
    syncAudioToggle();
  },
  { passive: false }
);
if (!previewScene) {
  ambience.install();
  syncAudioToggle();
}
hud.setWeather(realWeather.getState());

const roomConfig = readRoomConfig();
roomBootReady = !roomConfig;
const initialState = createInitialState(readFarmSave());
if (previewScene) {
  const previewPlayer = getActivePlayer(initialState);
  if (previewPlayer) {
    previewPlayer.currentScene = previewScene;
    previewPlayer.position = { x: 0, y: 1.2 };
    previewPlayer.facing = "north";
    previewPlayer.destination = null;
    previewPlayer.path = [];
    previewPlayer.pathIndex = 0;
    initialState.world = {
      ...initialState.world,
      scenes: { ...initialState.world.scenes, [previewScene]: true }
    };
  }
  document.documentElement.classList.add("preview-mode");
}

const defaultWsUrl = `${
  window.location.protocol === "https:" ? "wss:" : "ws:"
}//${window.location.host}/ws`;
const wsUrl = roomConfig?.ws || defaultWsUrl;

if (roomConfig) {
  // Server-authoritative room: Cloudflare Worker + Durable Object. Both
  // players are equal clients; the DO is the neutral authority.
  const { createServerRoomClient } = await import(
    "./net/serverRoomClient.js"
  );
  session = createServerRoomClient({
    initialState,
    roomId: roomConfig.roomId,
    name: roomConfig.name,
    wsUrl,
    onStateApplied: handleStateApplied,
    onChatMessage: (message) => chatPanel?.receive(message),
    onChatAck: (ack) => chatPanel?.handleAck(ack),
    onChatRead: (read) => chatPanel?.handleRead(read)
  });
} else {
  session = createGameSession({
    initialState,
    onStateApplied: handleStateApplied
  });
}

if (roomConfig) {
  // Never strand a player behind the loading cover if the room socket cannot
  // reach welcome (offline / worker down). The normal path still waits.
  window.setTimeout(() => {
    roomBootReady = true;
  }, 12000);
}

window.addEventListener("pagehide", () => session?.stop?.());

function dispatch(action, targetId = null, payload = null) {
  // A scene transition owns the screen for ~0.8s. Drop gameplay taps during
  // that window so the outgoing scene cannot queue a second action.
  if (presentation.isTransitioning()) return session.getState();
  return session.dispatch(action, targetId, payload);
}

shopPanel = createShopPanel({
  dispatch,
  getState: session.getState,
  onClose: () => dispatch(ACTION.CLOSE_SHOP)
});

const kitchenPanel = createKitchenPanel({
  dispatch,
  getState: session.getState,
  onClose: () => dispatch(ACTION.CLOSE_KITCHEN)
});

const farmPanel = createFarmPanel({
  dispatch,
  getState: session.getState,
  onOpenShop: () => dispatch(ACTION.OPEN_SHOP)
});

const decorPanel = createDecorPanel({
  dispatch,
  getState: session.getState
});

chatPanel = createChatPanel({
  getState: session.getState,
  sendChat: session.sendChat ?? null,
  ackChat: session.ackChat ?? null,
  isTransitioning: () => presentation.isTransitioning(),
  showBubble: (playerId, info) => presentation.showChatBubble(playerId, info),
  hideBubble: (playerId) => presentation.hideChatBubble(playerId)
});

const boardPanel = createBoardPanel({
  dispatch,
  getState: session.getState,
  exportBoard: session.exportBoard ?? null
});

const minimap = createMinimap({
  getState: session.getState,
  project: projectToScreen
});

const dailyPanel = createPanel({
  dispatch,
  getState: session.getState,
  onSelectPlot: (plotId) => dispatch(ACTION.FIELD_CLICKED, plotId),
  onOpenShop: () => dispatch(ACTION.OPEN_SHOP)
});

const roomFull = createRoomFull({
  getState: session.getState
});

createScenePointer({
  canvas: renderer.domElement,
  movementOnly: Boolean(previewScene),
  camera,
  getInteractables: presentation.getInteractables,
  dispatch
});

hud.sync(session.getState());

// A tiny, opt-in debugging seam used by the manual browser checks. It is not
// created unless the URL explicitly asks for ?debug=1.
if (new URLSearchParams(window.location.search).has("debug")) {
  window.__duet = {
    getState: () => session.getState(),
    dispatch,
    getCamera: () => ({
      zoom: camera.zoom,
      target: { x: cameraTarget.x, y: cameraTarget.y, z: cameraTarget.z }
    }),
    presentation,
    session,
    panels: {
      farmPanel,
      chatPanel,
      shopPanel,
      decorPanel,
      kitchenPanel,
      minimap,
      roomFull
    },
    project: projectToScreen
  };
}

// Landscape touch still gets the compact action card, but movement is
// tap-to-walk everywhere now; there is no analog stick to reset.
const touchLandscape = window.matchMedia(
  "(orientation: landscape) and (pointer: coarse)"
);
function syncTouchLayout() {
  document.documentElement.classList.toggle(
    "touch-landscape",
    touchLandscape.matches
  );
}
touchLandscape.addEventListener?.("change", syncTouchLayout);
syncTouchLayout();

// ---------------------------------------------------------------------------
// Season / weather (derived from the display clock, never stored in state)
// ---------------------------------------------------------------------------
let lastSeasonAt = -Infinity;
let lastRainWaterAt = -Infinity;
let lastAmbienceRain = null;

const NIGHT_SUN = new THREE.Color("#8299b8");
const NIGHT_AMBIENT = new THREE.Color("#5f718b");

function serverWeatherFresh(weather, now) {
  return Boolean(
    weather &&
      Number.isFinite(Number(weather.fetchedAt)) &&
      now - Number(weather.fetchedAt) < 20 * 60 * 1000
  );
}

function effectiveServerWeather(state, now) {
  return serverWeatherFresh(state?.weather, now) ? state.weather : null;
}

function applySeason(now, weatherIdOverride = null) {
  const theme = seasonTheme(now);
  const daylight = daylightAt(now);
  const real = realWeather?.status === "ready" ? realWeather : null;
  document.documentElement.dataset.season = theme.season;
  document.documentElement.dataset.weather =
    weatherIdOverride ?? real?.weatherId ?? theme.weather;
  document.documentElement.dataset.time = daylight.phase;
  sunLight.color.set(theme.sun).lerp(NIGHT_SUN, daylight.nightness * 0.72);
  sunLight.intensity =
    theme.sunIntensity * (0.22 + 0.78 * daylight.light);
  ambientLight.color
    .set(theme.ambient)
    .lerp(NIGHT_AMBIENT, daylight.nightness * 0.62);
  ambientLight.intensity =
    theme.ambientIntensity * (0.6 + 0.4 * daylight.light);
}

// ---------------------------------------------------------------------------
// Resize
// ---------------------------------------------------------------------------
function resizeViewport() {
  const width = window.innerWidth;
  const height = window.innerHeight;
  if (!width || !height) return;

  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.setSize(width, height, false);

  const aspect = width / height;
  const viewHeight = Math.max(
    INPUT.BASE_VIEW_HEIGHT,
    INPUT.BASE_VIEW_WIDTH / aspect
  );
  const viewWidth = viewHeight * aspect;

  camera.left = -viewWidth / 2;
  camera.right = viewWidth / 2;
  camera.top = viewHeight / 2;
  camera.bottom = -viewHeight / 2;
  camera.updateProjectionMatrix();

  farmPanel.refreshLayout();
}

window.addEventListener("resize", resizeViewport, { passive: true });
window.visualViewport?.addEventListener("resize", resizeViewport);
resizeViewport();

// ---------------------------------------------------------------------------
// Render loop
// ---------------------------------------------------------------------------
let previousFrameElapsed = null;
let hasRenderedOnce = false;
let bootDismissed = false;
let cameraScene = null;

function syncCamera(player, deltaSeconds, snap = false, freeze = false) {
  // Freeze during the door/stairs transition; the state has already moved to
  // the destination scene, but the old scene is still the one on screen.
  if (freeze) return;
  const focused =
    player.activity?.kind === "sleep" || player.activity?.kind === "work";
  const desired = focused
    ? new THREE.Vector3(
        CAMERA_RIG.sleepTarget.x,
        CAMERA_RIG.sleepTarget.y,
        CAMERA_RIG.sleepTarget.z
      )
    : new THREE.Vector3(
        player.position.x,
        CAMERA_RIG.target.y,
        player.position.y
      );
  const targetZoom = focused ? CAMERA_RIG.sleepZoom : 1;
  if (snap || cameraScene !== player.currentScene) {
    cameraScene = player.currentScene;
    cameraTarget.copy(desired);
    camera.zoom = targetZoom;
  } else {
    const alpha = 1 - Math.exp(
      -CAMERA_RIG.followLerp * Math.max(0.001, deltaSeconds)
    );
    cameraTarget.lerp(desired, alpha);
    camera.zoom += (targetZoom - camera.zoom) * alpha;
  }
  camera.updateProjectionMatrix();
  camera.position.copy(cameraTarget).add(cameraOffset);
  camera.lookAt(cameraTarget);
}

function renderFrame(elapsed) {
  if (previousFrameElapsed === null) previousFrameElapsed = elapsed;
  const deltaSeconds = Math.min(
    Math.max((elapsed - previousFrameElapsed) / 1000, 0),
    0.05
  );
  previousFrameElapsed = elapsed;

  let currentState = session.getState();
  let player = getActivePlayer(currentState);
  if (!player) return;

  const now = clockNow();
  ambience.setScene(player.currentScene);

  // Real Shenzhen rain is the shared authority. Prefer the room's cached
  // reading, then the local Open-Meteo reading, then the legacy pseudo-weather
  // when neither is available (e.g. offline solo). Both clients may send this
  // idempotent action; the DO re-checks its own cached reading.
  const serverWeather = effectiveServerWeather(currentState, now);
  const serverRain = serverWeather?.rain;
  const clientRain =
    realWeather.status === "ready" ? Boolean(realWeather.rain) : null;
  const raining =
    typeof serverRain === "boolean"
      ? serverRain
      : clientRain === null
        ? getWeather(now).id === "rain"
        : clientRain;
  if (lastAmbienceRain !== raining) {
    lastAmbienceRain = raining;
    ambience.setRain(raining);
  }
  if (
    !presentation.isTransitioning() &&
    raining &&
    hasUnwateredRainCrops(currentState) &&
    now - lastRainWaterAt > 8000
  ) {
    lastRainWaterAt = now;
    session.dispatch(
      ACTION.RAIN_WATER,
      null,
      clientRain === true ? { reportedRain: true } : null
    );
    currentState = session.getState();
    player = getActivePlayer(currentState);
    if (!player) return;
  }

  if (presentation.isTransitioning()) {
    presentation.updateTransition(performance.now());
  } else {
    if (playerIsMoving(player) && deltaSeconds > 0) {
      session.dispatch(ACTION.MOVE_TICK, null, { delta: deltaSeconds });
      currentState = session.getState();
      player = getActivePlayer(currentState);
      if (!player) return;
    }

    if (presentation.isTransitioning()) {
      // A MOVE_TICK can arrive at the door and change scene mid-frame; start
      // the curtain before this frame is allowed to mount the new scene.
      presentation.updateTransition(performance.now());
    } else {
      const players = Object.values(currentState.players);
      presentation.mountForScene(
        player.currentScene,
        players,
        currentState.activePlayerId
      );

      presentation.syncPlayers(
        players,
        currentState.activePlayerId,
        elapsed,
        deltaSeconds,
        now
      );
      presentation.syncPaths(currentState, currentState.activePlayerId, now);
      presentation.syncWeather(
        currentState,
        elapsed,
        now,
        serverWeather?.weatherId ??
          (realWeather?.status === "ready"
            ? realWeather.weatherId
            : getWeather(now).id)
      );
      presentation.syncSpirit(currentState, elapsed, now);
      presentation.syncBedroomDoors(players, deltaSeconds);
      presentation.syncMarker(player, elapsed);
      presentation.syncFarm(currentState, now);
      presentation.syncDecor(currentState);
      presentation.syncKitchen(currentState, elapsed);
      presentation.syncPlayground(players, now, currentState.activePlayerId);
    }
  }

  syncCamera(player, deltaSeconds, false, presentation.isTransitioning());

  const players = Object.values(currentState.players);
  presentation.updateLabels(players, currentState.activePlayerId);

  farmPanel.sync(currentState, now);
  dailyPanel.sync(currentState, now);
  if (shopPanel.isOpen()) shopPanel.sync(currentState);
  kitchenPanel.sync(currentState);
  boardPanel.sync(currentState);
  decorPanel.sync(currentState);
  minimap.sync(currentState, elapsed, presentation.isTransitioning());
  roomFull.sync(currentState);
  chatPanel.sync(currentState);

  if (elapsed - lastSeasonAt > 1200) {
    lastSeasonAt = elapsed;
    applySeason(now, serverWeather?.weatherId ?? null);
    syncHudWeather(currentState, now);
  }

  if (!presentation.isTransitioning() && pendingHudSync) {
    pendingHudSync = false;
    hud.sync(currentState);
  }

  const activeScene = presentation.getActiveScene();
  if (activeScene) {
    renderer.render(activeScene, camera);
  }

  if (!hasRenderedOnce) hasRenderedOnce = true;
  if (!bootDismissed && roomBootReady) {
    bootDismissed = true;
    requestAnimationFrame(() => {
      bootEl.classList.add("is-ready");
      window.setTimeout(() => {
        bootEl.setAttribute("aria-hidden", "true");
      }, 520);
    });
  }
}

if (!previewScene) realWeather.start();
applySeason(clockNow());
const bootPlayer = getActivePlayer(session.getState());
if (bootPlayer) syncCamera(bootPlayer, 0, true);
renderer.setAnimationLoop(renderFrame);
