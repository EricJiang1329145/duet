import {
  ACTION,
  APPROACH_POINTS,
  CROPS,
  DINING,
  FARM_SCENES,
  SCENE,
  SOFA,
  bedroomForPlayer,
  plotSceneFor,
  studyById,
  studySeat
} from "../config.js";
import {
  appendBoardMessage,
  boardUnreadCount,
  createBoardMessage,
  normalizeBoardText
} from "./board.js";
import {
  applyFarmAction,
  getFarmNotice,
  harvestReward,
  validateFarmAction
} from "./farmRules.js";
import { getPlotHazard } from "./crop.js";
import { inspectText } from "./inspect.js";
import {
  applySceneAction,
  getSceneNotice,
  validateSceneAction
} from "./sceneRules.js";
import {
  clearPlotSelection,
  getActivePlayer,
  moveActivePlayer,
  replaceActivePlayer,
  stopActiveMovement,
  withNotice,
  withoutNotice
} from "./player.js";
import { mealLabel, nearDining, nearKitchen } from "./kitchen.js";
import { SPIRIT_NAME, spiritPose } from "./spirit.js";
import {
  advancePlayerMovement,
  isNearApproach,
  planWalk,
  SCENE_CHANGE_KINDS,
  sceneChangeFor
} from "./movement.js";
import {
  SEAT_TEXT,
  sitPlayer,
  standPlayer,
  validateSeat
} from "./playground.js";

function closeBoard(state) {
  if (!state.ui.boardOpen) return state;
  return { ...state, ui: { ...state.ui, boardOpen: false } };
}

function withBoardUnreadNotice(state) {
  const player = getActivePlayer(state);
  if (!player) return state;
  const count = state.ui.boardOpen
    ? 0
    : boardUnreadCount(
        state.board?.messages,
        state.board?.lastReadAt,
        player.id
      );
  const meal = state.world?.meal;
  const parts = [];
  if (count > 0) parts.push(`留言板有 ${count} 条新留言`);
  if (meal && meal.byId !== player.id) parts.push(`桌上有${mealLabel(meal)}`);
  if (!parts.length) return state;
  return withNotice(state, parts.join(" · "), count > 0 ? "board" : "info");
}

const KITCHEN_ERROR_TEXT = Object.freeze({
  NOT_KITCHEN_SCENE: "回一层厨房才能做饭。",
  TOO_FAR_FROM_KITCHEN: "先走到灶台旁。",
  TOO_FAR_FROM_TABLE: "先走到餐桌旁。",
  UNKNOWN_RECIPE: "没有这道菜谱。",
  MISSING_INGREDIENTS: "食材还不够，再去收获或采集一些。",
  UNKNOWN_DISH: "没有这道菜。",
  NO_DISH: "这道菜已经用完了。",
  MEAL_EXISTS: "桌上已经有一份饭了，先吃掉或等对方回来。",
  NO_MEAL: "桌上还没有饭，先去灶台做一份。"
});

function leaveSeat(state) {
  const player = getActivePlayer(state);
  if (!player?.activity) return state;
  if (player.activity.kind === "sleep") {
    const bedroom = bedroomForPlayer(player);
    return replaceActivePlayer(state, {
      activity: null,
      position: bedroom
        ? { x: bedroom.wake.x, y: bedroom.wake.z }
        : player.position,
      destination: null,
      path: [],
      pathIndex: 0
    });
  }
  if (player.activity.kind === "work") {
    const study = studyById(player.activity.studyId);
    return replaceActivePlayer(state, {
      activity: null,
      position: study
        ? { x: study.stand.x, y: study.stand.z }
        : player.position,
      destination: null,
      path: [],
      pathIndex: 0
    });
  }
  if (player.activity.kind === "sofa") {
    return replaceActivePlayer(state, {
      activity: null,
      position: { x: SOFA.stand.x, y: SOFA.stand.z },
      destination: null,
      path: [],
      pathIndex: 0
    });
  }
  if (player.activity.kind === "meal") {
    return replaceActivePlayer(state, {
      activity: null,
      position: { x: DINING.stand.x, y: DINING.stand.z },
      destination: null,
      path: [],
      pathIndex: 0
    });
  }
  // Standing up also moves the player to the prop's stand point. Seat anchors
  // can sit outside the walkable band (the seesaw now does), so clearing the
  // activity in place would leave the player unable to walk away.
  return standPlayer(state, player.id);
}

