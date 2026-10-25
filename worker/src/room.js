import { DurableObject } from "cloudflare:workers";
import {
  ACTION,
  CHARACTERS,
  CHAT,
  ROOM_MAX_PLAYERS,
  SCENE,
  characterNameFor
} from "../../src/config.js";
import {
  BOARD_EXPORT_LIMIT,
  BOARD_SNAPSHOT_LIMIT,
  appendBoardMessage,
  boardCutoff,
  cloneBoardMessages,
  createBoardMessage,
  normalizeBoardText,
  sanitizeBoardMessages
} from "../../src/game/board.js";
import {
  createChatMessage,
  normalizeChatText
} from "../../src/game/chat.js";
import { createEmptyPlots, getPlotHazard } from "../../src/game/crop.js";
import { createPlayerEntity } from "../../src/game/player.js";
import {
  applyFarmAction,
  getFarmNotice,
  harvestReward,
  isFarmAction,
  validateFarmAction
} from "../../src/game/farmRules.js";
import {
  applySceneAction,
  getSceneNotice,
  isSceneAction,
  validateSceneAction
} from "../../src/game/sceneRules.js";
import { sanitizeGoods } from "../../src/game/warehouse.js";
import {
  sanitizeDishes,
  sanitizeProduce
} from "../../src/game/kitchen.js";
import {
  clonePlots,
  playerFromPresence,
  presenceOf
} from "../../src/game/sharedState.js";
import { cloneWorld, sanitizeWorld } from "../../src/game/world.js";
import {
  identityFromRow,
  resolveJoin,
  sanitizeFacing,
  sanitizeScene
} from "./identity.js";
import { createRateLimiter } from "./rateLimit.js";
import { fetchHomeWeather } from "./weather.js";

const SPAWNS = Object.freeze([
  { x: -1.35, y: -0.15 },
  { x: -1.9, y: 0.55 }
]);

const MAX_CID_HISTORY = 128;

// A returning browser resumes its last seat instead of spawning a new player.
// Rows older than this are pruned so abandoned client ids cannot pile up.
const IDENTITY_TTL_MS = 30 * 24 * 60 * 60 * 1000;
// Presence is sent every 5s while active. A socket that has not sent any
// message for 30s is stale and must not hold one of the two room seats.
const IDLE_TIMEOUT_MS = 30 * 1000;
const IDLE_SWEEP_MS = 10 * 1000;
const WEATHER_TTL_MS = 5 * 60 * 1000;

// Per-connection flood control. Normal play is 10Hz presence, a 5s ping and
// occasional farm actions, so these leave plenty of headroom.
const RATE = Object.freeze({
  all: { capacity: 90, refillPerSecond: 45 },
  presence: { capacity: 30, refillPerSecond: 15 },
  act: { capacity: 6, refillPerSecond: 2 },
  board: { capacity: 2, refillPerSecond: 0.5 },
  chat: { capacity: CHAT.rateCapacity, refillPerSecond: CHAT.rateRefillPerSecond },
  ping: { capacity: 5, refillPerSecond: 1 }
});

// Chat is ephemeral, but the room keeps a short-lived outbox so a strict read
// receipt can be matched to the exact message and recipient.
const CHAT_OUTBOX_TTL_MS = 30 * 1000;
const CHAT_OUTBOX_LIMIT = 64;

const REJECT_TEXT = {
  NO_PLAYER: "玩家状态还没同步好，请重试。",
  NOT_OUTDOOR: "回到小院才能照料田地。",
  NO_PLOT: "这块地不存在。",
  PLOT_OCCUPIED: "这块地已经种上了。",
  PLOT_EMPTY: "这块地还没播种。",
  ALREADY_WATERED: "已经浇过水了。",
  NOT_READY: "还没成熟，再等等。",
  NOT_FARM_ACTION: "这不是农事操作。",
  EMPTY_MESSAGE: "写点什么再贴上去吧。",
  BOARD_INDOOR: "回到客厅的留言板前才能留言。",
  RATE_LIMITED: "操作太快了，稍等一下。",
  NOT_FARM_SCENE: "这里没有可照料的田地。",
  WRONG_SCENE: "这块地在别的地方。",
  DECOR_INDOOR: "回到二层空房间才能添置家具。",
  NO_DECOR: "没有这件家具。",
  DECOR_OWNED: "这件家具已经添置过了。",
  PLOT_LOCKED: "这块地还没开垦。",
  NO_SEEDS: "没有这种种子了，先去种子铺买一点。",
  UNKNOWN_CROP: "不认识这种作物。",
  HAZARD_PRESENT: "先清理杂草或虫子，再收获。",
  NO_HAZARD: "这里没有需要清理的东西。",
  ALREADY_UNLOCKED: "这块地已经开垦过了。",
  GREENHOUSE_OWNED: "温室已经搭好了。",
  NO_COINS: "金币不够。",
  GIFT_CLAIMED: "今天的补给已经领过了。",
  NOT_KITCHEN_SCENE: "回一层厨房才能做饭。",
  TOO_FAR_FROM_KITCHEN: "先走到灶台旁。",
  TOO_FAR_FROM_TABLE: "先走到餐桌旁。",
  UNKNOWN_RECIPE: "没有这道菜谱。",
  MISSING_INGREDIENTS: "食材还不够，再去收获或采集一些。",
  UNKNOWN_DISH: "没有这道菜。",
  NO_DISH: "这道菜已经用完了。",
  MEAL_EXISTS: "桌上已经有一份饭了。",
  NO_MEAL: "桌上还没有饭，先去灶台做一份。",
  NOT_RAINING: "深圳现在没有下雨，等下雨再浇水吧。"
};

function seatName(seat) {
  if (seat === "A") return CHARACTERS.A.name;
  if (seat === "B") return CHARACTERS.B.name;
  return "";
}

function seatForName(value) {
  const name = characterNameFor(value);
  if (name === CHARACTERS.A.name) return "A";
  if (name === CHARACTERS.B.name) return "B";
  return "";
}

function seatFromHeader(value) {
  const text = String(value ?? "").trim().toUpperCase();
  return text === "A" || text === "B" ? text : "";
}

