import { CHARACTERS, CROPS, ECONOMY, PLAYER_ID, SCENE } from "../config.js";
import { sanitizeBoardMessages } from "./board.js";
import { createEmptyPlots } from "./crop.js";
import { sanitizeWorld } from "./world.js";
import { sanitizeGoods } from "./warehouse.js";
import { sanitizeDishes, sanitizeProduce } from "./kitchen.js";
import { createPlayerEntity } from "./player.js";

function normalizeSeeds(raw) {
  const seeds = {};
  for (const cropId of Object.keys(CROPS)) {
    const value = Number(raw?.[cropId]);
    seeds[cropId] = Number.isFinite(value) && value > 0 ? Math.floor(value) : 0;
  }
  return seeds;
}

export function createInitialState(savedFarm = null) {
  const player = createPlayerEntity({
    id: PLAYER_ID,
    name: CHARACTERS.A.name,
    currentScene: SCENE.OUTDOOR,
    position: { x: -1.35, y: -0.15 },
    facing: "south"
  });

  const harvested = Number(savedFarm?.stats?.harvested);
  const coins = Number(savedFarm?.stats?.coins);
  const giftDay =
    typeof savedFarm?.stats?.giftDay === "string"
      ? savedFarm.stats.giftDay
      : "";
  const cooked = Number(savedFarm?.stats?.cooked);
  const meals = Number(savedFarm?.stats?.meals);
  const mealDay =
    typeof savedFarm?.stats?.mealDay === "string"
      ? savedFarm.stats.mealDay.slice(0, 10)
      : "";

  return {
    schemaVersion: 3,
    activePlayerId: PLAYER_ID,
    // Runtime-only room weather (never persisted in the local save).
    weather: null,
    players: {
      [PLAYER_ID]: player
    },
    plots: savedFarm?.plots ?? createEmptyPlots(),
    stats: {
      harvested:
        Number.isFinite(harvested) && harvested >= 0 ? Math.floor(harvested) : 0,
      coins:
        Number.isFinite(coins) && coins >= 0
          ? Math.floor(coins)
          : ECONOMY.startingCoins,
      giftDay,
      cooked:
        Number.isFinite(cooked) && cooked >= 0 ? Math.floor(cooked) : 0,
      meals: Number.isFinite(meals) && meals >= 0 ? Math.floor(meals) : 0,
      mealDay
    },
    inventory: {
      seeds: normalizeSeeds(savedFarm?.inventory?.seeds ?? ECONOMY.startingSeeds),
      goods: sanitizeGoods(savedFarm?.inventory?.goods),
      produce: sanitizeProduce(savedFarm?.inventory?.produce),
      dishes: sanitizeDishes(savedFarm?.inventory?.dishes)
    },
    world: sanitizeWorld(savedFarm?.world),
    board: {
      messages: sanitizeBoardMessages(savedFarm?.board?.messages),
      lastReadAt: Math.max(0, Number(savedFarm?.board?.lastReadAt) || 0)
    },
    ui: {
      notice: null,
      nextNoticeId: 1,
      emptyRoomSeen: false,
      spiritGreets: 0,
      selectedPlotId: null,
      selectedSeed: CROPS.radish.id,
      shopOpen: false,
      boardOpen: false,
      decorOpen: false,
      kitchenOpen: false,
      pendingScene: null,
      pendingSeat: null
    }
  };
}
