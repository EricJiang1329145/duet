import {
  ACTION,
  BEDROOMS,
  DISHES,
  FACING_YAW,
  FARM_SCENES,
  GREENHOUSE_PLOTS,
  PLAYGROUND,
  PLOT_IDS,
  SCENE,
  SOFA,
  STAIRS,
  STUDIES,
  diningSeat,
  sofaSeat,
  studySeat
} from "../config.js";
import { getPlotHazard, getCropStage } from "../game/crop.js";
import { spiritPose } from "../game/spirit.js";
import { daylightAt } from "../game/daylight.js";
import { getWeather } from "../game/season.js";
import { getActivePlayer } from "../game/player.js";
import { offlineSleepers } from "../game/sleep.js";
import { bedroomObstaclesFor, decorObstaclesFor } from "../game/movement.js";
import { findPath } from "../game/pathfinding.js";
import {
  getActivity,
  seesawMotion,
  swingMotion
} from "../game/playground.js";
import { clockNow } from "../runtime/clock.js";
import { buildGreenhouseScene } from "../scenes/greenhouse.js";
import { buildIndoorOneScene } from "../scenes/indoorOne.js";
import { buildIndoorTwoScene } from "../scenes/indoorTwo.js";
import { buildMeadowScene } from "../scenes/meadow.js";
import { buildDockScene } from "../scenes/dock.js";
import { buildOrchardScene } from "../scenes/orchard.js";
import { buildSpringScene } from "../scenes/spring.js";
import { buildOutdoorScene } from "../scenes/outdoor.js";
import { createSceneKit } from "../scenes/sceneKit.js";
import {
  buildDestinationMarker,
  buildPlayerAvatar,
  syncAvatar,
  syncDestinationMarker
} from "./actors.js";
import { disposeTreeResources } from "./dispose.js";
import { buildPathGuide, updatePathGuide } from "./pathGuide.js";
import { createWorldLabels } from "./worldLabels.js";

const SCENE_BUILDERS = Object.freeze({
  [SCENE.OUTDOOR]: buildOutdoorScene,
  [SCENE.GREENHOUSE]: buildGreenhouseScene,
  [SCENE.MEADOW]: buildMeadowScene,
  [SCENE.DOCK]: buildDockScene,
  [SCENE.ORCHARD]: buildOrchardScene,
  [SCENE.SPRING]: buildSpringScene,
  [SCENE.INDOOR_1]: buildIndoorOneScene,
  [SCENE.INDOOR_2]: buildIndoorTwoScene
});

const TRANSITIONS = Object.freeze({
  enter: { doorEnd: 300, fadeStart: 300, swapAt: 540, fadeInStart: 620, end: 840 },
  exit: { doorEnd: 280, fadeStart: 280, swapAt: 520, fadeInStart: 600, end: 820 },
  upstairs: {
    doorEnd: 0,
    climbEnd: 760,
    fadeStart: 520,
    swapAt: 760,
    fadeInStart: 840,
    end: 1060
  },
  downstairs: {
    doorEnd: 0,
    climbEnd: 680,
    fadeStart: 480,
    swapAt: 700,
    fadeInStart: 780,
    end: 1000
  },
  greenhouseEnter: {
    doorEnd: 260,
    fadeStart: 260,
    swapAt: 500,
    fadeInStart: 580,
    end: 800
  },
  greenhouseExit: {
    doorEnd: 240,
    fadeStart: 240,
    swapAt: 480,
    fadeInStart: 560,
    end: 780
  },
  meadowEnter: {
    doorEnd: 240,
    fadeStart: 240,
    swapAt: 480,
    fadeInStart: 560,
    end: 780
  },
  meadowExit: {
    doorEnd: 220,
    fadeStart: 220,
    swapAt: 460,
    fadeInStart: 540,
    end: 760
  },
  dockEnter: {
    doorEnd: 240,
    fadeStart: 240,
    swapAt: 480,
    fadeInStart: 560,
    end: 780
  },
  dockExit: {
    doorEnd: 220,
    fadeStart: 220,
    swapAt: 460,
    fadeInStart: 540,
    end: 760
  },
  orchardEnter: {
    doorEnd: 240,
    fadeStart: 240,
    swapAt: 480,
    fadeInStart: 560,
    end: 780
  },
  orchardExit: {
    doorEnd: 220,
    fadeStart: 220,
    swapAt: 460,
    fadeInStart: 540,
    end: 760
  },
  springEnter: {
    doorEnd: 240,
    fadeStart: 240,
    swapAt: 480,
    fadeInStart: 560,
    end: 780
  },
  springExit: {
    doorEnd: 220,
    fadeStart: 220,
    swapAt: 460,
    fadeInStart: 540,
    end: 760
  }
});