function sanitizeName(value, fallback = "A") {
  const text = typeof value === "string" ? value.trim().slice(0, 12) : "";
  return text || fallback;
}

function sanitizeClientId(value) {
  const text = typeof value === "string" ? value.trim().slice(0, 48) : "";
  return /^[a-zA-Z0-9_-]{4,48}$/.test(text) ? text : crypto.randomUUID();
}

function parseJson(value, fallback) {
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === "object" ? parsed : fallback;
  } catch {
    return fallback;
  }
}

function normalizeStats(raw) {
  const coins = Number(raw?.coins);
  const harvested = Number(raw?.harvested);
  const cooked = Number(raw?.cooked);
  const meals = Number(raw?.meals);
  return {
    harvested:
      Number.isFinite(harvested) && harvested >= 0 ? Math.floor(harvested) : 0,
    coins: Number.isFinite(coins) && coins >= 0 ? Math.floor(coins) : 24,
    giftDay: typeof raw?.giftDay === "string" ? raw.giftDay.slice(0, 10) : "",
    cooked: Number.isFinite(cooked) && cooked >= 0 ? Math.floor(cooked) : 0,
    meals: Number.isFinite(meals) && meals >= 0 ? Math.floor(meals) : 0,
    mealDay: typeof raw?.mealDay === "string" ? raw.mealDay.slice(0, 10) : ""
  };
}

export class Room extends DurableObject {
  constructor(ctx, env) {
    super(ctx, env);
    this.ctx = ctx;
    this.env = env;
    this.ready = null;
    this.roomId = "";
    this.plots = null;
    this.stats = null;
    this.seq = 0;
    this.players = new Map();
    this.cids = new Map();
    this.limiters = new Map();
    this.board = [];
    this.boardPrunedAt = 0;
    this.inventory = { seeds: {}, goods: {}, produce: {}, dishes: {} };
    this.world = sanitizeWorld({});
    this.weather = null;
    this.weatherAt = 0;
    this.weatherFailedAt = 0;
    this.weatherPromise = null;
    this.chatOutbox = new Map();
    this.identityAt = new Map();
    this.alarmScheduled = false;
  }

  async ensureLoaded(roomId = "") {
    if (roomId && !this.roomId) this.roomId = roomId;
    if (this.ready) return this.ready;

    this.ready = this.ctx.blockConcurrencyWhile(async () => {
      this.ctx.storage.sql.exec(`
        CREATE TABLE IF NOT EXISTS room_state (
          id INTEGER PRIMARY KEY CHECK (id = 1),
          room_id TEXT NOT NULL,
          plots TEXT NOT NULL,
          stats TEXT NOT NULL,
          seq INTEGER NOT NULL,
          updated_at INTEGER NOT NULL
        )
      `);

      // v0.4 adds the wallet/inventory slice to existing rooms. SQLite has no
      // portable "add column if missing", so try and ignore the duplicate.
      for (const column of ["inventory TEXT", "world TEXT"]) {
        try {
          this.ctx.storage.sql.exec(
            `ALTER TABLE room_state ADD COLUMN ${column}`
          );
        } catch {
          // Column already present.
        }
      }

      this.ctx.storage.sql.exec(`
        CREATE TABLE IF NOT EXISTS player_identity (
          client_id TEXT PRIMARY KEY,
          player_id TEXT NOT NULL,
          name TEXT NOT NULL,
          scene TEXT NOT NULL,
          x REAL NOT NULL,
          y REAL NOT NULL,
          facing TEXT NOT NULL,
          updated_at INTEGER NOT NULL
        )
      `);

      this.ctx.storage.sql.exec(
        "DELETE FROM player_identity WHERE updated_at < ?",
        Date.now() - IDENTITY_TTL_MS
      );

      this.ctx.storage.sql.exec(`
        CREATE TABLE IF NOT EXISTS board_messages (
          id TEXT PRIMARY KEY,
          author_id TEXT NOT NULL,
          author_name TEXT NOT NULL,
          text TEXT NOT NULL,
          created_at INTEGER NOT NULL
        )
      `);

      this.ctx.storage.sql.exec(`
        CREATE INDEX IF NOT EXISTS board_messages_created
          ON board_messages (created_at)
      `);

      this.ctx.storage.sql.exec(`
        CREATE TABLE IF NOT EXISTS board_reads (
          player_id TEXT PRIMARY KEY,
          last_read_at INTEGER NOT NULL
        )
      `);

      // Drop read markers for identities that were already pruned.
      this.ctx.storage.sql.exec(`
        DELETE FROM board_reads
        WHERE player_id NOT IN (SELECT player_id FROM player_identity)
      `);

      this.loadBoard(Date.now());

      const rows = this.ctx.storage.sql
        .exec(
          "SELECT room_id, plots, stats, seq, inventory, world FROM room_state WHERE id = 1"
        )
        .toArray();

      if (rows.length) {
        const row = rows[0];
        this.roomId = String(row.room_id || this.roomId || "");
        const rawPlots = parseJson(row.plots, createEmptyPlots());
        // Migrate rooms created before v0.4: every then-known plot was usable
        // and the wallet did not exist yet.
        for (const plot of Object.values(rawPlots ?? {})) {
          if (typeof plot.unlocked !== "boolean") plot.unlocked = true;
          if (!Number.isFinite(Number(plot.tendedAt))) plot.tendedAt = 0;
        }
        // clonePlots fills the expanded field added in v0.6.
        this.plots = clonePlots(rawPlots);
        this.stats = normalizeStats(
          parseJson(row.stats, { harvested: 0, coins: 24 })
        );
        const rawInventory = parseJson(row.inventory, {});
        this.inventory = {
          seeds: {
            ...parseJson(row.inventory, {
              seeds: { radish: 3, carrot: 1, tomato: 0 }
            })?.seeds
          },
          goods: sanitizeGoods(rawInventory?.goods),
          produce: sanitizeProduce(rawInventory?.produce),
          dishes: sanitizeDishes(rawInventory?.dishes)
        };
        this.world = sanitizeWorld(parseJson(row.world, {}));
        this.seq = Number(row.seq) || 0;

        if (!Number.isFinite(Number(this.stats?.coins))) {
          this.stats = { ...this.stats, coins: 24 };
        }
      } else {
        this.plots = createEmptyPlots();
        this.stats = normalizeStats({ harvested: 0, coins: 24 });
        this.inventory = {
          seeds: { radish: 3, carrot: 1, tomato: 0 },
          goods: sanitizeGoods(null),
          produce: sanitizeProduce(null),
          dishes: sanitizeDishes(null)
        };
        this.world = sanitizeWorld({});
        this.seq = 0;
        this.persist();
      }
    });

    await this.ready;
    return this.ready;
  }