function withPending(state, patch) {
  return {
    ...state,
    ui: {
      ...state.ui,
      pendingScene: null,
      pendingSeat: null,
      ...patch
    }
  };
}

/**
 * Walk to the interaction point first. When the player is already close the
 * scene change / seat happens immediately, so clicking twice always works.
 */
function approachOrEnter(state, player, kind) {
  const target = APPROACH_POINTS[kind];
  if (!target) return state;

  if (isNearApproach(player, kind)) {
    const change = sceneChangeFor(player.currentScene, kind);
    if (!change) return state;
    const moved = moveActivePlayer(
      state,
      change.scene,
      change.position,
      change.facing
    );
    const next = withPending(moved, { pendingScene: null, pendingSeat: null });
    return change.readsBoard ? withBoardUnreadNotice(next) : next;
  }

  const base = leaveSeat(state);
  const latest = getActivePlayer(base);
  const patch = planWalk(base, latest, target);
  if (!patch) {
    return withNotice(state, "这条路暂时走不过去。", "info");
  }
  const { adjusted, ...playerPatch } = patch;
  void adjusted;
  const walking = replaceActivePlayer(base, playerPatch);
  const pending = withPending(clearPlotSelection(walking), {
    pendingScene: { kind }
  });
  const copy =
    kind === "upstairs" || kind === "downstairs"
      ? "先走到楼梯口。"
      : "先走到门口再进去。";
  return withNotice(pending, copy, "info");
}

function seatOrWalk(state, player, kind, payload) {
  const seat = validateSeat(state, player.id, kind, payload);
  if (seat.ok && seat.stand) {
    return clearPlotSelection(standPlayer(state, player.id));
  }
  if (seat.ok) {
    return clearPlotSelection(
      sitPlayer(state, player.id, seat, payload?.when ?? Date.now())
    );
  }
  if (seat.code === "TOO_FAR") {
    const target = seat.stand;
    const base = leaveSeat(state);
    const latest = getActivePlayer(base);
    const patch = planWalk(base, latest, target);
    if (!patch) {
      return withNotice(state, SEAT_TEXT.TOO_FAR, "info");
    }
    const { adjusted, ...playerPatch } = patch;
    void adjusted;
    const walking = replaceActivePlayer(base, playerPatch);
    return withNotice(
      withPending(clearPlotSelection(walking), {
        pendingSeat: { kind, side: payload?.side ?? null }
      }),
      `先走到${kind === "swing" ? "秋千" : "跷跷板"}旁边。`,
      "info"
    );
  }
  return withNotice(
    state,
    SEAT_TEXT[seat.code] ?? "这里坐不了。",
    "info"
  );
}

/**
 * The one and only reducer. It knows nothing about Three.js, DOM, timers,
 * audio or networking. Every accepted operation arrives as:
 *   { who, when, action, targetId, payload }
 */