function easeOut(value) {
  const t = Math.min(1, Math.max(0, value));
  return 1 - (1 - t) * (1 - t);
}

function easeInOut(value) {
  const t = Math.min(1, Math.max(0, value));
  return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
}

function transitionFade(elapsed, timeline) {
  if (elapsed < timeline.fadeStart) return 0;
  if (elapsed < timeline.swapAt) {
    return easeOut(
      (elapsed - timeline.fadeStart) / (timeline.swapAt - timeline.fadeStart)
    );
  }
  if (elapsed < timeline.fadeInStart) return 1;
  return 1 - easeOut(
    (elapsed - timeline.fadeInStart) / (timeline.end - timeline.fadeInStart)
  );
}

/**
 * Owns Three.js presentation state only. It reads game state but never mutates
 * it. Scene mounting is disposable: every logical scene change releases all
 * geometry/material owned by the outgoing scene.
 */
export function createPresentation({
  camera,
  canvas,
  labelLayerEl,
  scenes,
  sunLight,
  ambientLight,
  fade = null
}) {
  const labels = createWorldLabels(labelLayerEl);

  const view = {
    logicalScene: null,
    threeKey: null,
    interactables: [],
    plotViews: Object.create(null),
    avatars: new Map(),
    destinationMarker: null,
    pathGuide: null,
    remotePaths: new Map(),
    spiritGreets: null,
    spiritHeartUntil: 0,
    doors: [],
    props: Object.create(null),
    transition: null
  };

  function threeKeyForScene(logicalScene) {
    return logicalScene === SCENE.OUTDOOR ? "outdoor" : "indoor";
  }

  /**
   * Dispose every geometry/material in a scene and clear its DOM labels.
   * Shared renderer, camera and the long-lived Three.Scene containers survive.
   */
  function disposeScene(scene) {
    disposeTreeResources(scene);

    while (scene.children.length > 0) {
      scene.remove(scene.children[0]);
    }

    labels.clear();
    view.interactables = [];
    view.plotViews = Object.create(null);
    view.avatars.clear();
    view.visiblePlayers = null;
    view.destinationMarker = null;
    view.pathGuide = null;
    view.remotePaths.clear();
    view.spiritGreets = null;
    view.spiritHeartUntil = 0;
    view.doors = [];
    view.props = Object.create(null);
  }

  function ensureAvatar(player, localPlayerId) {
    const existing = view.avatars.get(player.id);
    if (existing) return existing;

    const scene = scenes[view.threeKey];
    if (!scene) return null;

    const avatar = buildPlayerAvatar(scene, player, {
      variant: player.id === localPlayerId ? "local" : "remote"
    });
    view.avatars.set(player.id, avatar);
    return avatar;
  }

  /**
   * Mount a logical scene. Returns true when the scene actually changed.
   */
  function mountForScene(logicalScene, players = [], localPlayerId = null) {
    if (view.logicalScene === logicalScene) return false;

    if (view.threeKey) {
      disposeScene(scenes[view.threeKey]);
    }

    const threeKey = threeKeyForScene(logicalScene);
    const scene = scenes[threeKey];
    const builder = SCENE_BUILDERS[logicalScene];
    if (!builder) return false;

    const kit = createSceneKit({
      scene,
      addWorldLabel: labels.add
    });
    builder(kit);

    view.interactables = kit.interactables;
    view.plotViews = kit.plotViews;
    view.doors = kit.doors;
    view.props = kit.props;
    view.logicalScene = logicalScene;
    view.threeKey = threeKey;

    // A Three object can have only one parent. Moving the shared lights into
    // the newly mounted scene is intentional.
    scene.add(sunLight);
    scene.add(sunLight.target);
    scene.add(ambientLight);

    for (const player of players) {
      if (player.currentScene === logicalScene) {
        ensureAvatar(player, localPlayerId);
      }
    }

    view.destinationMarker = buildDestinationMarker(scene);
    view.pathGuide = buildPathGuide(scene);
    view.remotePaths.clear();
    return true;
  }

  function poseFor(player, players, now) {
    if (player.activity?.kind === "work") {
      const study =
        Object.values(STUDIES).find(
          (candidate) => candidate.id === player.activity.studyId
        ) ?? STUDIES.A;
      const seat = studySeat(study, player.activity.slot);
      return {
        kind: "work",
        x: seat.x,
        y: 0.58,
        z: seat.z,
        facing: "north",
        lean: 0
      };
    }

    if (player.activity?.kind === "sofa") {
      const seat = sofaSeat(player.activity.slot);
      return {
        kind: "sofa",
        x: seat.x,
        y: 0.58,
        z: seat.z,
        facing: seat.facing,
        lean: 0
      };
    }

    if (player.activity?.kind === "meal") {
      const seat = diningSeat(player.activity.slot);
      return {
        kind: "meal",
        x: seat.x,
        y: 0.58,
        z: seat.z,
        facing: seat.facing,
        lean: 0
      };
    }

    if (player.activity?.kind === "sleep") {
      const bedroom = BEDROOMS[player.activity.bedId] ?? BEDROOMS.A;
      return {
        kind: "sleep",
        x: bedroom.sleep.x,
        y: 0.66,
        z: bedroom.sleep.z,
        facing: "south",
        rotationX: -Math.PI / 2
      };
    }

    const activity = getActivity(player);
    if (!activity) return null;

    if (activity.kind === "swing") {
      const swing = PLAYGROUND.swing;
      const seat =
        swing.seats.find((item) => item.slot === activity.slot) ?? swing.seats[0];
      const motion = swingMotion(players, now);
      const offset = seat.x - swing.pivot.x;
      const y = swing.hangY - Math.cos(motion.angle) * swing.ropeLength;
      const z = swing.pivot.y - Math.sin(motion.angle) * swing.ropeLength;
      return {
        kind: "swing",
        x: swing.pivot.x + offset,
        y: y + 0.05,
        z,
        facing: "south",
        lean: motion.angle * 0.55
      };
    }

    const seesaw = PLAYGROUND.seesaw;
    const end =
      seesaw.ends.find((item) => item.side === activity.side) ??
      seesaw.ends[0];
    const motion = seesawMotion(players, now);
    const offset = end.x - seesaw.pivot.x;
    return {
      kind: "seesaw",
      x: seesaw.pivot.x + offset * Math.cos(motion.angle),
      // 0.46 is the board pivot height in the scene.
      y: 0.46 + offset * Math.sin(motion.angle) + 0.08,
      z: seesaw.pivot.y,
      facing: end.side === "a" ? "east" : "west",
      lean: -motion.angle * 0.45
    };
  }

  function syncPlayers(
    players,
    localPlayerId,
    elapsed,
    deltaSeconds = 0.016,
    now = clockNow()
  ) {
    const seen = new Set();
    const offliners =
      view.logicalScene === SCENE.INDOOR_1 ? offlineSleepers(players) : [];
    const visiblePlayers = [...players, ...offliners];
    view.visiblePlayers = visiblePlayers;

    for (const player of visiblePlayers) {
      if (player.currentScene !== view.logicalScene) {
        const hiddenAvatar = view.avatars.get(player.id);
        if (hiddenAvatar) {
          disposeTreeResources(hiddenAvatar);
          hiddenAvatar.removeFromParent();
          view.avatars.delete(player.id);
        }
        continue;
      }

      seen.add(player.id);
      const avatar = ensureAvatar(player, localPlayerId);
      if (!avatar) continue;

      const pose = poseFor(player, players, now);

      if (player.id === localPlayerId) {
        syncAvatar(avatar, player, elapsed, {
          deltaSeconds,
          pose,
          position: pose ? { x: pose.x, y: pose.z } : undefined,
          moving: pose ? false : undefined
        });
        continue;
      }

      if (pose) {
        syncAvatar(avatar, player, elapsed, {
          deltaSeconds,
          pose,
          position: { x: pose.x, y: pose.z },
          moving: false
        });
        continue;
      }

      // Remote players are presentation-only. Interpolate the avatar toward
      // the latest presence without writing back into game state.
      const targetX = player.position.x;
      const targetY = player.position.y;
      const dx = targetX - avatar.position.x;
      const dz = targetY - avatar.position.z;
      const distance = Math.hypot(dx, dz);
      const alpha = 1 - Math.exp(-12 * Math.min(Math.max(deltaSeconds, 0), 0.1));

      let nextX;
      let nextY;
      if (distance > 2) {
        nextX = targetX;
        nextY = targetY;
      } else {
        nextX = avatar.position.x + dx * alpha;
        nextY = avatar.position.z + dz * alpha;
      }

      syncAvatar(avatar, player, elapsed, {
        deltaSeconds,
        position: { x: nextX, y: nextY },
        moving: distance > 0.02
      });
    }

    for (const [playerId, avatar] of [...view.avatars]) {
      if (seen.has(playerId)) continue;
      disposeTreeResources(avatar);
      avatar.removeFromParent();
      view.avatars.delete(playerId);
    }

    const sleepingBeds = new Set(
      visiblePlayers
        .filter((player) => player.activity?.kind === "sleep")
        .map((player) => player.activity.bedId)
    );
    for (const entry of view.props.sleepLabels?.labels ?? []) {
      const sleeping = sleepingBeds.has(entry.id);
      entry.el.style.display = sleeping ? "" : "none";
      if (entry.action) entry.action.style.display = sleeping ? "none" : "";
    }
    const workingStudies = new Set(
      visiblePlayers
        .filter((player) => player.activity?.kind === "work")
        .map((player) => player.activity.studyId)
    );
    for (const entry of view.props.workLabels?.labels ?? []) {
      entry.el.style.display = workingStudies.has(entry.id) ? "none" : "";
    }
  }

  function remotePathFor(player, currentState, now) {
    const cached = view.remotePaths.get(player.id);
    const decorKey = Object.keys(currentState.world?.decor ?? {})
      .filter((id) => currentState.world.decor[id])
      .sort()
      .join(",");
    const key = [
      player.currentScene,
      player.position.x.toFixed(2),
      player.position.y.toFixed(2),
      player.destination.x.toFixed(2),
      player.destination.y.toFixed(2),
      decorKey
    ].join("|");

    if (cached && cached.key === key && now - cached.at < 350) {
      return cached.path;
    }

    const result = findPath(
      player.currentScene,
      player.position,
      player.destination,
      [
        ...decorObstaclesFor(player.currentScene, currentState.world),
        ...bedroomObstaclesFor(player)
      ]
    );
    const path = result?.path?.length
      ? [{ ...player.position }, ...result.path]
      : null;
    view.remotePaths.set(player.id, { key, path, at: now });
    return path;
  }

  function localPathFor(player, currentState) {
    if (player.path?.length) {
      const from = Math.max(0, Math.min(player.path.length - 1, player.pathIndex ?? 0));
      return [{ ...player.position }, ...player.path.slice(from)];
    }
    const result = findPath(
      player.currentScene,
      player.position,
      player.destination,
      [
        ...decorObstaclesFor(player.currentScene, currentState.world),
        ...bedroomObstaclesFor(player)
      ]
    );
    return result?.path?.length
      ? [{ ...player.position }, ...result.path]
      : null;
  }

  /**
   * Dotted route guides for every visible player. The local route uses the
   * exact A* waypoints already in state; a remote route is reconstructed from
   * the destination shared in presence, so no full path is sent every tick.
   */
  function syncPaths(currentState, localPlayerId, now = clockNow()) {
    const guide = view.pathGuide;
    if (!guide) return;

    const players = Object.values(currentState.players ?? {});
    const entries = [];
    const seen = new Set();
    const offliners =
      view.logicalScene === SCENE.INDOOR_1 ? offlineSleepers(players) : [];
    const visiblePlayers = [...players, ...offliners];
    view.visiblePlayers = visiblePlayers;

    for (const player of visiblePlayers) {
      if (player.currentScene !== view.logicalScene || !player.destination) continue;
      seen.add(player.id);
      const path =
        player.id === localPlayerId
          ? localPathFor(player, currentState)
          : remotePathFor(player, currentState, now);
      if (!path || path.length < 2) continue;
      entries.push({
        kind: player.id === localPlayerId ? "local" : "remote",
        path
      });
    }

    for (const id of [...view.remotePaths.keys()]) {
      if (!seen.has(id)) view.remotePaths.delete(id);
    }

    updatePathGuide(guide, entries);
  }

  function syncWeather(
    currentState,
    elapsed,
    now = clockNow(),
    weatherOverride = null
  ) {
    const effects = view.props.weather;
    if (!effects) return;

    const daylight = daylightAt(now);
    const weather = weatherOverride ?? getWeather(now).id;
    const night = daylight.nightness > 0.58;
    const player = getActivePlayer(currentState);

    if (effects.fireflies) {
      effects.fireflies.visible = night && weather !== "rain";
      if (effects.fireflies.visible) {
        for (const fly of effects.fireflies.children) {
          const base = fly.userData.base;
          if (!base) continue;
          fly.position.x = base.x + Math.sin(elapsed * 0.0013 + base.z) * 0.25;
          fly.position.y = base.y + Math.sin(elapsed * 0.0017 + base.x) * 0.12;
          fly.position.z = base.z + Math.cos(elapsed * 0.0011 + base.x) * 0.2;
        }
      }
    }

    if (effects.rain) {
      effects.rain.visible = weather === "rain";
      if (effects.rain.visible && player) {
        effects.rain.position.x = player.position.x;
        effects.rain.position.z = player.position.y;
        for (let i = 0; i < effects.drops.length; i += 1) {
          const drop = effects.drops[i];
          const mesh = effects.rain.children[i];
          const fall = (elapsed * 0.001 * drop.speed + drop.offset) % 3.2;
          mesh.position.y = 2.9 - fall;
        }
      }
    }
  }

  /**
   * Bedroom doors are visual only. Movement blocks non-owners at the door;
   * for the owner the leaf opens smoothly when they approach or are inside.
   */
  function syncBedroomDoors(players, deltaSeconds) {
    const props = view.props.bedroomDoors;
    if (!props?.doors?.length) return;
    const dt = Math.max(0, Math.min(0.1, Number(deltaSeconds) || 0));
    for (const door of props.doors) {
      const owner = players.find(
        (player) =>
          player.currentScene === SCENE.INDOOR_1 && player.name === door.owner
      );
      const near = Boolean(
        owner &&
          (Math.hypot(
            owner.position.x - door.center.x,
            owner.position.y - door.center.z
          ) <= 2.5 ||
            owner.position.y < -1.2)
      );
      const target = near ? door.openAngle : door.closedAngle;
      const speed = near ? 8.5 : 5.5;
      const t = Math.min(1, dt * speed);
      door.pivot.rotation.y += (target - door.pivot.rotation.y) * t;
    }
  }

  function syncSpirit(currentState, elapsed, now = clockNow()) {
    const spirit = view.props.spirit;
    if (!spirit) return;

    const pose = spiritPose(now);
    spirit.position.x = pose.x;
    spirit.position.z = pose.y;
    spirit.position.y = pose.sleeping ? 0.012 : 0;
    spirit.rotation.y = FACING_YAW[pose.facing] ?? 0;
    const baseScale = spirit.userData.baseScale ?? 1;
    spirit.scale.set(
      baseScale,
      baseScale * (pose.sleeping ? 0.92 : 1),
      baseScale
    );

    const body = spirit.userData.body;
    const head = spirit.userData.head;
    const leaf = spirit.userData.leaf;
    const tail = spirit.userData.tail;
    const legs = spirit.userData.legs ?? [];
    const eyes = spirit.userData.eyes;
    const hearts = spirit.userData.hearts;

    if (body) {
      body.rotation.z = pose.sleeping ? 0.16 : 0;
      body.position.y = pose.sleeping
        ? 0.01
        : 0.015 + Math.sin(elapsed * 0.0045) * 0.012;
    }
    if (head) {
      head.position.y = pose.sleeping ? 0.54 : 0.57;
      head.rotation.z = pose.sleeping ? -0.16 : -0.03;
      head.rotation.y = pose.sleeping
        ? 0
        : Math.sin(elapsed * 0.0022) * 0.035;
    }
    if (leaf) {
      leaf.rotation.z = pose.sleeping
        ? 0.35
        : Math.sin(elapsed * 0.0035 + 0.7) * 0.12;
      leaf.rotation.x = pose.sleeping ? 0.25 : 0;
    }
    if (eyes) eyes.scale.y = pose.sleeping ? 0.1 : 1;
    for (const leg of legs) {
      leg.rotation.z = pose.sleeping ? 0.25 : 0;
    }
    if (tail) {
      tail.rotation.y = pose.sleeping
        ? 0.3
        : Math.sin(elapsed * 0.0031) * 0.2;
      tail.rotation.x = pose.sleeping ? 0.1 : 0;
    }

    const local = getActivePlayer(currentState);
    if (spirit.labelEl && local) {
      const near =
        Math.hypot(local.position.x - pose.x, local.position.y - pose.y) <= 3.2;
      spirit.labelEl.style.opacity = near ? "1" : "0.35";
    }

    const greets = currentState.ui?.spiritGreets ?? 0;
    if (view.spiritGreets === null) view.spiritGreets = greets;
    if (greets !== view.spiritGreets) {
      view.spiritGreets = greets;
      view.spiritHeartUntil = elapsed + 1400;
    }
    if (hearts) {
      const visible = elapsed < view.spiritHeartUntil;
      hearts.visible = visible;
      if (visible) {
        const t = (view.spiritHeartUntil - elapsed) / 1400;
        hearts.position.y = 1.06 + (1 - t) * 0.3;
        for (let i = 0; i < hearts.children.length; i += 1) {
          const heart = hearts.children[i];
          heart.position.y = Math.sin(elapsed * 0.006 + i) * 0.035;
          heart.rotation.y = Math.sin(elapsed * 0.004 + i) * 0.35;
        }
      }
    }
  }

  function syncPlayground(players, now = clockNow(), localPlayerId = null) {
    const swing = view.props.swing;
    if (swing) {
      swing.pivot.rotation.x = swingMotion(players, now).angle;
    }
    const seesaw = view.props.seesaw;
    if (seesaw) {
      seesaw.pivot.rotation.z = seesawMotion(players, now).angle;
    }

    // Prop labels fade back when the player is nowhere near, so the yard does
    // not read as a wall of dark pills.
    const local = players.find((player) => player.id === localPlayerId) ?? null;
    for (const key of ["swing", "seesaw"]) {
      const prop = view.props[key];
      if (!prop?.labelEl) continue;
      const anchor = PLAYGROUND[key].pivot;
      const near =
        Boolean(local) &&
        (local.activity?.kind === key ||
          Math.hypot(
            local.position.x - anchor.x,
            local.position.y - anchor.y
          ) <= 2.35);
      prop.labelEl.style.opacity = near ? "1" : "0.5";
    }
  }

  function syncMarker(player, elapsed) {
    syncDestinationMarker(
      view.destinationMarker,
      player.activity ? { ...player, destination: null } : player,
      elapsed
    );
  }

  /**
   * Presentation-only crop state. Growth stages are derived from timestamps;
   * no gameplay state is written here.
   */
  function syncFarm(currentState, now = clockNow()) {
    const player = getActivePlayer(currentState);
    if (!player) return;

    const selectedId = FARM_SCENES.has(player.currentScene)
      ? currentState.ui.selectedPlotId
      : null;

    const hideGreenhousePlots =
      player.currentScene === SCENE.OUTDOOR &&
      Boolean(currentState.world?.greenhouse);
    const meadowGate = view.props.meadowGate;
    if (meadowGate) {
      meadowGate.setUnlocked(Boolean(currentState.world?.scenes?.meadow));
    }
    const dockGate = view.props.dockGate;
    if (dockGate) {
      dockGate.setUnlocked(Boolean(currentState.world?.scenes?.dock));
    }
    const orchardGate = view.props.orchardGate;
    if (orchardGate) {
      orchardGate.setUnlocked(Boolean(currentState.world?.scenes?.orchard));
    }
    const springGate = view.props.springGate;
    if (springGate) {
      springGate.setUnlocked(Boolean(currentState.world?.scenes?.spring));
    }

    for (const id of PLOT_IDS) {
      const plotView = view.plotViews[id];
      if (!plotView) continue;

      const hidden = hideGreenhousePlots && GREENHOUSE_PLOTS.includes(id);
      if (plotView.root.visible === hidden) plotView.root.visible = !hidden;
      if (plotView.labelEl.style.display !== (hidden ? "none" : "")) {
        plotView.labelEl.style.display = hidden ? "none" : "";
      }
      if (hidden) continue;

      const plot = currentState.plots[id];
      const stage = getCropStage(plot, now);
      const selected = id === selectedId;
      const locked = !plot?.unlocked;
      const hazard = getPlotHazard(plot, now)?.kind ?? null;

      if (plot?.crop && plotView.cropType !== plot.crop.type) {
        plotView.setCropType(plot.crop.type);
      }

      if (plotView.lastStage !== stage) {
        for (const [key, group] of Object.entries(plotView.cropGroups)) {
          group.visible = key === stage;
        }
        plotView.lastStage = stage;
      }

      if (plotView.lastLocked !== locked) {
        plotView.lockedOverlay.visible = locked;
        plotView.labelEl.classList.toggle("is-locked", locked);
        plotView.lastLocked = locked;
      }

      if (plotView.lastHazard !== hazard) {
        plotView.hazardGroups.weeds.visible = hazard === "weeds";
        plotView.hazardGroups.pest.visible = hazard === "pest";
        plotView.lastHazard = hazard;
      }

      if (plotView.lastSelected !== selected) {
        plotView.selectionFrame.visible = selected;
        plotView.labelEl.classList.toggle("is-selected", selected);
        plotView.lastSelected = selected;
      }

      const isReady = stage === "ready";
      if (plotView.lastReady !== isReady) {
        plotView.labelEl.classList.toggle("is-ready", isReady);
        plotView.lastReady = isReady;
      }
    }

    const greenhouse = view.props.greenhouse;
    if (greenhouse) {
      const built = Boolean(currentState.world?.greenhouse);
      if (greenhouse.group.visible !== built) {
        greenhouse.group.visible = built;
      }
      greenhouse.labelEl.style.display = built ? "" : "none";
      if (greenhouse.site) {
        greenhouse.site.visible = !built;
      }
      if (greenhouse.siteLabel) {
        greenhouse.siteLabel.style.display = built ? "none" : "";
      }
    }
  }

  function syncDecor(currentState) {
    const decor = view.props.decor;
    if (!decor) return;

    const owned = currentState.world?.decor ?? {};
    for (const [itemId, group] of Object.entries(decor.views ?? {})) {
      group.visible = Boolean(owned[itemId]);
    }
    const anyOwned = Object.keys(owned).length > 0;
    for (const mesh of decor.emptyMeshes ?? []) {
      mesh.visible = !anyOwned;
    }
    if (decor.emptyLabel) {
      decor.emptyLabel.style.display = anyOwned ? "none" : "";
    }
  }

  /**
   * The dining table is both a seat and a one-press "eat" control depending
   * on the local player's state, so the hitbox action is updated every frame.
   * The bowl and its steam only exist while a dish is waiting on the table.
   */
  function syncKitchen(currentState, elapsed = 0) {
    if (view.logicalScene !== SCENE.INDOOR_1) return;
    const dining = view.props.dining;
    if (!dining) return;

    const meal = currentState.world?.meal ?? null;
    const dish = meal ? DISHES[meal.dishId] ?? null : null;
    const local = currentState.players?.[currentState.activePlayerId];
    const seated = Boolean(
      local &&
        local.currentScene === SCENE.INDOOR_1 &&
        local.activity?.kind === "meal"
    );

    dining.group.visible = Boolean(dish);
    if (dish) {
      if (dining.lastSoupId !== meal.dishId) {
        dining.soup.material.color.set(dish.soup);
        dining.lastSoupId = meal.dishId;
      }
      for (const puff of dining.steam) {
        const cycle = (elapsed * 0.0011 + puff.phase) % 1;
        puff.mesh.position.y = 0.22 + cycle * 0.24;
        puff.mesh.scale.setScalar(0.78 + cycle * 0.42);
        puff.mesh.material.opacity = 0.03 + (1 - cycle) * 0.16;
      }
    }

    dining.hitbox.userData.interaction.action =
      seated && dish ? ACTION.EAT_MEAL : ACTION.SIT_MEAL;
    const text = dish
      ? seated
        ? "点桌开饭 · 点椅起身"
        : `${meal.byName}留的${dish.short}`
      : seated
        ? "点椅起身"
        : "餐桌";
    if (dining.label.textContent !== text) dining.label.textContent = text;
  }

  function updateLabels(players, localPlayerId) {
    labels.update({
      camera,
      width: canvas.clientWidth,
      height: canvas.clientHeight,
      players: view.visiblePlayers ?? players,
      localPlayerId,
      avatars: view.avatars
    });
  }

  function beginSceneTransition({
    kind,
    toScene,
    players = [],
    localPlayerId = null,
    at = 0
  }) {
    if (view.transition) finishTransition();

    const door =
      kind === "enter" || kind === "exit" ? (view.doors[0] ?? null) : null;
    const avatar = view.avatars.get(localPlayerId) ?? null;
    view.transition = {
      kind: TRANSITIONS[kind] ? kind : "enter",
      toScene,
      players: [...players],
      localPlayerId,
      startedAt: at,
      door,
      doorFrom: door?.pivot?.rotation?.y ?? 0,
      doorTo: door?.openAngle ?? 0,
      avatar,
      start: avatar
        ? { x: avatar.position.x, y: avatar.position.y, z: avatar.position.z }
        : null,
      swapped: false
    };
  }

  function animateTransitionAvatar(avatar, transition, elapsed) {
    const timeline = TRANSITIONS[transition.kind];
    const start = transition.start;
    if (!avatar || !start) return;

    if (transition.kind === "upstairs") {
      const t = easeInOut(elapsed / (timeline.climbEnd || 760));
      avatar.position.x = start.x + (STAIRS.top.x - start.x) * t;
      avatar.position.z = start.z + (STAIRS.top.y - start.z) * t;
      // Both floors share the same visual Y. Use a small stair arc, never a
      // one-storey lift; the old 1.42-unit endpoint left the avatar floating.
      avatar.position.y = 0.012 + Math.sin(Math.PI * t) * 0.2;
      avatar.rotation.y = Math.PI;
      const legs = avatar.userData.legPivots ?? [];
      const swing = Math.sin(elapsed * 0.03) * 0.45;
      legs[0] && (legs[0].rotation.x = swing);
      legs[1] && (legs[1].rotation.x = -swing);
    } else if (transition.kind === "downstairs") {
      const t = easeInOut(elapsed / (timeline.climbEnd || 680));
      avatar.position.x = start.x + (STAIRS.bottom.x - start.x) * t;
      avatar.position.z = start.z + (STAIRS.bottom.y - start.z) * t;
      avatar.position.y = 0.012 + Math.sin(Math.PI * t) * 0.14;
      avatar.rotation.y = 0;
    } else {
      const t = easeOut(elapsed / Math.max(1, timeline.doorEnd));
      const direction =
        transition.kind === "enter" ||
        transition.kind === "greenhouseEnter" ||
        transition.kind === "meadowEnter" ||
        transition.kind === "dockEnter" ||
        transition.kind === "orchardEnter" ||
        transition.kind === "springEnter"
          ? -1
          : 1;
      avatar.position.z = start.z + direction * 0.22 * t;
    }

    const shadow = avatar.userData.shadow;
    if (shadow) shadow.position.y = 0.02 - avatar.position.y;
  }

  function swapTransition() {
    const transition = view.transition;
    if (!transition || transition.swapped) return;

    if (view.threeKey) {
      disposeScene(scenes[view.threeKey]);
    }
    view.logicalScene = null;
    view.threeKey = null;
    transition.swapped = true;

    mountForScene(
      transition.toScene,
      transition.players,
      transition.localPlayerId
    );
  }

  function finishTransition() {
    const transition = view.transition;
    if (!transition) return;
    if (!transition.swapped) swapTransition();
    view.transition = null;
    fade?.setBlack(0);
  }

  function updateTransition(now) {
    const transition = view.transition;
    if (!transition) return;

    const elapsed = Math.max(0, now - transition.startedAt);
    const timeline = TRANSITIONS[transition.kind];

    if (transition.door) {
      const t = easeOut(elapsed / Math.max(1, timeline.doorEnd));
      transition.door.pivot.rotation.y =
        transition.doorFrom + (transition.doorTo - transition.doorFrom) * t;
    }

    if (!transition.swapped) {
      animateTransitionAvatar(transition.avatar, transition, elapsed);
    }

    fade?.setBlack(transitionFade(elapsed, timeline));

    if (!transition.swapped && elapsed >= timeline.swapAt) {
      swapTransition();
    }
    if (elapsed >= timeline.end) {
      finishTransition();
    }
  }

  function cancelTransition() {
    if (!view.transition) return;
    finishTransition();
  }

  function resetScene() {
    if (view.threeKey) disposeScene(scenes[view.threeKey]);
    view.logicalScene = null;
    view.threeKey = null;
    view.transition = null;
    fade?.setBlack(0);
  }

  function showChatBubble(playerId, info) {
    labels.setBubble(playerId, info);
  }

  function hideChatBubble(playerId) {
    labels.hideBubble(playerId);
  }

  return {
    mountForScene,
    syncPlayers,
    syncPaths,
    syncWeather,
    syncSpirit,
    syncBedroomDoors,
    syncMarker,
    syncFarm,
    syncPlayground,
    syncDecor,
    syncKitchen,
    updateLabels,
    beginSceneTransition,
    updateTransition,
    cancelTransition,
    isTransitioning: () => Boolean(view.transition),
    resetScene,
    showChatBubble,
    hideChatBubble,
    getInteractables: () => view.interactables,
    getActiveScene: () => (view.threeKey ? scenes[view.threeKey] : null),
    getProps: () => view.props,
    getAvatarCount: () => view.avatars.size
  };
}