  /**
   * Shared real-world weather for the room. It is cached in memory for a few
   * minutes and refreshed lazily before a rain action. A failed fetch falls
   * back to the previous reading (or null) so the game keeps running.
   */
  async ensureWeather() {
    const now = Date.now();
    if (this.weather && now - this.weatherAt < WEATHER_TTL_MS) {
      return this.weather;
    }
    if (now - this.weatherFailedAt < 60 * 1000) return this.weather;
    if (this.weatherPromise) return this.weatherPromise;

    this.weatherPromise = fetchHomeWeather()
      .then((weather) => {
        this.weather = weather;
        this.weatherAt = Date.now();
        this.weatherFailedAt = 0;
        return weather;
      })
      .catch(() => {
        this.weatherFailedAt = Date.now();
        return this.weather;
      })
      .finally(() => {
        this.weatherPromise = null;
      });
    return this.weatherPromise;
  }

  weatherKey(weather) {
    return weather
      ? `${weather.rain}|${weather.weatherId}|${weather.label}|${weather.temperature}|${weather.at}|${weather.fetchedAt}`
      : "none";
  }

  broadcastWeatherState() {
    this.broadcast({
      v: 1,
      t: "state",
      ...this.stateBody(),
      event: {
        who: "server-weather",
        when: Date.now(),
        action: "WEATHER_UPDATE",
        targetId: null,
        payload: null
      }
    });
  }

  /**
   * Refresh the room's shared weather even when nobody sends RAIN_WATER. The
   * alarm runs every 10s while someone is connected (and every 5 minutes for
   * an offline room); ensureWeather only hits Open-Meteo after its 5-minute
   * TTL. This prevents a cached dry reading from suppressing real rain
   * forever and lets rain water the field while both players are away.
   */
  async refreshRoomWeather() {
    const previousKey = this.weatherKey(this.weather);
    const weather = await this.ensureWeather();
    const changed = this.weatherKey(weather) !== previousKey;
    if (!changed) return;
    if (!weather?.rain) {
      this.broadcastWeatherState();
      return;
    }

    const players = Object.fromEntries(this.players);
    let player = this.players.values().next().value;
    if (!player) {
      // Offline rooms still need rain to water the field. Use a synthetic
      // system player: RAIN_WATER is a room-level event and does not depend on
      // a real player's position.
      player = createPlayerEntity({
        id: "weather-system",
        name: "小院",
        currentScene: SCENE.OUTDOOR,
        position: { x: 0, y: 0 },
        facing: "south"
      });
      players[player.id] = player;
    }
    const now = Date.now();
    const gameState = {
      plots: this.plots,
      stats: this.stats,
      inventory: this.inventory,
      world: this.world,
      weather,
      weatherAuthority: true,
      players
    };
    const next = applyFarmAction(
      gameState,
      player.id,
      ACTION.RAIN_WATER,
      null,
      null,
      now
    );
    if (!next || next === gameState) {
      this.broadcastWeatherState();
      return;
    }

    this.plots = next.plots;
    this.stats = next.stats;
    this.inventory = next.inventory;
    this.world = next.world;
    this.seq += 1;
    this.persist();
    this.broadcast({
      v: 1,
      t: "state",
      ...this.stateBody(),
      event: {
        who: "server-weather",
        when: now,
        action: ACTION.RAIN_WATER,
        targetId: null,
        payload: null
      },
      notice: getFarmNotice(ACTION.RAIN_WATER, next)
    });
  }

  persist() {
    this.ctx.storage.sql.exec(
      `INSERT INTO room_state
         (id, room_id, plots, stats, seq, updated_at, inventory, world)
       VALUES (1, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET
         room_id = excluded.room_id,
         plots = excluded.plots,
         stats = excluded.stats,
         seq = excluded.seq,
         updated_at = excluded.updated_at,
         inventory = excluded.inventory,
         world = excluded.world`,
      this.roomId,
      JSON.stringify(this.plots),
      JSON.stringify(this.stats),
      this.seq,
      Date.now(),
      JSON.stringify(this.inventory),
      JSON.stringify(this.world)
    );
  }

  readIdentity(clientId) {
    if (!clientId) return null;
    const rows = this.ctx.storage.sql
      .exec(
        "SELECT player_id, name, scene, x, y, facing FROM player_identity WHERE client_id = ?",
        clientId
      )
      .toArray();
    return identityFromRow(rows[0]);
  }

  writeIdentity(clientId, player) {
    if (!clientId || !player?.id) return;
    const position = player.position ?? { x: 0, y: 0 };
    this.ctx.storage.sql.exec(
      `INSERT INTO player_identity
         (client_id, player_id, name, scene, x, y, facing, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(client_id) DO UPDATE SET
         player_id = excluded.player_id,
         name = excluded.name,
         scene = excluded.scene,
         x = excluded.x,
         y = excluded.y,
         facing = excluded.facing,
         updated_at = excluded.updated_at`,
      clientId,
      player.id,
      sanitizeName(player.name, "A"),
      sanitizeScene(player.currentScene),
      Number(position.x) || 0,
      Number(position.y) || 0,
      sanitizeFacing(player.facing),
      Date.now()
    );
  }

  limiterFor(meta) {
    const key = meta?.connId || "unknown";
    let limiters = this.limiters.get(key);
    if (!limiters) {
      limiters = {
        all: createRateLimiter(RATE.all),
        presence: createRateLimiter(RATE.presence),
        act: createRateLimiter(RATE.act),
        board: createRateLimiter(RATE.board),
        chat: createRateLimiter(RATE.chat),
        ping: createRateLimiter(RATE.ping)
      };
      this.limiters.set(key, limiters);
      while (this.limiters.size > 32) {
        this.limiters.delete(this.limiters.keys().next().value);
      }
    }
    return limiters;
  }

