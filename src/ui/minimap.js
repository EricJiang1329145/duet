import { FIELD_GRID, PLOT_IDS, SCENE } from "../config.js";
import { getActivePlayer } from "../game/player.js";

const MAP_BOUNDS = Object.freeze({
  outdoor: { minX: -13, maxX: 13, minZ: -10, maxZ: 10 },
  greenhouse: { minX: -2.9, maxX: 2.9, minZ: -2.0, maxZ: 2.0 },
  meadow: { minX: -6.6, maxX: 6.6, minZ: -4.2, maxZ: 4.2 },
  dock: { minX: -6.6, maxX: 6.6, minZ: -4.2, maxZ: 4.2 },
  orchard: { minX: -6.6, maxX: 6.6, minZ: -4.2, maxZ: 4.2 },
  spring: { minX: -6.6, maxX: 6.6, minZ: -4.2, maxZ: 4.2 },
  indoor_1: { minX: -9.2, maxX: 9.2, minZ: -6.2, maxZ: 6.2 },
  indoor_2: { minX: -9.2, maxX: 9.2, minZ: -6.2, maxZ: 6.2 }
});

const SCENE_SHORT = Object.freeze({
  outdoor: "小院",
  greenhouse: "温室",
  meadow: "花间坡",
  dock: "溪畔码头",
  orchard: "山坡果园",
  spring: "雾汤温泉",
  indoor_1: "一层",
  indoor_2: "二层"
});

const CANVAS_SIZE = 92;
const MAP_PAD = 7;
const CAPTION_H = 16;

function roundedRect(ctx, x, y, w, h, r) {
  const radius = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + w, y, x + w, y + h, radius);
  ctx.arcTo(x + w, y + h, x, y + h, radius);
  ctx.arcTo(x, y + h, x, y, radius);
  ctx.arcTo(x, y, x + w, y, radius);
  ctx.closePath();
}

function createProjector(bounds) {
  const width = CANVAS_SIZE - MAP_PAD * 2;
  const height = CANVAS_SIZE - MAP_PAD - CAPTION_H - 3;
  const spanX = bounds.maxX - bounds.minX;
  const spanZ = bounds.maxZ - bounds.minZ;
  const scale = Math.min(width / spanX, height / spanZ);
  const offsetX = MAP_PAD + (width - spanX * scale) / 2;
  const offsetY = MAP_PAD + (height - spanZ * scale) / 2;
  return (x, z) => ({
    x: offsetX + (x - bounds.minX) * scale,
    y: offsetY + (z - bounds.minZ) * scale
  });
}

function plotCenters() {
  const centers = [];
  for (let row = 0; row < FIELD_GRID.rows; row += 1) {
    for (let col = 0; col < FIELD_GRID.columns; col += 1) {
      const index = row * FIELD_GRID.columns + col;
      centers.push({
        id: PLOT_IDS[index],
        x: FIELD_GRID.startX + col * FIELD_GRID.stepX,
        z: FIELD_GRID.startZ + row * FIELD_GRID.stepZ
      });
    }
  }
  return centers;
}

const PLOT_CENTERS = plotCenters();

