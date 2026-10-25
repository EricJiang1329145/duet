import { ACTION, CHARACTERS, CROP_IDS, SCENE } from "../config.js";
import {
  cloneBoardMessages,
  normalizeBoardText,
  sanitizeBoardMessages
} from "../game/board.js";
import {
  normalizeChatText,
  sanitizeChatMessage
} from "../game/chat.js";
import { isFarmAction } from "../game/farmRules.js";
import { isSceneAction } from "../game/sceneRules.js";
import { sanitizeGoods } from "../game/warehouse.js";
import {
  mealLabel,
  sanitizeDishes,
  sanitizeProduce
} from "../game/kitchen.js";
import { sanitizeWeather } from "../game/weather.js";
import { sanitizeWorld } from "../game/world.js";
import {
  createPlayerEntity,
  getActivePlayer,
  withNotice
} from "../game/player.js";
import { reducer } from "../game/reducer.js";
import { clockNow, getClockOffset, setClockOffset } from "../runtime/clock.js";
import {
  applyPresence,
  clonePlots,
  playerFromPresence,
  presenceOf,
  removePresence
} from "../game/sharedState.js";
import {
  CLIENT_MESSAGE,
  SERVER_MESSAGE,
  SERVER_PROTOCOL_VERSION,
  isServerMessage
} from "./serverProtocol.js";
import { presenceSignature, shouldSendPresence } from "./presenceGate.js";
import { createWsTransport } from "./wsTransport.js";

const NOTICE_DURATION_MS = 3400;
const PRESENCE_INTERVAL_MS = 100;
const PING_INTERVAL_MS = 5000;
const SPAWN = Object.freeze({ x: -1.35, y: -0.15 });

function sanitizeName(value, fallback = CHARACTERS.A.name) {
  const text = typeof value === "string" ? value.trim().slice(0, 12) : "";
  return text || fallback;
}

function sanitizeSeeds(raw) {
  const seeds = {};
  for (const cropId of CROP_IDS) {
    const value = Number(raw?.[cropId]);
    seeds[cropId] = Number.isFinite(value) && value > 0 ? Math.floor(value) : 0;
  }
  return seeds;
}

function sanitizeStats(raw) {
  return {
    harvested: Math.max(0, Math.floor(Number(raw?.harvested) || 0)),
    coins: Math.max(0, Math.floor(Number(raw?.coins) || 0)),
    giftDay: typeof raw?.giftDay === "string" ? raw.giftDay.slice(0, 10) : "",
    cooked: Math.max(0, Math.floor(Number(raw?.cooked) || 0)),
    meals: Math.max(0, Math.floor(Number(raw?.meals) || 0)),
    mealDay: typeof raw?.mealDay === "string" ? raw.mealDay.slice(0, 10) : ""
  };
}

function createClientId() {
  const key = "duet.client.v1";
  try {
    const saved = window.sessionStorage.getItem(key);
    if (saved && /^[a-zA-Z0-9_-]{4,48}$/.test(saved)) return saved;
    const next = `c_${Math.random().toString(36).slice(2, 10)}${Date.now()
      .toString(36)
      .slice(-4)}`;
    window.sessionStorage.setItem(key, next);
    return next;
  } catch {
    return `c_${Math.random().toString(36).slice(2, 10)}`;
  }
}

function buildSocketUrl(base, roomId, name, clientId) {
  const url = new URL(base, window.location.href);
  if (url.protocol === "http:") url.protocol = "ws:";
  if (url.protocol === "https:") url.protocol = "wss:";
  url.searchParams.set("room", roomId);
  url.searchParams.set("name", name);
  url.searchParams.set("client", clientId);
  return url.toString();
}

/**
 * Server-authoritative room client. It mirrors the public surface of
 * createGameSession/createRoomClient so main.js can swap it in. Farm actions
 * are optimistic-free: the server applies them and sends the resulting state.
 */