  loadBoard(now = Date.now()) {
    const cutoff = boardCutoff(now);
    this.ctx.storage.sql.exec(
      "DELETE FROM board_messages WHERE created_at < ?",
      cutoff
    );
    this.boardPrunedAt = now;

    const rows = this.ctx.storage.sql
      .exec(
        `SELECT id, author_id, author_name, text, created_at
         FROM board_messages
         WHERE created_at >= ?
         ORDER BY created_at DESC
         LIMIT ?`,
        cutoff,
        BOARD_SNAPSHOT_LIMIT
      )
      .toArray();

    const messages = rows
      .map((row) => ({
        id: row.id,
        authorId: row.author_id,
        authorName: row.author_name,
        text: row.text,
        createdAt: Number(row.created_at)
      }))
      .reverse();

    this.board = sanitizeBoardMessages(messages, now, BOARD_SNAPSHOT_LIMIT);
  }

  pruneBoard(now = Date.now()) {
    if (now - this.boardPrunedAt < 60 * 60 * 1000) return;
    const cutoff = boardCutoff(now);
    this.ctx.storage.sql.exec(
      "DELETE FROM board_messages WHERE created_at < ?",
      cutoff
    );
    this.board = this.board.filter((message) => message.createdAt >= cutoff);
    this.boardPrunedAt = now;
  }

  insertBoardMessage(message) {
    this.ctx.storage.sql.exec(
      `INSERT INTO board_messages
         (id, author_id, author_name, text, created_at)
       VALUES (?, ?, ?, ?, ?)
       ON CONFLICT(id) DO NOTHING`,
      message.id,
      message.authorId,
      message.authorName,
      message.text,
      message.createdAt
    );
  }

  boardForExport() {
    const now = Date.now();
    const cutoff = boardCutoff(now);
    const rows = this.ctx.storage.sql
      .exec(
        `SELECT id, author_id, author_name, text, created_at
         FROM board_messages
         WHERE created_at >= ?
         ORDER BY created_at ASC
         LIMIT ?`,
        cutoff,
        BOARD_EXPORT_LIMIT
      )
      .toArray();

    return sanitizeBoardMessages(
      rows.map((row) => ({
        id: row.id,
        authorId: row.author_id,
        authorName: row.author_name,
        text: row.text,
        createdAt: Number(row.created_at)
      })),
      now,
      BOARD_EXPORT_LIMIT
    );
  }

  readBoardAt(playerId) {
    if (!playerId) return 0;
    const rows = this.ctx.storage.sql
      .exec(
        "SELECT last_read_at FROM board_reads WHERE player_id = ?",
        playerId
      )
      .toArray();
    return Math.max(0, Number(rows[0]?.last_read_at) || 0);
  }

  markBoardRead(playerId) {
    if (!playerId) return;
    this.ctx.storage.sql.exec(
      `INSERT INTO board_reads (player_id, last_read_at)
       VALUES (?, ?)
       ON CONFLICT(player_id) DO UPDATE SET
         last_read_at = excluded.last_read_at`,
      playerId,
      Date.now()
    );
  }

  handleBoardPost(ws, meta, message) {
    const player = this.players.get(meta.id);
    if (!player) {
      this.reject(ws, message.cid, "NO_PLAYER");
      return;
    }
    if (player.currentScene !== SCENE.INDOOR_1) {
      this.reject(ws, message.cid, "BOARD_INDOOR");
      return;
    }

    const text = normalizeBoardText(message.payload?.text);
    if (!text) {
      this.reject(ws, message.cid, "EMPTY_MESSAGE");
      return;
    }

    const createdAt = Date.now();
    const note = createBoardMessage(
      {
        id: `m_${crypto.randomUUID().slice(0, 10)}`,
        authorId: meta.id,
        authorName: player.name,
        text,
        createdAt
      },
      createdAt
    );
    if (!note) {
      this.reject(ws, message.cid, "EMPTY_MESSAGE");
      return;
    }

    this.insertBoardMessage(note);
    this.board = appendBoardMessage(this.board, note, createdAt).slice(
      -BOARD_SNAPSHOT_LIMIT
    );
    this.pruneBoard(createdAt);
    this.broadcast({ v: 1, t: "board", messages: this.board });
  }

  handleBoardExport(ws) {
    const messages = this.boardForExport();
    const chunks = [];
    let current = [];
    let currentSize = 0;
    for (const message of messages) {
      const size = JSON.stringify(message).length;
      if (current.length && currentSize + size > 35000) {
        chunks.push(current);
        current = [];
        currentSize = 0;
      }
      current.push(message);
      currentSize += size;
    }
    if (current.length || !chunks.length) chunks.push(current);

    for (let index = 0; index < chunks.length; index += 1) {
      try {
        ws.send(
          JSON.stringify({
            v: 1,
            t: "board_export",
            messages: chunks[index],
            chunk: index,
            total: chunks.length,
            done: index === chunks.length - 1
          })
        );
      } catch {
        // Socket closed mid-export; the client falls back after its timeout.
        return;
      }
    }
  }

  pickSpawn() {
    return this.players.size ? { ...SPAWNS[1] } : { ...SPAWNS[0] };
  }

  findSocket(clientId) {
    for (const ws of this.ctx.getWebSockets()) {
      const meta = ws.deserializeAttachment();
      if (meta?.clientId === clientId) return ws;
    }
    return null;
  }