function drawOutdoor(ctx, project, state) {
  // Grass + fence line.
  ctx.fillStyle = "#cfdfb6";
  ctx.fillRect(MAP_PAD, MAP_PAD, CANVAS_SIZE - MAP_PAD * 2, CANVAS_SIZE - MAP_PAD - CAPTION_H);
  ctx.strokeStyle = "rgba(90, 104, 78, 0.35)";
  ctx.lineWidth = 1;
  ctx.strokeRect(MAP_PAD + 0.5, MAP_PAD + 0.5, CANVAS_SIZE - MAP_PAD * 2 - 1, CANVAS_SIZE - MAP_PAD - CAPTION_H - 1);

  // Villa.
  const a = project(-8.2, -8.8);
  const b = project(8.2, -2.0);
  ctx.fillStyle = "#e4cfb5";
  ctx.fillRect(a.x, a.y, b.x - a.x, b.y - a.y);
  ctx.fillStyle = "#b96d50";
  ctx.fillRect(a.x + 1, a.y + 1, b.x - a.x - 2, 2.5);

  // Plots.
  const size = Math.max(3.4, FIELD_GRID.size * 1.25);
  for (const plot of PLOT_CENTERS) {
    const p = project(plot.x, plot.z);
    const unlocked = Boolean(state.plots?.[plot.id]?.unlocked);
    ctx.fillStyle = unlocked ? "#a9774e" : "#c8b49b";
    ctx.fillRect(p.x - size / 2, p.y - size / 2, size, size);
    if (state.plots?.[plot.id]?.crop) {
      ctx.fillStyle = "#7e9b62";
      ctx.fillRect(p.x - 1, p.y - 1, 2, 2);
    }
  }

  // Greenhouse site / built glasshouse over fields 11/12.
  const gh = project(2.075, 6.1);
  if (state.world?.greenhouse) {
    ctx.fillStyle = "rgba(159, 191, 181, 0.68)";
    ctx.fillRect(gh.x - 8, gh.y - 5, 16, 10);
  } else {
    ctx.strokeStyle = "rgba(79, 116, 99, 0.8)";
    ctx.setLineDash([2, 2]);
    ctx.strokeRect(gh.x - 8, gh.y - 5, 16, 10);
    ctx.setLineDash([]);
    ctx.fillStyle = "#4f7463";
    ctx.fillRect(gh.x - 2, gh.y + 5, 4, 4);
  }

  // Pond, well, shed.
  const pondA = project(6.2, 3.8);
  const pondB = project(10.8, 7.6);
  ctx.fillStyle = "#9dc6c3";
  ctx.fillRect(pondA.x, pondA.y, pondB.x - pondA.x, pondB.y - pondA.y);
  for (const [x, z] of [[-8.2, 1.5], [8.6, 1.2], [-8.2, 4.8]]) {
    const p = project(x, z);
    ctx.fillStyle = "#b7a58e";
    ctx.beginPath();
    ctx.arc(p.x, p.y, 2.1, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawGreenhouse(ctx, project, state) {
  ctx.fillStyle = "#d9e7d2";
  ctx.fillRect(MAP_PAD, MAP_PAD, CANVAS_SIZE - MAP_PAD * 2, CANVAS_SIZE - MAP_PAD - CAPTION_H);
  ctx.strokeStyle = "rgba(92, 123, 102, 0.45)";
  ctx.lineWidth = 1;
  ctx.strokeRect(
    MAP_PAD + 0.5,
    MAP_PAD + 0.5,
    CANVAS_SIZE - MAP_PAD * 2 - 1,
    CANVAS_SIZE - MAP_PAD - CAPTION_H - 1
  );
  for (const [x, z] of [[-1.9, -0.1], [1.9, -0.1]]) {
    const a = project(x - 1.0, z - 1.0);
    const b = project(x + 1.0, z + 1.0);
    const plot = state.plots?.[x < 0 ? "field_11" : "field_12"];
    ctx.fillStyle = plot?.crop ? "#78975f" : "#9d6f4d";
    ctx.fillRect(a.x, a.y, b.x - a.x, b.y - a.y);
  }
  const door = project(0, 2.35);
  ctx.fillStyle = "#4f7463";
  ctx.fillRect(door.x - 4, door.y - 2, 8, 3);
}

function drawMeadow(ctx, project, state) {
  ctx.fillStyle = "#d8e6bf";
  ctx.fillRect(MAP_PAD, MAP_PAD, CANVAS_SIZE - MAP_PAD * 2, CANVAS_SIZE - MAP_PAD - CAPTION_H);
  ctx.strokeStyle = "rgba(92, 123, 102, 0.45)";
  ctx.lineWidth = 1;
  ctx.strokeRect(
    MAP_PAD + 0.5,
    MAP_PAD + 0.5,
    CANVAS_SIZE - MAP_PAD * 2 - 1,
    CANVAS_SIZE - MAP_PAD - CAPTION_H - 1
  );
  for (const [x, z, color] of [
    [-2.3, 0.4, "#d68f9e"],
    [2.2, 0.2, "#dca84f"]
  ]) {
    const point = project(x, z);
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(point.x, point.y, 3.2, 0, Math.PI * 2);
    ctx.fill();
  }
  const door = project(0, 3.2);
  ctx.fillStyle = "#4f7463";
  ctx.fillRect(door.x - 4, door.y - 2, 8, 3);
  if (state.world?.forage?.meadow_flowers?.[state.activePlayerId]) {
    const point = project(-2.3, 0.4);
    ctx.strokeStyle = "rgba(255, 255, 255, 0.85)";
    ctx.strokeRect(point.x - 4, point.y - 4, 8, 8);
  }
}

function drawDock(ctx, project) {
  ctx.fillStyle = "#a9cbd0";
  ctx.fillRect(MAP_PAD, MAP_PAD, CANVAS_SIZE - MAP_PAD * 2, CANVAS_SIZE - MAP_PAD - CAPTION_H);
  ctx.strokeStyle = "rgba(76, 111, 116, 0.45)";
  ctx.strokeRect(
    MAP_PAD + 0.5,
    MAP_PAD + 0.5,
    CANVAS_SIZE - MAP_PAD * 2 - 1,
    CANVAS_SIZE - MAP_PAD - CAPTION_H - 1
  );
  const a = project(-1.9, -2.2);
  const b = project(1.9, 2.4);
  ctx.fillStyle = "#c99863";
  ctx.fillRect(a.x, a.y, b.x - a.x, b.y - a.y);
  for (const [x, z, color] of [
    [0.2, 0.1, "#7faec0"],
    [2.8, 0.8, "#e2c09c"]
  ]) {
    const point = project(x, z);
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(point.x, point.y, 3.2, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawOrchard(ctx, project) {
  ctx.fillStyle = "#d8e6bf";
  ctx.fillRect(MAP_PAD, MAP_PAD, CANVAS_SIZE - MAP_PAD * 2, CANVAS_SIZE - MAP_PAD - CAPTION_H);
  ctx.strokeStyle = "rgba(92, 123, 102, 0.45)";
  ctx.strokeRect(
    MAP_PAD + 0.5,
    MAP_PAD + 0.5,
    CANVAS_SIZE - MAP_PAD * 2 - 1,
    CANVAS_SIZE - MAP_PAD - CAPTION_H - 1
  );
  for (const [x, z] of [[-2.4, -0.4], [2.4, -0.4]]) {
    const point = project(x, z);
    ctx.fillStyle = "#7e9b62";
    ctx.beginPath();
    ctx.arc(point.x, point.y, 5.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#d77e63";
    ctx.beginPath();
    ctx.arc(point.x, point.y, 1.7, 0, Math.PI * 2);
    ctx.fill();
  }
  const door = project(0, 3.2);
  ctx.fillStyle = "#4f7463";
  ctx.fillRect(door.x - 4, door.y - 2, 8, 3);
}

function drawSpring(ctx, project) {
  ctx.fillStyle = "#d6ddc9";
  ctx.fillRect(MAP_PAD, MAP_PAD, CANVAS_SIZE - MAP_PAD * 2, CANVAS_SIZE - MAP_PAD - CAPTION_H);
  ctx.strokeStyle = "rgba(92, 123, 102, 0.45)";
  ctx.strokeRect(
    MAP_PAD + 0.5,
    MAP_PAD + 0.5,
    CANVAS_SIZE - MAP_PAD * 2 - 1,
    CANVAS_SIZE - MAP_PAD - CAPTION_H - 1
  );
  const a = project(-2.0, -1.6);
  const b = project(2.0, 1.1);
  ctx.fillStyle = "#9fc6c2";
  ctx.fillRect(a.x, a.y, b.x - a.x, b.y - a.y);
  for (const [x, z, color] of [
    [-2.4, 0.1, "#7f9c68"],
    [2.4, 0.4, "#d9b77d"]
  ]) {
    const point = project(x, z);
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(point.x, point.y, 3.2, 0, Math.PI * 2);
    ctx.fill();
  }
  const door = project(0, 3.2);
  ctx.fillStyle = "#4f7463";
  ctx.fillRect(door.x - 4, door.y - 2, 8, 3);
}

function drawIndoorOne(ctx, project) {
  ctx.fillStyle = "#ecd2b1";
  ctx.fillRect(MAP_PAD, MAP_PAD, CANVAS_SIZE - MAP_PAD * 2, CANVAS_SIZE - MAP_PAD - CAPTION_H);
  ctx.strokeStyle = "rgba(112, 87, 61, 0.32)";
  ctx.strokeRect(MAP_PAD + 0.5, MAP_PAD + 0.5, CANVAS_SIZE - MAP_PAD * 2 - 1, CANVAS_SIZE - MAP_PAD - CAPTION_H - 1);

  // Bedroom partitions with a single door each, and the central bathroom.
  ctx.strokeStyle = "rgba(255, 247, 233, 0.9)";
  ctx.lineWidth = 2.2;
  for (const side of [-1, 1]) {
    const a = project(side * 1.35, -5.6);
    const b = project(side * 1.35, -1.4);
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
    ctx.stroke();
  }
  ctx.lineWidth = 1;

  for (const [x, z, w, d, color] of [
    [-6.0, -4.1, 2.2, 2.15, "#9db596"],
    [6.0, -4.1, 2.2, 2.15, "#d5a08c"],
    [-7.2, 1.9, 1.7, 0.9, "#c6a077"],
    [7.2, 1.9, 1.7, 0.9, "#c6a077"],
    [-3.2, 1.4, 1.0, 2.0, "#8fa986"],
    [-3.7, 5.15, 1.7, 0.7, "#c9a276"],
    [-6.9, 5.8, 3.1, 0.3, "#805636"]
  ]) {
    const a = project(x - w / 2, z - d / 2);
    const b = project(x + w / 2, z + d / 2);
    ctx.fillStyle = color;
    ctx.fillRect(a.x, a.y, b.x - a.x, b.y - a.y);
  }
  const bathroom = project(0, -4.1);
  ctx.strokeStyle = "rgba(255, 247, 233, 0.9)";
  ctx.strokeRect(bathroom.x - 3, bathroom.y - 8, 6, 13);
  const stairs = project(4.8, 3.4);
  ctx.fillStyle = "#c49a70";
  ctx.fillRect(stairs.x - 4, stairs.y - 4, 8, 8);
}

function drawIndoorTwo(ctx, project, state) {
  ctx.fillStyle = "#ecd2b1";
  ctx.fillRect(MAP_PAD, MAP_PAD, CANVAS_SIZE - MAP_PAD * 2, CANVAS_SIZE - MAP_PAD - CAPTION_H);
  ctx.strokeStyle = "rgba(112, 87, 61, 0.32)";
  ctx.strokeRect(MAP_PAD + 0.5, MAP_PAD + 0.5, CANVAS_SIZE - MAP_PAD * 2 - 1, CANVAS_SIZE - MAP_PAD - CAPTION_H - 1);

  const decor = state.world?.decor ?? {};
  const pieces = [];
  if (decor.tv) pieces.push([0, -5.55, 3.0, 0.6, "#6d7c7d"]);
  if (decor.console) pieces.push([0, -4.95, 1.0, 0.55, "#55635e"]);
  if (decor.sofa) pieces.push([0, -3.2, 2.9, 1.0, "#8fa986"]);
  if (decor.rug) pieces.push([0, -1.4, 3.8, 2.2, "#dfb899"]);
  if (decor.shelf) pieces.push([6.2, -5.7, 2.4, 0.4, "#a9774e"]);
  if (decor.plant) pieces.push([-7.0, -3.2, 0.6, 0.6, "#7e9b62"]);
  if (decor.lamp) pieces.push([7.0, 2.0, 0.5, 0.5, "#e2b76b"]);
  for (const [x, z, w, d, color] of pieces) {
    const a = project(x - w / 2, z - d / 2);
    const b = project(x + w / 2, z + d / 2);
    ctx.fillStyle = color;
    ctx.fillRect(a.x, a.y, Math.max(2, b.x - a.x), Math.max(2, b.y - a.y));
  }

  const stairs = project(4.8, 3.4);
  ctx.fillStyle = "#c49a70";
  ctx.fillRect(stairs.x - 4, stairs.y - 4, 8, 8);
}

function drawPlayer(ctx, point, color, radius = 3.4) {
  ctx.beginPath();
  ctx.arc(point.x, point.y, radius + 1.4, 0, Math.PI * 2);
  ctx.fillStyle = "rgba(255, 250, 240, 0.94)";
  ctx.fill();
  ctx.beginPath();
  ctx.arc(point.x, point.y, radius, 0, Math.PI * 2);
  ctx.fillStyle = color;
  ctx.fill();
}

function shortName(name) {
  return String(name ?? "?").trim().slice(0, 3) || "?";
}

/**
 * Top-right minimap + an off-screen arrow pointing at the partner. Pure UI:
 * it reads players/world and the camera projection, never mutates state.
 */
export function createMinimap({ getState, project }) {
  const root = document.getElementById("minimap");
  const canvas = document.getElementById("minimap-canvas");
  const caption = document.getElementById("minimap-caption");
  const pointer = document.getElementById("player-pointer");
  const pointerSvg = pointer?.querySelector("svg");
  if (!root || !canvas || !caption || !pointer || !pointerSvg) {
    return { sync() {} };
  }

  const ctx = canvas.getContext("2d");
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = CANVAS_SIZE * dpr;
  canvas.height = CANVAS_SIZE * dpr;

  let lastDrawAt = -Infinity;
  let lastScene = null;
  let lastCaption = "";
  let lastPointerVisible = false;

  function draw(state, player, remote) {
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);

    const bounds = MAP_BOUNDS[player.currentScene] ?? MAP_BOUNDS.outdoor;
    const projectPoint = createProjector(bounds);

    if (player.currentScene === SCENE.GREENHOUSE) {
      drawGreenhouse(ctx, projectPoint, state);
    } else if (player.currentScene === SCENE.MEADOW) {
      drawMeadow(ctx, projectPoint, state);
    } else if (player.currentScene === SCENE.DOCK) {
      drawDock(ctx, projectPoint);
    } else if (player.currentScene === SCENE.ORCHARD) {
      drawOrchard(ctx, projectPoint);
    } else if (player.currentScene === SCENE.SPRING) {
      drawSpring(ctx, projectPoint);
    } else if (player.currentScene === SCENE.INDOOR_1) {
      drawIndoorOne(ctx, projectPoint);
    } else if (player.currentScene === SCENE.INDOOR_2) {
      drawIndoorTwo(ctx, projectPoint, state);
    } else {
      drawOutdoor(ctx, projectPoint, state);
    }

    const sameScene = remote?.currentScene === player.currentScene;
    if (sameScene) {
      drawPlayer(ctx, projectPoint(remote.position.x, remote.position.y), "#c26a5a");
    }
    drawPlayer(ctx, projectPoint(player.position.x, player.position.y), "#2f5d46");
  }

  function updateCaption(player, remote) {
    const here = SCENE_SHORT[player.currentScene] ?? "小院";
    let text = here;
    if (remote) {
      const name = shortName(remote.name);
      if (remote.currentScene === player.currentScene) {
        text = `${here} · ${name}`;
      } else {
        const there = SCENE_SHORT[remote.currentScene] ?? "别处";
        text = `${name} 在${there}`;
      }
    }
    if (text !== lastCaption) {
      lastCaption = text;
      caption.textContent = text;
      root.title = `小地图：${text}`;
      root.setAttribute("aria-label", `小地图：${text}`);
    }
  }

  function hidePointer() {
    if (!lastPointerVisible) return;
    lastPointerVisible = false;
    pointer.hidden = true;
  }

  function updatePointer(player, remote, transitioning) {
    if (
      transitioning ||
      !remote ||
      remote.currentScene !== player.currentScene
    ) {
      hidePointer();
      return;
    }

    const local = project(player.position.x, 0.8, player.position.y);
    const other = project(remote.position.x, 0.8, remote.position.y);
    if (
      !Number.isFinite(local.x) ||
      !Number.isFinite(local.y) ||
      !Number.isFinite(other.x) ||
      !Number.isFinite(other.y)
    ) {
      hidePointer();
      return;
    }

    const width = window.innerWidth;
    const height = window.innerHeight;
    const narrow = width <= 560;
    const inset = {
      left: 24,
      right: width - 24,
      top: narrow ? 164 : 112,
      bottom: height - 92
    };

    if (
      other.x >= inset.left &&
      other.x <= inset.right &&
      other.y >= inset.top &&
      other.y <= inset.bottom
    ) {
      hidePointer();
      return;
    }

    const dx = other.x - local.x;
    const dy = other.y - local.y;
    if (Math.abs(dx) + Math.abs(dy) < 0.001) {
      hidePointer();
      return;
    }

    let t = Infinity;
    if (dx > 0) t = Math.min(t, (inset.right - local.x) / dx);
    if (dx < 0) t = Math.min(t, (inset.left - local.x) / dx);
    if (dy > 0) t = Math.min(t, (inset.bottom - local.y) / dy);
    if (dy < 0) t = Math.min(t, (inset.top - local.y) / dy);
    if (!Number.isFinite(t) || t <= 0) {
      hidePointer();
      return;
    }

    const x = Math.min(inset.right, Math.max(inset.left, local.x + dx * t));
    const y = Math.min(inset.bottom, Math.max(inset.top, local.y + dy * t));
    const angle = Math.atan2(dy, dx);

    pointer.style.left = `${x}px`;
    pointer.style.top = `${y}px`;
    pointer.style.setProperty("--pointer-angle", `${angle}rad`);
    if (!lastPointerVisible) {
      lastPointerVisible = true;
      pointer.hidden = false;
    }
    pointer.setAttribute(
      "aria-label",
      `${shortName(remote.name)} 在画面外，箭头指向对方`
    );
  }

  function sync(state = getState(), now = performance.now(), transitioning = false) {
    if (!state) return;
    const player = getActivePlayer(state);
    if (!player) {
      hidePointer();
      return;
    }
    const remote = Object.values(state.players ?? {}).find(
      (candidate) => candidate.id !== player.id
    );

    // Redrawing at ~12Hz is smooth enough for a minimap and kind to phones.
    if (now - lastDrawAt > 80 || player.currentScene !== lastScene) {
      lastDrawAt = now;
      lastScene = player.currentScene;
      draw(state, player, remote);
    }
    updateCaption(player, remote);
    updatePointer(player, remote, transitioning);
  }

  return { sync };
}