export function reducer(currentState, event) {
  const player = getActivePlayer(currentState);
  if (!player) return currentState;
  const when = Number.isFinite(event.when) ? event.when : Date.now();

  switch (event.action) {
    case ACTION.UNLOCK_SCENE:
    case ACTION.COLLECT_RESOURCE:
    case ACTION.SELL_GOODS: {
      const check = validateSceneAction(
        currentState,
        player.id,
        event.action,
        event.targetId,
        event.payload,
        when
      );
      if (!check.ok) {
        const copy = {
          NO_COINS: "金币不够，再去卖点作物吧。",
          SCENE_LOCKED: "这个场景还没有解锁。",
          ALREADY_UNLOCKED: "这个场景已经解锁了。",
          ALREADY_COLLECTED: "今天这里已经采过了，明天再来。",
          NOT_ENOUGH_GOODS: "仓库里的数量不够。",
          WRONG_SCENE: "要走到那个场景里才能采集。",
          UNKNOWN_RESOURCE: "这里没有可以采集的东西。"
        }[check.code];
        return copy ? withNotice(currentState, copy, "error") : currentState;
      }
      const nextState = applySceneAction(
        currentState,
        player.id,
        event.action,
        event.targetId,
        event.payload,
        when
      );
      if (!nextState) return currentState;
      const notice = getSceneNotice(
        event.action,
        nextState,
        { ...(event.payload ?? {}), sceneId: event.targetId },
        check
      );
      return withNotice(nextState, notice.text, notice.tone);
    }

    case ACTION.RAIN_WATER: {
      const watered = applyFarmAction(
        currentState,
        player.id,
        ACTION.RAIN_WATER,
        null,
        event.payload ?? null,
        when
      );
      if (!watered || watered === currentState) return currentState;
      const notice = getFarmNotice(ACTION.RAIN_WATER, watered);
      return withNotice(watered, notice.text, notice.tone);
    }

    case ACTION.FIELD_CLICKED: {
      if (!FARM_SCENES.has(player.currentScene)) return currentState;
      if (!currentState.plots[event.targetId]) return currentState;
      if (plotSceneFor(currentState.world, event.targetId) !== player.currentScene) {
        return currentState;
      }

      const stopped = leaveSeat(stopActiveMovement(currentState));
      return {
        ...stopped,
        ui: {
          ...stopped.ui,
          selectedPlotId: event.targetId,
          pendingScene: null,
          pendingSeat: null
        }
      };
    }

    case ACTION.PLANT_CROP:
    case ACTION.WATER_CROP:
    case ACTION.HARVEST_CROP:
    case ACTION.CLEAR_HAZARD:
    case ACTION.UNLOCK_PLOT: {
      if (currentState.ui.selectedPlotId !== event.targetId) return currentState;
      const plot = currentState.plots[event.targetId];
      if (!plot) return currentState;

      const payload =
        event.action === ACTION.PLANT_CROP
          ? { cropType: event.payload?.cropType ?? CROPS.radish.id }
          : { ...event.payload };

      if (event.action === ACTION.WATER_CROP) {
        payload.cropType = plot.crop?.type ?? CROPS.radish.id;
      }
      if (event.action === ACTION.HARVEST_CROP) {
        Object.assign(payload, harvestReward(plot, currentState));
      }
      if (event.action === ACTION.CLEAR_HAZARD) {
        payload.hazardKind = getPlotHazard(plot, when)?.kind ?? "weeds";
      }

      const nextState = applyFarmAction(
        currentState,
        player.id,
        event.action,
        event.targetId,
        payload,
        when
      );
      if (!nextState) return currentState;

      const notice = getFarmNotice(event.action, nextState, payload);
      return notice
        ? withNotice(nextState, notice.text, notice.tone)
        : nextState;
    }

    case ACTION.BUY_SEED:
    case ACTION.BUY_GREENHOUSE:
    case ACTION.CLAIM_GIFT: {

      const payload = { ...event.payload };
      if (event.action === ACTION.BUY_SEED) {
        payload.cropType = payload.cropType ?? CROPS.radish.id;
        payload.count = payload.count ?? 1;
      }
      const nextState = applyFarmAction(
        currentState,
        player.id,
        event.action,
        null,
        payload,
        when
      );
      if (!nextState) return currentState;
      const notice = getFarmNotice(event.action, nextState, payload);
      return notice ? withNotice(nextState, notice.text, notice.tone) : nextState;
    }

    case ACTION.BUY_DECOR:
    case ACTION.REMOVE_DECOR: {
      const nextState = applyFarmAction(
        currentState,
        player.id,
        event.action,
        event.targetId,
        { itemId: event.targetId },
        when
      );
      if (!nextState) return currentState;
      const notice = getFarmNotice(event.action, nextState, {
        itemId: event.targetId
      });
      return notice ? withNotice(nextState, notice.text, notice.tone) : nextState;
    }

    case ACTION.OPEN_KITCHEN: {
      if (player.currentScene !== SCENE.INDOOR_1) return currentState;
      if (!nearKitchen(player)) {
        return withNotice(currentState, "先走到灶台旁。", "info");
      }
      const stopped = leaveSeat(
        clearPlotSelection(stopActiveMovement(currentState))
      );
      return {
        ...stopped,
        ui: {
          ...stopped.ui,
          kitchenOpen: true,
          shopOpen: false,
          boardOpen: false,
          decorOpen: false,
          pendingScene: null,
          pendingSeat: null
        }
      };
    }

    case ACTION.CLOSE_KITCHEN:
      return {
        ...currentState,
        ui: { ...currentState.ui, kitchenOpen: false }
      };

    case ACTION.COOK_DISH:
    case ACTION.SELL_DISH:
    case ACTION.SERVE_MEAL:
    case ACTION.EAT_MEAL: {
      const payload = {
        ...(event.payload ?? {}),
        actorId: player.id
      };
      const check = validateFarmAction(
        currentState,
        player.id,
        event.action,
        event.targetId,
        payload,
        when
      );
      if (!check.ok) {
        const copy = KITCHEN_ERROR_TEXT[check.code];
        return copy ? withNotice(currentState, copy, "error") : currentState;
      }
      const nextState = applyFarmAction(
        currentState,
        player.id,
        event.action,
        event.targetId,
        payload,
        when
      );
      if (!nextState) return currentState;
      const notice = getFarmNotice(event.action, nextState, payload, check);
      return notice
        ? withNotice(nextState, notice.text, notice.tone)
        : nextState;
    }

    case ACTION.OPEN_DECOR: {
      if (player.currentScene !== SCENE.INDOOR_2) return currentState;
      const stopped = clearPlotSelection(stopActiveMovement(currentState));
      return {
        ...stopped,
        ui: {
          ...stopped.ui,
          decorOpen: true,
          kitchenOpen: false,
          pendingScene: null,
          pendingSeat: null
        }
      };
    }

    case ACTION.CLOSE_DECOR:
      return { ...currentState, ui: { ...currentState.ui, decorOpen: false } };

    case ACTION.CLOSE_PLOT_PANEL: {
      return clearPlotSelection(currentState);
    }

    case ACTION.OPEN_SHOP: {
      const stopped = leaveSeat(
        clearPlotSelection(stopActiveMovement(currentState))
      );
      return {
        ...stopped,
        ui: {
          ...stopped.ui,
          shopOpen: true,
          kitchenOpen: false,
          pendingScene: null,
          pendingSeat: null
        }
      };
    }

    case ACTION.CLOSE_SHOP: {
      if (!currentState.ui.shopOpen) return currentState;
      return {
        ...currentState,
        ui: { ...currentState.ui, shopOpen: false }
      };
    }

    case ACTION.WALK_TO: {
      return clearPendingAndWalk(currentState, player, {
        x: Number(event.payload?.x),
        y: Number(event.payload?.y)
      });
    }

    case ACTION.MOVE_TICK: {
      const before = player.currentScene;
      let next = advancePlayerMovement(currentState, event.payload?.delta, when);
      const after = next.players[player.id]?.currentScene;
      if (after !== before && after === SCENE.INDOOR_1) {
        next = withBoardUnreadNotice(next);
      }
      return next;
    }

    case ACTION.ENTER_HOUSE:
    case ACTION.EXIT_HOUSE:
    case ACTION.ENTER_GREENHOUSE:
    case ACTION.EXIT_GREENHOUSE:
    case ACTION.ENTER_MEADOW:
    case ACTION.EXIT_MEADOW:
    case ACTION.ENTER_DOCK:
    case ACTION.EXIT_DOCK:
    case ACTION.ENTER_ORCHARD:
    case ACTION.EXIT_ORCHARD:
    case ACTION.ENTER_SPRING:
    case ACTION.EXIT_SPRING:
    case ACTION.GO_UPSTAIRS:
    case ACTION.GO_DOWNSTAIRS: {
      if (
        event.action === ACTION.ENTER_MEADOW &&
        !currentState.world?.scenes?.meadow
      ) {
        return withNotice(
          currentState,
          "花间坡还没解锁，先在面板里花 120 金币修一条小径。",
          "info"
        );
      }
      if (
        event.action === ACTION.ENTER_DOCK &&
        !currentState.world?.scenes?.dock
      ) {
        return withNotice(
          currentState,
          "溪畔码头还没解锁，先在面板里花 180 金币修一座木桥。",
          "info"
        );
      }
      if (
        event.action === ACTION.ENTER_ORCHARD &&
        !currentState.world?.scenes?.orchard
      ) {
        return withNotice(
          currentState,
          "山坡果园还没解锁，先在面板里花 240 金币修一条坡道。",
          "info"
        );
      }
      if (
        event.action === ACTION.ENTER_SPRING &&
        !currentState.world?.scenes?.spring
      ) {
        return withNotice(
          currentState,
          "雾汤温泉还没解锁，先在面板里花 320 金币修一段石阶。",
          "info"
        );
      }
      const kind = SCENE_CHANGE_KINDS[event.action];
      if (!kind) return currentState;
      if (!sceneChangeFor(player.currentScene, kind)) return currentState;
      return approachOrEnter(currentState, player, kind);
    }

    case ACTION.SIT_SWING:
    case ACTION.SIT_SEESAW: {
      if (player.currentScene !== SCENE.OUTDOOR) return currentState;
      const kind = event.action === ACTION.SIT_SWING ? "swing" : "seesaw";
      const targetSide =
        event.targetId === "seesaw_a"
          ? "a"
          : event.targetId === "seesaw_b"
            ? "b"
            : event.payload?.side;
      return seatOrWalk(currentState, player, kind, {
        side: targetSide,
        when
      });
    }

    case ACTION.STAND_UP: {
      if (player.currentScene !== SCENE.OUTDOOR) return currentState;
      return standPlayer(currentState, player.id);
    }

    case ACTION.SIT_SOFA: {
      if (player.currentScene !== SCENE.INDOOR_1) return currentState;
      if (player.activity?.kind === "sofa") {
        return withNotice(
          clearPlotSelection(leaveSeat(currentState)),
          "站起来走走了。",
          "info"
        );
      }
      if (player.activity) {
        return withNotice(currentState, "先离开当前座位，再坐到沙发上。", "info");
      }
      const distance = Math.hypot(
        player.position.x - SOFA.center.x,
        player.position.y - SOFA.center.z
      );
      if (distance > 2.8) {
        return withNotice(currentState, "先走到沙发旁。", "info");
      }
      const used = new Set(
        Object.values(currentState.players)
          .filter(
            (other) =>
              other.id !== player.id &&
              other.activity?.kind === "sofa" &&
              other.currentScene === SCENE.INDOOR_1
          )
          .map((other) => other.activity.slot)
      );
      const seat = SOFA.seats.find((candidate) => !used.has(candidate.slot));
      if (!seat) return withNotice(currentState, "沙发坐满了。", "info");
      const sitting = replaceActivePlayer(currentState, {
        activity: { kind: "sofa", slot: seat.slot, since: when },
        position: { x: seat.x, y: seat.z },
        facing: seat.facing,
        destination: null,
        path: [],
        pathIndex: 0
      });
      return withNotice(clearPlotSelection(sitting), "在沙发上坐下了。", "info");
    }

    case ACTION.SIT_MEAL: {
      if (player.currentScene !== SCENE.INDOOR_1) return currentState;
      if (player.activity?.kind === "meal") {
        const standing = clearPlotSelection(leaveSeat(currentState));
        return withNotice(standing, "从餐桌旁站起来了。", "info");
      }
      if (player.activity) {
        return withNotice(currentState, "先离开当前的座位，再去餐桌。", "info");
      }
      if (!currentState.world?.meal) {
        return withNotice(currentState, "桌上还没有饭，先去灶台做一份。", "info");
      }
      if (!nearDining(player)) {
        return withNotice(currentState, "先走到餐桌旁。", "info");
      }

      const used = new Set(
        Object.values(currentState.players)
          .filter(
            (other) =>
              other.id !== player.id &&
              other.currentScene === SCENE.INDOOR_1 &&
              other.activity?.kind === "meal"
          )
          .map((other) => other.activity.slot)
      );
      // Two clients can click at the same time before the other's presence
      // arrives. Give each player a stable preferred seat from the player ids
      // so both do not always race for slot 0.
      const inScene = Object.values(currentState.players)
        .filter((other) => other.currentScene === SCENE.INDOOR_1)
        .sort((a, b) => String(a.id).localeCompare(String(b.id)));
      const preferredSlot =
        inScene.length >= 2 && inScene.findIndex((other) => other.id === player.id) > 0
          ? 1
          : 0;
      const seat =
        DINING.seats.find(
          (candidate) =>
            candidate.slot === preferredSlot && !used.has(candidate.slot)
        ) ?? DINING.seats.find((candidate) => !used.has(candidate.slot));
      if (!seat) return withNotice(currentState, "餐桌坐满了。", "info");

      const partnerSeated = Object.values(currentState.players).some(
        (other) =>
          other.id !== player.id &&
          other.currentScene === SCENE.INDOOR_1 &&
          other.activity?.kind === "meal"
      );
      const sitting = replaceActivePlayer(currentState, {
        activity: { kind: "meal", slot: seat.slot, since: when },
        position: { x: seat.x, y: seat.z },
        facing: seat.facing,
        destination: null,
        path: [],
        pathIndex: 0
      });
      return withNotice(
        clearPlotSelection(sitting),
        partnerSeated
          ? "两个人都坐好了，点一下餐桌开饭。"
          : "在餐桌旁坐下了，等对方一起开饭。",
        "info"
      );
    }

    case ACTION.WORK: {
      if (player.currentScene !== SCENE.INDOOR_1) return currentState;
      const study = studyById(event.targetId);
      if (!study) return currentState;

      if (player.activity?.kind === "work") {
        if (player.activity.studyId !== study.id) {
          return withNotice(currentState, "先离开当前书桌，再换一个位置。", "info");
        }
        const awake = replaceActivePlayer(currentState, {
          activity: null,
          position: { x: study.stand.x, y: study.stand.z },
          destination: null,
          path: [],
          pathIndex: 0
        });
        return withNotice(clearPlotSelection(awake), "结束工作了。", "info");
      }

      const inside =
        player.position.x >= study.bounds.minX &&
        player.position.x <= study.bounds.maxX &&
        player.position.y >= study.bounds.minZ &&
        player.position.y <= study.bounds.maxZ;
      if (!inside) {
        return withNotice(currentState, "先走进书房，再坐到书桌前。", "info");
      }

      const usedSlots = new Set(
        Object.values(currentState.players)
          .filter(
            (other) =>
              other.id !== player.id &&
              other.currentScene === SCENE.INDOOR_1 &&
              other.activity?.kind === "work" &&
              other.activity.studyId === study.id
          )
          .map((other) => other.activity.slot)
      );
      const seat = study.seats.find((candidate) => !usedSlots.has(candidate.slot));
      if (!seat) return withNotice(currentState, "这张书桌坐满了。", "info");

      const working = replaceActivePlayer(currentState, {
        activity: {
          kind: "work",
          studyId: study.id,
          slot: seat.slot,
          since: when
        },
        position: { x: seat.x, y: seat.z },
        facing: "north",
        destination: null,
        path: [],
        pathIndex: 0
      });
      return withNotice(clearPlotSelection(working), "开始工作了。", "info");
    }

    case ACTION.SLEEP: {
      if (player.currentScene !== SCENE.INDOOR_1) return currentState;
      const bedroom = bedroomForPlayer(player);
      if (!bedroom) return currentState;
      if (event.targetId !== bedroom.id) {
        return withNotice(currentState, "这是别人的床。", "info");
      }

      if (player.activity?.kind === "sleep") {
        const awake = replaceActivePlayer(currentState, {
          activity: null,
          position: { x: bedroom.wake.x, y: bedroom.wake.z },
          destination: null,
          path: [],
          pathIndex: 0
        });
        return withNotice(clearPlotSelection(awake), "醒来了。", "info");
      }

      const insideOwnRoom =
        player.position.y < -1.35 &&
        Math.abs(player.position.x - bedroom.center.x) <= 3.1;
      if (!insideOwnRoom) {
        return withNotice(currentState, "先走进自己的卧室，再躺到床上。", "info");
      }

      const sleeping = replaceActivePlayer(currentState, {
        activity: { kind: "sleep", bedId: bedroom.id, since: when },
        position: { x: bedroom.sleep.x, y: bedroom.sleep.z },
        facing: "north",
        destination: null,
        path: [],
        pathIndex: 0
      });
      return withNotice(clearPlotSelection(sleeping), "躺下休息了。", "info");
    }

    case ACTION.INSPECT: {
      return withNotice(currentState, inspectText(event.targetId), "info");
    }

    case ACTION.GREET_SPIRIT: {
      if (player.currentScene !== SCENE.OUTDOOR) return currentState;
      const spirit = spiritPose(when);
      if (
        Math.hypot(
          player.position.x - spirit.x,
          player.position.y - spirit.y
        ) > 2.4
      ) {
        return withNotice(currentState, `走近${SPIRIT_NAME}再看看它。`, "info");
      }
      const next = withNotice(
        currentState,
        spirit.sleeping
          ? `${SPIRIT_NAME}缩成一颗暖乎乎的小种子，叶子轻轻晃了晃。`
          : `${SPIRIT_NAME}抖了抖头顶的叶子，开心地转了一圈。`,
        "info"
      );
      return {
        ...next,
        ui: {
          ...next.ui,
          spiritGreets: (next.ui.spiritGreets ?? 0) + 1
        }
      };
    }

    case ACTION.READ_BOARD: {
      if (player.currentScene !== SCENE.INDOOR_1) return currentState;

      const stopped = leaveSeat(clearPlotSelection(stopActiveMovement(currentState)));
      const latest = (stopped.board?.messages ?? []).reduce(
        (newest, message) => Math.max(newest, message.createdAt),
        0
      );
      const readAt = Math.max(Number(event.when) || 0, latest);

      return {
        ...stopped,
        ui: {
          ...stopped.ui,
          boardOpen: true,
          kitchenOpen: false,
          pendingScene: null,
          pendingSeat: null
        },
        board: { ...stopped.board, lastReadAt: readAt }
      };
    }

    case ACTION.CLOSE_BOARD:
      return { ...currentState, ui: { ...currentState.ui, boardOpen: false } };

    case ACTION.POST_MESSAGE: {
      const author = currentState.players?.[event.who] ?? player;
      if (author.currentScene !== SCENE.INDOOR_1) return currentState;

      const createdAt = Number.isFinite(event.when) ? event.when : Date.now();
      const text = normalizeBoardText(event.payload?.text);
      if (!text) return currentState;

      const messages = currentState.board?.messages ?? [];
      const message = createBoardMessage(
        {
          id:
            event.payload?.id ??
            `m_${createdAt.toString(36)}_${messages.length.toString(36)}`,
          authorId: author.id,
          authorName: author.name,
          text,
          createdAt
        },
        createdAt
      );
      if (!message) return currentState;

      return {
        ...currentState,
        board: {
          messages: appendBoardMessage(messages, message, createdAt),
          lastReadAt: currentState.ui.boardOpen
            ? Math.max(currentState.board?.lastReadAt ?? 0, message.createdAt)
            : currentState.board?.lastReadAt ?? 0
        }
      };
    }

    case ACTION.CLEAR_NOTICE: {
      const noticeId = event.payload?.noticeId ?? null;
      if (currentState.ui.notice?.id !== noticeId) return currentState;
      return withoutNotice(currentState);
    }

    default:
      return currentState;
  }
}

function clearPendingAndWalk(state, player, target) {
  if (!Number.isFinite(target.x) || !Number.isFinite(target.y)) return state;

  const base = leaveSeat(state);
  const latest = getActivePlayer(base);
  const patch = planWalk(base, latest, target);
  if (!patch) return withNotice(state, "这里走不过去。", "info");

  const { adjusted, ...playerPatch } = patch;
  void adjusted;
  const walking = replaceActivePlayer(base, playerPatch);

  return withPending(clearPlotSelection(walking), {
    pendingScene: null,
    pendingSeat: null
  });
}