  ensurePlayer(meta) {
    if (!meta?.id || meta.revoked || this.players.has(meta.id)) {
      return this.players.get(meta.id);
    }
    const stored = this.readIdentity(meta.clientId);
    const seat = meta.seat || seatForName(meta.name);
    const forcedName = seatName(seat);
    const resolved = resolveJoin({
      id: meta.id,
      stored,
      existingMeta: { ...meta, name: forcedName || meta.name },
      requestedName: forcedName,
      playerCount: this.players.size,
      takenNames: [...this.players.values()].map((player) => player.name),
      spawn: this.pickSpawn()
    });
    const player = {
      id: meta.id,
      name: forcedName || sanitizeName(resolved?.name, "A"),
      seat: seat || seatForName(resolved?.name),
      currentScene: resolved?.currentScene ?? SCENE.OUTDOOR,
      position: resolved?.position ?? this.pickSpawn(),
      facing: resolved?.facing ?? "south",
      clientId: meta.clientId,
      connId: meta.connId,
      lastSeen: Number(meta.lastSeen) || Date.now()
    };
    this.players.set(meta.id, player);
    return player;
  }

  rebuildPlayers() {
    for (const ws of this.ctx.getWebSockets()) {
      const meta = ws.deserializeAttachment();
      if (meta?.revoked) continue;
      if (meta?.id && !Number(meta.lastSeen)) {
        meta.lastSeen = Date.now();
        try {
          ws.serializeAttachment(meta);
        } catch {
          // Socket closed while rebuilding.
        }
      }
      this.ensurePlayer(meta);
    }
  }

  scheduleIdleSweep() {
    if (this.alarmScheduled) return;
    const now = Date.now();
    const idleDue = this.players.size ? now + IDLE_SWEEP_MS : Infinity;
    const weatherDue = this.weatherAt ? this.weatherAt + WEATHER_TTL_MS : now + WEATHER_TTL_MS;
    const next = Math.min(idleDue, weatherDue);
    if (!Number.isFinite(next)) return;
    this.alarmScheduled = true;
    try {
      this.ctx.storage.setAlarm(next).catch(() => {
        this.alarmScheduled = false;
      });
    } catch {
      this.alarmScheduled = false;
    }
  }

  removePlayer(meta) {
    if (!meta?.id) return;
    const current = this.players.get(meta.id);
    if (!current || (meta.connId && current.connId !== meta.connId)) return;
    if (current) {
      this.writeIdentity(current.clientId ?? meta.clientId, current);
      this.identityAt.delete(meta.id);
    }
    this.players.delete(meta.id);
    for (const [id, entry] of this.chatOutbox) {
      entry.to.delete(meta.id);
      if (!entry.to.size) this.chatOutbox.delete(id);
    }
    if (meta.connId) this.limiters.delete(meta.connId);
    this.broadcast({ v: 1, t: "leave", id: meta.id });
  }

  pruneIdlePlayers(now = Date.now()) {
    const cutoff = now - IDLE_TIMEOUT_MS;
    const liveIds = new Set();
    for (const ws of this.ctx.getWebSockets()) {
      const meta = ws.deserializeAttachment();
      if (!meta?.id) continue;
      const lastSeen = Number(meta.lastSeen) || 0;
      liveIds.add(meta.id);
      // Missing timestamps belong to sockets created before this release;
      // give them a fresh grace period rather than disconnecting immediately.
      if (!lastSeen) {
        meta.lastSeen = now;
        try {
          ws.serializeAttachment(meta);
        } catch {
          // Socket already closing.
        }
        continue;
      }
      if (lastSeen >= cutoff) continue;
      try {
        ws.close(4004, "idle timeout");
      } catch {
        // Already closed.
      }
      this.removePlayer(meta);
    }
    // A close event can be missed during a network partition. Any player with
    // no live socket must not keep a room seat.
    for (const player of [...this.players.values()]) {
      if (!liveIds.has(player.id)) {
        this.removePlayer({ id: player.id, connId: player.connId });
      }
    }
  }

  async alarm() {
    this.alarmScheduled = false;
    // A fresh/hibernated instance may not know its room id yet; load the
    // single persisted row first, then sweep its live sockets.
    await this.ensureLoaded(this.roomId);
    if (!this.roomId) return;
    this.rebuildPlayers();
    try {
      await this.refreshRoomWeather();
    } catch {
      // Weather is best-effort; never let it stop the idle sweep/alarm.
    }
    this.pruneIdlePlayers(Date.now());
    this.scheduleIdleSweep();
  }

  snapshot() {
    const players = {};
    for (const [id, player] of this.players) {
      players[id] = presenceOf(player);
    }
    return {
      schemaVersion: 3,
      roomId: this.roomId,
      seq: this.seq,
      plots: clonePlots(this.plots),
      stats: normalizeStats(this.stats),
      inventory: {
        seeds: { ...this.inventory?.seeds },
        goods: sanitizeGoods(this.inventory?.goods),
        produce: sanitizeProduce(this.inventory?.produce),
        dishes: sanitizeDishes(this.inventory?.dishes)
      },
      world: cloneWorld(this.world),
      weather: this.weather ? { ...this.weather } : null,
      board: cloneBoardMessages(this.board),
      players
    };
  }

  stateBody() {
    return {
      seq: this.seq,
      plots: clonePlots(this.plots),
      stats: normalizeStats(this.stats),
      inventory: {
        seeds: { ...this.inventory?.seeds },
        goods: sanitizeGoods(this.inventory?.goods),
        produce: sanitizeProduce(this.inventory?.produce),
        dishes: sanitizeDishes(this.inventory?.dishes)
      },
      world: cloneWorld(this.world),
      weather: this.weather ? { ...this.weather } : null
    };
  }

  broadcast(message, exceptId = null) {
    const text = JSON.stringify(message);
    for (const ws of this.ctx.getWebSockets()) {
      const meta = ws.deserializeAttachment();
      if (!meta?.id || meta.id === exceptId) continue;
      try {
        ws.send(text);
      } catch {
        // A tab closing can race one last broadcast; ignore it.
      }
    }
  }

  reject(ws, cid, code) {
    try {
      ws.send(
        JSON.stringify({
          v: 1,
          t: "reject",
          cid: cid ?? null,
          code,
          message: REJECT_TEXT[code] || "这次操作没有生效，可能状态已经变化了。"
        })
      );
    } catch {
      // Socket already closed.
    }
  }