export function createServerRoomClient({
  initialState,
  roomId,
  name = "",
  wsUrl,
  onStateApplied = null,
  onChatMessage = null,
  onChatAck = null,
  onChatRead = null
}) {
  const clientId = createClientId();
  const basePlayer = getActivePlayer(initialState);
  const requestedName = typeof name === "string" ? name.trim() : "";
  let selfName = sanitizeName(requestedName, CHARACTERS.A.name);
  let selfId = "p_connecting";

  const initialSelf = createPlayerEntity({
    id: selfId,
    name: selfName,
    currentScene: basePlayer?.currentScene ?? SCENE.OUTDOOR,
    position: basePlayer?.position ?? SPAWN,
    facing: basePlayer?.facing ?? "south"
  });

  let state = {
    ...initialState,
    schemaVersion: 3,
    roomId,
    activePlayerId: selfId,
    weather: sanitizeWeather(initialState.weather),
    players: { [selfId]: initialSelf },
    inventory: {
      seeds: { ...initialState.inventory?.seeds },
      goods: sanitizeGoods(initialState.inventory?.goods),
      produce: sanitizeProduce(initialState.inventory?.produce),
      dishes: sanitizeDishes(initialState.inventory?.dishes)
    },
    world: sanitizeWorld(initialState.world),
    ui: {
      ...initialState.ui,
      notice: null,
      selectedPlotId: null,
      boardOpen: false,
      pendingScene: null,
      pendingSeat: null
    },
    board: { messages: [], lastReadAt: 0 },
    room: {
      id: roomId,
      role: "connecting",
      rtt: null
    }
  };

  let joined = false;
  let seq = 0;
  let clientActionId = 0;
  let noticeTimer = 0;
  let presenceTimer = 0;
  let pingTimer = 0;
  let lastRtt = null;
  let lastPresenceSignature = "";
  let lastPresenceSentAt = 0;
  let lastBoardReadSentAt = 0;
  let pendingExport = null;
  let exportChunks = null;
  let hasJoined = false;
  let stopped = false;

  function clockNowForBoard() {
    return Date.now() + getClockOffset();
  }

  function commit(nextState, event = null) {
    if (nextState === state) return state;
    const previousState = state;
    state = nextState;
    onStateApplied?.({ previousState, state, event });
    return state;
  }

  function scheduleNoticeClear() {
    window.clearTimeout(noticeTimer);
    const notice = state.ui.notice;
    if (!notice) return;

    noticeTimer = window.setTimeout(() => {
      commit(
        reducer(state, {
          who: null,
          when: Date.now(),
          action: ACTION.CLEAR_NOTICE,
          targetId: null,
          payload: { noticeId: notice.id }
        }),
        { action: ACTION.CLEAR_NOTICE }
      );
    }, NOTICE_DURATION_MS);
  }

  function notify(text, tone = "info") {
    commit(withNotice(state, text, tone), { action: "ROOM_NOTICE" });
    scheduleNoticeClear();
  }

  function sendPresence(force = false) {
    const player = state.players[selfId];
    if (!player || !joined) return;

    const payload = presenceOf(player);
    const signature = presenceSignature(payload);
    const at = Date.now();
    if (!shouldSendPresence({
      force,
      signature,
      lastSignature: lastPresenceSignature,
      now: at,
      lastSentAt: lastPresenceSentAt
    })) {
      return;
    }

    if (!transport.send({
      v: SERVER_PROTOCOL_VERSION,
      t: CLIENT_MESSAGE.PRESENCE,
      player: payload
    })) {
      return;
    }
    lastPresenceSignature = signature;
    lastPresenceSentAt = at;
  }

  function sendBoardRead(force = false) {
    if (!joined) return;
    const at = Date.now();
    if (!force && at - lastBoardReadSentAt < 800) return;
    lastBoardReadSentAt = at;
    transport.send({
      v: SERVER_PROTOCOL_VERSION,
      t: CLIENT_MESSAGE.BOARD_READ
    });
  }

  function finishExport(messages) {
    exportChunks = null;
    if (!pendingExport) return;
    window.clearTimeout(pendingExport.timer);
    const resolve = pendingExport.resolve;
    pendingExport = null;
    resolve(cloneBoardMessages(messages));
  }

  function sendPing() {
    if (!joined) return;
    transport.send({
      v: SERVER_PROTOCOL_VERSION,
      t: CLIENT_MESSAGE.PING,
      c: Date.now()
    });
  }

  function startLoops() {
    if (presenceTimer) return;
    presenceTimer = window.setInterval(() => sendPresence(), PRESENCE_INTERVAL_MS);
    pingTimer = window.setInterval(sendPing, PING_INTERVAL_MS);
    sendPing();
  }

  function applyWelcome(message) {
    if (typeof message.selfId !== "string" || !message.selfId) return;
    if (!message.snapshot || typeof message.snapshot !== "object") return;

    const previousSelf = state.players[selfId];
    const nextName = sanitizeName(message.name, previousSelf?.name ?? selfName);
    selfName = nextName;
    const rawSpawn = message.spawn;
    const spawn =
      Number.isFinite(Number(rawSpawn?.x)) && Number.isFinite(Number(rawSpawn?.y))
        ? { x: Number(rawSpawn.x), y: Number(rawSpawn.y) }
        : previousSelf?.position ?? SPAWN;

    const nextScene = Object.values(SCENE).includes(message.scene)
      ? message.scene
      : previousSelf?.currentScene ?? SCENE.OUTDOOR;
    const nextFacing =
      typeof message.facing === "string" && message.facing
        ? message.facing
        : previousSelf?.facing ?? "south";

    selfId = message.selfId;
    const self = createPlayerEntity({
      id: selfId,
      name: nextName,
      currentScene: nextScene,
      position: spawn,
      facing: nextFacing
    });

    const players = { [selfId]: self };
    const snapshotPlayers = message.snapshot.players ?? {};
    for (const [id, data] of Object.entries(snapshotPlayers)) {
      if (id === selfId) continue;
      const player = playerFromPresence({ ...data, id });
      if (player) players[id] = player;
    }

    seq = Math.max(seq, Number(message.seq) || 0);
    if (Number.isFinite(Number(message.serverTime))) {
      setClockOffset(Number(message.serverTime) - Date.now());
    }

    let nextState = {
      ...state,
      schemaVersion: 3,
      roomId: message.room || roomId,
      activePlayerId: selfId,
      players,
      plots: clonePlots(message.snapshot.plots ?? state.plots),
      stats: sanitizeStats(message.snapshot.stats),
      inventory: {
        seeds: sanitizeSeeds(message.snapshot.inventory?.seeds),
        goods: sanitizeGoods(message.snapshot.inventory?.goods),
        produce: sanitizeProduce(message.snapshot.inventory?.produce),
        dishes: sanitizeDishes(message.snapshot.inventory?.dishes)
      },
      world: sanitizeWorld(message.snapshot.world),
      weather: sanitizeWeather(message.snapshot.weather),
      ui: {
        ...state.ui,
        selectedPlotId: null,
        boardOpen: false,
        decorOpen: false,
        kitchenOpen: false,
        pendingScene: null,
        pendingSeat: null
      },
      board: {
        messages: sanitizeBoardMessages(
          message.snapshot.board,
          clockNowForBoard()
        ),
        lastReadAt: Math.max(0, Number(message.boardReadAt) || 0)
      },
      room: {
        ...state.room,
        id: message.room || roomId,
        role: "server"
      }
    };

    const resumed = hasJoined;
    joined = true;
    hasJoined = true;
    commit(nextState, { action: "ROOM_WELCOME" });
    startLoops();
    sendPresence(true);

    const meal =
      nextState.world?.meal && nextState.world.meal.byId !== selfId
        ? nextState.world.meal
        : null;
    const where =
      meal && nextScene === SCENE.INDOOR_1 ? ` · 桌上有${mealLabel(meal)}` : "";
    notify(
      `${resumed ? "已重新连接" : `已加入房间 ${roomId}`}${where}`,
      "info"
    );
  }

  function handleState(message) {
    const nextSeq = Number(message.seq) || 0;
    if (nextSeq && nextSeq < seq) return;
    seq = Math.max(seq, nextSeq);

    let nextState = {
      ...state,
      plots: clonePlots(message.plots ?? state.plots),
      stats: sanitizeStats(message.stats),
      inventory: {
        seeds: sanitizeSeeds(message.inventory?.seeds ?? state.inventory?.seeds),
        goods: sanitizeGoods(
          message.inventory?.goods ?? state.inventory?.goods
        ),
        produce: sanitizeProduce(
          message.inventory?.produce ?? state.inventory?.produce
        ),
        dishes: sanitizeDishes(
          message.inventory?.dishes ?? state.inventory?.dishes
        )
      },
      world: sanitizeWorld(message.world ?? state.world),
      weather: sanitizeWeather(
        Object.prototype.hasOwnProperty.call(message, "weather")
          ? message.weather
          : state.weather
      )
    };

    if (message.notice?.text) {
      nextState = withNotice(
        nextState,
        message.notice.text,
        message.notice.tone || "info"
      );
    }

    commit(nextState, message.event ?? { action: "ROOM_STATE" });
    if (message.notice?.text) scheduleNoticeClear();
  }

  function handleMessage(raw) {
    if (!isServerMessage(raw)) return;

    switch (raw.t) {
      case SERVER_MESSAGE.WELCOME:
        applyWelcome(raw);
        break;

      case SERVER_MESSAGE.PRESENCE: {
        const playerId = raw.player?.id;
        if (!playerId) return;
        if (playerId === selfId) {
          if (raw.corrected !== true) return;
          const correctedPlayer = playerFromPresence(raw.player);
          const current = state.players[selfId];
          if (!correctedPlayer || !current) return;
          commit(
            {
              ...state,
              players: {
                ...state.players,
                [selfId]: {
                  ...current,
                  currentScene: correctedPlayer.currentScene,
                  position: correctedPlayer.position,
                  facing: correctedPlayer.facing,
                  activity: correctedPlayer.activity
                }
              }
            },
            { action: "ROOM_PRESENCE" }
          );
          return;
        }
        const result = applyPresence(state, raw.player);
        if (result.state === state) return;
        commit(result.state, { action: "ROOM_PRESENCE" });
        break;
      }

      case SERVER_MESSAGE.STATE:
        handleState(raw);
        break;

      case SERVER_MESSAGE.REJECT:
        notify(raw.message || "这次操作没有生效，可能状态已经变化了。", "error");
        break;

      case SERVER_MESSAGE.PONG: {
        const sentAt = Number(raw.c);
        if (!Number.isFinite(sentAt)) break;
        const rtt = Math.max(0, Date.now() - sentAt);
        const serverTime = Number(raw.s);
        if (Number.isFinite(serverTime)) {
          setClockOffset(serverTime + rtt / 2 - Date.now());
        }
        lastRtt = Math.round(rtt);
        commit(
          {
            ...state,
            room: { ...state.room, rtt: lastRtt }
          },
          { action: "ROOM_PONG" }
        );
        break;
      }

      case SERVER_MESSAGE.LEAVE: {
        if (!raw.id || raw.id === selfId) return;
        const nextState = removePresence(state, raw.id);
        if (nextState === state) return;
        commit(nextState, { action: "ROOM_LEAVE" });
        notify("对方离开了房间", "info");
        break;
      }

      case SERVER_MESSAGE.BOARD: {
        const messages = sanitizeBoardMessages(
          raw.messages,
          clockNowForBoard()
        );
        const latest = messages.reduce(
          (newest, message) => Math.max(newest, message.createdAt),
          0
        );
        const open = state.ui.boardOpen;
        commit(
          {
            ...state,
            board: {
              messages,
              lastReadAt: open
                ? Math.max(state.board.lastReadAt, latest)
                : state.board.lastReadAt
            }
          },
          { action: "BOARD_STATE" }
        );
        if (open) sendBoardRead();
        break;
      }

      case SERVER_MESSAGE.CHAT: {
        const message = sanitizeChatMessage(raw, clockNowForBoard());
        if (message && message.from !== selfId) onChatMessage?.(message);
        break;
      }

      case SERVER_MESSAGE.CHAT_ACK:
        onChatAck?.({
          cid: typeof raw.cid === "string" ? raw.cid : null,
          id: typeof raw.id === "string" ? raw.id : null,
          delivered: Math.max(0, Number(raw.delivered) || 0),
          code: raw.code ?? null,
          at: Number(raw.at) || 0
        });
        break;

      case SERVER_MESSAGE.CHAT_READ:
        if (typeof raw.id === "string") {
          onChatRead?.({
            id: raw.id,
            from: typeof raw.from === "string" ? raw.from : null,
            at: Number(raw.at) || 0
          });
        }
        break;

      case SERVER_MESSAGE.BOARD_EXPORT: {
        if (!pendingExport) break;
        const index = Math.max(0, Number(raw.chunk) || 0);
        const total = Math.max(1, Number(raw.total) || 1);
        if (!Array.isArray(raw.messages)) break;
        if (index === 0 || !exportChunks) exportChunks = [];
        exportChunks[index] = sanitizeBoardMessages(
          raw.messages,
          clockNowForBoard()
        );
        if (raw.done === true || index + 1 >= total) {
          finishExport(exportChunks.flat());
        }
        break;
      }

      case SERVER_MESSAGE.ERROR: {
        const rejected = raw.code === "ROOM_FULL";
        commit(
          {
            ...state,
            room: {
              ...state.room,
              role: rejected ? "rejected" : "connecting",
              code: rejected ? raw.code ?? "ROOM_FULL" : null
            }
          },
          { action: "ROOM_ERROR" }
        );
        notify(raw.message || "无法加入房间。", "error");
        if (rejected) transport.close();
        break;
      }

      default:
        break;
    }
  }

  function dispatch(action, targetId = null, payload = null) {
    if (stopped) return state;

    if (action === ACTION.POST_MESSAGE) {
      const text = normalizeBoardText(payload?.text);
      if (!text) return state;
      if (!joined) {
        notify("正在连接房间，请稍等一下。", "info");
        return state;
      }

      clientActionId += 1;
      const sent = transport.send({
        v: SERVER_PROTOCOL_VERSION,
        t: CLIENT_MESSAGE.ACT,
        cid: `c${clientActionId}-${Date.now().toString(36)}`,
        action,
        targetId: null,
        payload: { text }
      });
      if (!sent) notify("连接中断了，正在重连…", "error");
      return state;
    }

    const remoteAction = isFarmAction(action) || isSceneAction(action);
    if (!joined && remoteAction) {
      notify("正在连接房间，请稍等一下。", "info");
      return state;
    }

    if (remoteAction) {
      clientActionId += 1;
      const cid = `c${clientActionId}-${Date.now().toString(36)}`;
      const sent = transport.send({
        v: SERVER_PROTOCOL_VERSION,
        t: CLIENT_MESSAGE.ACT,
        cid,
        action,
        targetId,
        payload: payload ?? undefined
      });
      if (!sent) notify("连接中断了，正在重连…", "error");
      return state;
    }

    const before = state.players[selfId];
    const event = {
      who: selfId,
      when: clockNow(),
      action,
      targetId,
      payload
    };
    const nextState = reducer(state, event);
    if (nextState === state) return state;

    const after = nextState.players[selfId];
    const sceneChanged = before?.currentScene !== after?.currentScene;
    const activityChanged =
      JSON.stringify(before?.activity ?? null) !==
      JSON.stringify(after?.activity ?? null);

    commit(nextState, event);
    if (sceneChanged || activityChanged) sendPresence(true);
    if (action === ACTION.READ_BOARD) sendBoardRead(true);
    return state;
  }

  function sendChat(rawText) {
    const text = normalizeChatText(rawText);
    if (!text) return { ok: false, code: "EMPTY_MESSAGE" };
    if (stopped || !joined) return { ok: false, code: "OFFLINE" };

    clientActionId += 1;
    const cid = `ch${clientActionId}-${Date.now().toString(36)}`;
    const sent = transport.send({
      v: SERVER_PROTOCOL_VERSION,
      t: CLIENT_MESSAGE.CHAT,
      cid,
      text
    });
    if (!sent) return { ok: false, code: "OFFLINE" };

    const player = state.players[selfId];
    return {
      ok: true,
      cid,
      message: {
        id: `local_${cid}`,
        from: selfId,
        name: player?.name ?? selfName,
        text,
        at: clockNow()
      }
    };
  }

  function ackChat(id) {
    if (stopped || !joined || typeof id !== "string" || !id) return false;
    return transport.send({
      v: SERVER_PROTOCOL_VERSION,
      t: CLIENT_MESSAGE.CHAT_READ,
      id
    });
  }

  function onClose(event) {
    if (stopped) return;
    joined = false;
    finishExport(state.board.messages);
    if (event?.code === 4001) {
      commit(
        {
          ...state,
          room: { ...state.room, role: "rejected", code: "REPLACED" }
        },
        { action: "ROOM_REPLACED" }
      );
      notify("这个角色已在另一台设备登录。", "info");
      return;
    }
    if (event?.code === 4004) {
      commit(
        {
          ...state,
          room: { ...state.room, role: "rejected", code: "IDLE" }
        },
        { action: "ROOM_IDLE" }
      );
      notify("连接超时，已退出房间。刷新后可以重试。", "info");
      return;
    }
    if (hasJoined && state.room.role !== "rejected") {
      commit(
        { ...state, room: { ...state.room, role: "reconnecting" } },
        { action: "ROOM_RECONNECTING" }
      );
    }
  }

  function stop() {
    if (stopped) return;
    stopped = true;
    window.clearTimeout(noticeTimer);
    window.clearInterval(presenceTimer);
    window.clearInterval(pingTimer);
    if (pendingExport) {
      window.clearTimeout(pendingExport.timer);
      const resolve = pendingExport.resolve;
      pendingExport = null;
      resolve(cloneBoardMessages(state.board.messages));
    }
    if (joined) {
      transport.send({
        v: SERVER_PROTOCOL_VERSION,
        t: CLIENT_MESSAGE.BYE
      });
    }
    transport.close();
    window.removeEventListener("pagehide", stop);
  }

  const transport = createWsTransport({
    url: buildSocketUrl(wsUrl, roomId, requestedName, clientId),
    onOpen: () => {
      // The server sends welcome on connect; do not send presence before it.
    },
    onClose,
    onMessage: handleMessage,
    shouldReconnect: (event) => event.code !== 4004 && event.code !== 4001,
    onError: () => {
      if (!stopped && state.room.role !== "rejected") {
        // onClose schedules the reconnect; keep this quiet to avoid toast spam.
      }
    }
  });

  transport.connect();
  window.addEventListener("pagehide", stop);

  return {
    dispatch,
    sendChat,
    ackChat,
    getState: () => state,
    stop,
    getRoomInfo: () => ({
      roomId,
      selfId,
      role: "server",
      seq,
      rtt: lastRtt
    }),
    exportBoard: () => {
      if (!joined) {
        return Promise.resolve(cloneBoardMessages(state.board.messages));
      }

      return new Promise((resolve) => {
        const timer = window.setTimeout(() => {
          if (pendingExport?.timer === timer) {
            pendingExport = null;
            exportChunks = null;
            resolve(cloneBoardMessages(state.board.messages));
          }
        }, 8000);

        exportChunks = null;
        pendingExport = { resolve, timer };
        const sent = transport.send({
          v: SERVER_PROTOCOL_VERSION,
          t: CLIENT_MESSAGE.BOARD_EXPORT
        });
        if (!sent) {
          window.clearTimeout(timer);
          pendingExport = null;
          exportChunks = null;
          resolve(cloneBoardMessages(state.board.messages));
        }
      });
    },
    getNetStats: () => ({ rtt: lastRtt, clockOffset: getClockOffset() })
  };
}