  rejectUpgrade(code, message) {
    const pair = new WebSocketPair();
    this.ctx.acceptWebSocket(pair[1]);
    try {
      pair[1].send(JSON.stringify({ v: 1, t: "error", code, message }));
      pair[1].close(4003, code);
    } catch {
      // Best effort.
    }
    return new Response(null, { status: 101, webSocket: pair[0] });
  }

  async fetch(request) {
    const url = new URL(request.url);
    await this.ensureLoaded(
      (url.searchParams.get("room") || "").trim().toUpperCase()
    );
    this.rebuildPlayers();
    this.pruneIdlePlayers(Date.now());

    if (request.headers.get("Upgrade") !== "websocket") {
      return new Response("Expected WebSocket", { status: 426 });
    }

    const clientId = sanitizeClientId(url.searchParams.get("client"));
    const requestedSeat = seatFromHeader(request.headers.get("x-duet-seat"));
    const requestedName =
      seatName(requestedSeat) || sanitizeName(url.searchParams.get("name"), "");
    const existing = this.findSocket(clientId);
    const existingMeta = existing?.deserializeAttachment() ?? null;

    if (existing) {
      try {
        existing.close(4001, "replaced");
      } catch {
        // Already closing.
      }
    }

    // A second device signing in with the same seat takes over the seat: the
    // older socket is closed with 4001 and its transport stops reconnecting.
    // The same client id (refresh) is handled above and reuses its player.
    if (requestedSeat) {
      const conflict = [...this.players.values()].find(
        (player) =>
          player.clientId !== clientId &&
          (player.seat || seatForName(player.name)) === requestedSeat
      );
      if (conflict) {
        const oldSocket = this.findSocket(conflict.clientId);
        if (oldSocket) {
          const oldMeta = oldSocket.deserializeAttachment();
          if (oldMeta) {
            oldMeta.revoked = true;
            try {
              oldSocket.serializeAttachment(oldMeta);
            } catch {
              // Socket already closing.
            }
          }
          try {
            oldSocket.close(4001, "seat replaced");
          } catch {
            // Already closing.
          }
        }
        this.players.delete(conflict.id);
        this.broadcast({ v: 1, t: "leave", id: conflict.id });
      }
    }

    // Count actual players, not raw sockets. A stale player whose socket has
    // been pruned must not keep the room full.
    const occupied = [...this.players.values()].filter(
      (player) => player.id !== existingMeta?.id
    );

    if (occupied.length >= ROOM_MAX_PLAYERS) {
      return this.rejectUpgrade("ROOM_FULL", "房间已满，目前最多两个人。");
    }

    const pair = new WebSocketPair();
    const client = pair[0];
    const server = pair[1];
    this.ctx.acceptWebSocket(server);

    const stored = this.readIdentity(clientId);
    const id =
      existingMeta?.id ||
      stored?.playerId ||
      `p_${crypto.randomUUID().slice(0, 8)}`;
    const resolved = resolveJoin({
      id,
      stored,
      live: this.players.get(id) ?? null,
      existingMeta,
      requestedName,
      playerCount: this.players.size,
      takenNames: [...this.players.values()].map((player) => player.name),
      spawn: this.pickSpawn()
    });
    const connId = crypto.randomUUID();
    const name =
      seatName(requestedSeat) ||
      resolved?.name ||
      requestedName ||
      (this.players.size ? CHARACTERS.B.name : CHARACTERS.A.name);
    const playerSeat = requestedSeat || seatForName(name);

    const presence = {
      id,
      name,
      currentScene: resolved?.currentScene ?? SCENE.OUTDOOR,
      position: resolved?.position ?? this.pickSpawn(),
      facing: resolved?.facing ?? "south"
    };

    const meta = {
      id,
      clientId,
      name,
      seat: playerSeat,
      connId,
      joinedAt: Date.now(),
      lastSeen: Date.now()
    };
    server.serializeAttachment(meta);
    this.players.set(id, {
      ...presence,
      seat: playerSeat,
      clientId,
      connId,
      lastSeen: Date.now()
    });
    this.writeIdentity(clientId, this.players.get(id));
    this.scheduleIdleSweep();

    server.send(
      JSON.stringify({
        v: 1,
        t: "welcome",
        selfId: id,
        room: this.roomId,
        seq: this.seq,
        serverTime: Date.now(),
        name,
        scene: presence.currentScene,
        facing: presence.facing,
        spawn: presence.position,
        resumed: Boolean(resolved?.resumed),
        boardReadAt: this.readBoardAt(id),
        snapshot: this.snapshot()
      })
    );

    this.broadcast({ v: 1, t: "presence", player: presence }, id);
    return new Response(null, { status: 101, webSocket: client });
  }

  handlePresence(meta, message) {
    const current = this.players.get(meta.id);
    const name = current?.name ?? meta.name;
    const player = playerFromPresence({
      ...message.player,
      id: meta.id,
      // Never accept a client-supplied display name; the signed seat is the
      // authority for A/B.
      name
    });
    if (!player) return;

    const presence = presenceOf(player);
    let stored = {
      ...presence,
      seat: current?.seat ?? meta.seat ?? seatForName(name),
      clientId: meta.clientId,
      connId: meta.connId
    };
    // Two clients can click the table before either presence arrives. If both
    // claim the same stool, the DO reassigns the later one to the free stool
    // and echoes the correction to both clients.
    let corrected = false;
    if (
      stored.currentScene === SCENE.INDOOR_1 &&
      stored.activity?.kind === "meal"
    ) {
      const other = [...this.players.values()].find(
        (player) =>
          player.id !== meta.id &&
          player.currentScene === SCENE.INDOOR_1 &&
          player.activity?.kind === "meal" &&
          player.activity.slot === stored.activity.slot
      );
      if (other) {
        const freeSlot = [0, 1].find(
          (slot) => slot !== other.activity.slot
        );
        if (Number.isInteger(freeSlot)) {
          stored = {
            ...stored,
            activity: { ...stored.activity, slot: freeSlot }
          };
          corrected = true;
        }
      }
    }
    this.players.set(meta.id, stored);
    const now = Date.now();
    if (now - (this.identityAt.get(meta.id) ?? 0) > 3000) {
      this.writeIdentity(meta.clientId, stored);
      this.identityAt.set(meta.id, now);
    }
    const update = {
      v: 1,
      t: "presence",
      player: presenceOf(stored),
      ...(corrected ? { corrected: true } : {})
    };
    if (corrected) this.broadcast(update);
    else this.broadcast(update, meta.id);
  }

  handleSceneAct(ws, meta, message) {
    const cid = typeof message.cid === "string" ? message.cid.slice(0, 64) : "";
    const cidKey = cid ? `${meta.id}:${cid}` : "";
    if (cidKey && this.cids.has(cidKey)) {
      ws.send(
        JSON.stringify({ v: 1, t: "state", ...this.stateBody(), cid, duplicate: true })
      );
      return;
    }

    const player = this.players.get(meta.id);
    const now = Date.now();
    const gameState = {
      plots: this.plots,
      stats: this.stats,
      inventory: this.inventory,
      world: this.world,
      players: Object.fromEntries(this.players)
    };
    const payload = { ...(message.payload ?? {}) };
    const check = validateSceneAction(
      gameState,
      meta.id,
      message.action,
      message.targetId,
      payload,
      now
    );
    if (!check.ok) {
      this.reject(ws, cid, check.code);
      return;
    }

    const next = applySceneAction(
      gameState,
      meta.id,
      message.action,
      message.targetId,
      payload,
      now
    );
    if (!next) {
      this.reject(ws, cid, "NO_PLAYER");
      return;
    }

    this.plots = next.plots;
    this.stats = next.stats;
    this.inventory = next.inventory;
    this.world = next.world;
    this.seq += 1;
    this.persist();

    if (cidKey) {
      this.cids.set(cidKey, this.seq);
      while (this.cids.size > MAX_CID_HISTORY) {
        const oldest = this.cids.keys().next().value;
        this.cids.delete(oldest);
      }
    }

    const notice = getSceneNotice(
      message.action,
      next,
      { ...payload, sceneId: message.targetId },
      check
    );
    this.broadcast({
      v: 1,
      t: "state",
      ...this.stateBody(),
      event: {
        who: meta.id,
        when: now,
        action: message.action,
        targetId: message.targetId,
        payload
      },
      notice
    });
  }

  async handleAct(ws, meta, message) {
    if (message.action === ACTION.POST_MESSAGE) {
      this.handleBoardPost(ws, meta, message);
      return;
    }

    if (isSceneAction(message.action)) {
      this.handleSceneAct(ws, meta, message);
      return;
    }

    if (!isFarmAction(message.action)) {
      this.reject(ws, message.cid, "NOT_FARM_ACTION");
      return;
    }

    const cid = typeof message.cid === "string" ? message.cid.slice(0, 64) : "";
    const cidKey = cid ? `${meta.id}:${cid}` : "";
    if (cidKey && this.cids.has(cidKey)) {
      ws.send(
        JSON.stringify({ v: 1, t: "state", ...this.stateBody(), cid, duplicate: true })
      );
      return;
    }

    const now = Date.now();

    // Real Shenzhen rain is the authority for the shared RAIN_WATER action.
    // Other actions never wait for the weather fetch.
    let weather = this.weather;
    if (message.action === ACTION.RAIN_WATER) {
      weather = await this.ensureWeather();
    }

    const gameState = {
      plots: this.plots,
      stats: this.stats,
      inventory: this.inventory,
      world: this.world,
      weather,
      weatherAuthority: true,
      // Kitchen rules need to see both diners (shared meal), not just the
      // acting player. Other farm rules still only read their own player.
      players: Object.fromEntries(this.players)
    };

    const payload = { ...(message.payload ?? {}) };
    const check = validateFarmAction(
      gameState,
      meta.id,
      message.action,
      message.targetId,
      payload,
      now
    );
    if (!check.ok) {
      this.reject(ws, cid, check.code);
      return;
    }

    const plot = message.targetId ? this.plots?.[message.targetId] : null;
    if (message.action === ACTION.WATER_CROP) {
      payload.cropType = plot?.crop?.type ?? "radish";
    }
    if (message.action === ACTION.HARVEST_CROP) {
      Object.assign(payload, harvestReward(plot, gameState));
    }
    if (message.action === ACTION.CLEAR_HAZARD) {
      payload.hazardKind = getPlotHazard(plot, now)?.kind ?? "weeds";
    }
    if (
      message.action === ACTION.BUY_DECOR ||
      message.action === ACTION.REMOVE_DECOR
    ) {
      payload.itemId = message.targetId;
    }
    payload.actorId = meta.id;

    const next = applyFarmAction(
      gameState,
      meta.id,
      message.action,
      message.targetId,
      payload,
      now
    );
    if (!next) {
      this.reject(ws, cid, "NO_PLAYER");
      return;
    }
    // RAIN_WATER is idempotent: when a second client sends it after the first
    // already watered every bed, do not bump seq or broadcast another notice.
    if (next === gameState) {
      ws.send(JSON.stringify({ v: 1, t: "state", ...this.stateBody(), cid }));
      return;
    }

    this.plots = next.plots;
    this.stats = next.stats;
    this.inventory = next.inventory;
    this.world = next.world;
    this.seq += 1;
    this.persist();

    if (cidKey) {
      this.cids.set(cidKey, this.seq);
      while (this.cids.size > MAX_CID_HISTORY) {
        const oldest = this.cids.keys().next().value;
        this.cids.delete(oldest);
      }
    }

    const notice = getFarmNotice(message.action, next, payload, check);
    this.broadcast({
      v: 1,
      t: "state",
      ...this.stateBody(),
      event: {
        who: meta.id,
        when: now,
        action: message.action,
        targetId: message.targetId,
        payload
      },
      notice
    });
  }

  findSocketById(playerId) {
    if (!playerId) return null;
    for (const ws of this.ctx.getWebSockets()) {
      const meta = ws.deserializeAttachment();
      if (meta?.id === playerId) return ws;
    }
    return null;
  }

  pruneChatOutbox(now = Date.now()) {
    for (const [id, entry] of this.chatOutbox) {
      if (now - entry.at > CHAT_OUTBOX_TTL_MS) this.chatOutbox.delete(id);
    }
    while (this.chatOutbox.size > CHAT_OUTBOX_LIMIT) {
      this.chatOutbox.delete(this.chatOutbox.keys().next().value);
    }
  }

  chatRecipients(meta) {
    const player = this.players.get(meta.id);
    if (!player) return [];
    const targets = [];
    for (const ws of this.ctx.getWebSockets()) {
      const otherMeta = ws.deserializeAttachment();
      if (!otherMeta?.id || otherMeta.id === meta.id) continue;
      const other = this.players.get(otherMeta.id);
      if (!other || other.currentScene !== player.currentScene) continue;
      targets.push({ ws, meta: otherMeta });
    }
    return targets;
  }

  sendChatAck(ws, cid, payload) {
    try {
      ws.send(
        JSON.stringify({
          v: 1,
          t: "chat_ack",
          cid: cid || null,
          id: payload?.id ?? null,
          delivered: payload?.delivered ?? 0,
          code: payload?.code ?? null,
          at: payload?.at ?? Date.now()
        })
      );
    } catch {
      // Socket already closed.
    }
  }

  handleChat(ws, meta, message) {
    const player = this.players.get(meta.id);
    const cid = typeof message.cid === "string" ? message.cid.slice(0, 64) : "";
    const text = normalizeChatText(message.text);
    const now = Date.now();

    if (!player) {
      this.sendChatAck(ws, cid, { code: "NO_PLAYER", at: now });
      return;
    }
    if (!text) {
      this.sendChatAck(ws, cid, { code: "EMPTY_MESSAGE", at: now });
      return;
    }

    const chat = createChatMessage({
      id: `ch_${crypto.randomUUID().slice(0, 12)}`,
      from: meta.id,
      name: player.name,
      text,
      at: now
    });
    if (!chat) {
      this.sendChatAck(ws, cid, { code: "EMPTY_MESSAGE", at: now });
      return;
    }

    // Only players standing in the same logical scene receive the message.
    const recipients = this.chatRecipients(meta);
    for (const target of recipients) {
      try {
        target.ws.send(JSON.stringify({ v: 1, t: "chat", ...chat }));
      } catch {
        // Recipient socket closed mid-broadcast.
      }
    }

    if (recipients.length) {
      this.chatOutbox.set(chat.id, {
        from: meta.id,
        to: new Set(recipients.map((target) => target.meta.id)),
        at: now
      });
      this.pruneChatOutbox(now);
    }

    this.sendChatAck(ws, cid, {
      id: chat.id,
      delivered: recipients.length,
      at: now
    });
  }

  handleChatRead(meta, message) {
    const id = typeof message.id === "string" ? message.id : "";
    const entry = id ? this.chatOutbox.get(id) : null;
    if (!entry) return;
    if (!entry.to.has(meta.id)) return;

    entry.to.delete(meta.id);
    if (!entry.to.size) this.chatOutbox.delete(id);

    const sender = this.findSocketById(entry.from);
    if (!sender) return;
    try {
      sender.send(
        JSON.stringify({
          v: 1,
          t: "chat_read",
          id,
          from: meta.id,
          at: Date.now()
        })
      );
    } catch {
      // Sender socket already closed.
    }
  }

  async webSocketMessage(ws, raw) {
    const meta = ws.deserializeAttachment();
    if (!meta?.id || meta.revoked) return;

    await this.ensureLoaded();
    this.ensurePlayer(meta);

    // Any protocol frame proves the socket is alive, not only presence.
    meta.lastSeen = Date.now();
    const active = this.players.get(meta.id);
    if (active) active.lastSeen = meta.lastSeen;
    try {
      ws.serializeAttachment(meta);
    } catch {
      // Socket already closing.
    }
    this.scheduleIdleSweep();

    let message;
    try {
      message = JSON.parse(typeof raw === "string" ? raw : "");
    } catch {
      return;
    }
    if (!message || message.v !== 1 || typeof message.t !== "string") return;

    const now = Date.now();
    const limiters = this.limiterFor(meta);
    if (!limiters.all.allow(now)) {
      // A client that ignores the budget gets disconnected instead of being
      // allowed to burn Durable Object CPU.
      try {
        ws.close(4008, "rate limited");
      } catch {
        // Already closed.
      }
      return;
    }

    switch (message.t) {
      case "presence":
        if (!limiters.presence.allow(now)) return;
        this.handlePresence(meta, message);
        break;
      case "act":
        if (message.action === ACTION.POST_MESSAGE) {
          if (!limiters.board.allow(now)) {
            this.reject(ws, message.cid, "RATE_LIMITED");
            return;
          }
        } else if (!limiters.act.allow(now)) {
          this.reject(ws, message.cid, "RATE_LIMITED");
          return;
        }
        await this.handleAct(ws, meta, message);
        break;
      case "chat":
        if (!limiters.chat.allow(now)) {
          this.sendChatAck(ws, message.cid, {
            code: "RATE_LIMITED",
            at: now
          });
          return;
        }
        this.handleChat(ws, meta, message);
        break;
      case "chat_read":
        if (!limiters.presence.allow(now)) return;
        this.handleChatRead(meta, message);
        break;
      case "board_read":
        if (!limiters.board.allow(now)) return;
        this.markBoardRead(meta.id);
        break;
      case "board_export":
        if (!limiters.board.allow(now)) return;
        this.handleBoardExport(ws);
        break;
      case "ping":
        if (!limiters.ping.allow(now)) return;
        try {
          ws.send(
            JSON.stringify({
              v: 1,
              t: "pong",
              c: message.c ?? null,
              s: Date.now(),
              seq: this.seq
            })
          );
        } catch {
          // Socket already closed.
        }
        break;
      case "bye":
        try {
          ws.close(1000, "bye");
        } catch {
          // Already closed.
        }
        break;
      default:
        break;
    }
  }

  webSocketClose(ws) {
    const meta = ws.deserializeAttachment();
    if (!meta?.id) return;
    this.removePlayer(meta);
  }

  webSocketError(ws) {
    try {
      ws.close(1011, "socket error");
    } catch {
      // Already closed.
    }
  }
}
