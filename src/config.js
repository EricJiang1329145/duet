// Pure game configuration shared by game logic, scenes and UI.
// This module intentionally has no DOM, Three.js or network dependency.

export const SCENE = Object.freeze({
  OUTDOOR: "outdoor",
  GREENHOUSE: "greenhouse",
  MEADOW: "meadow",
  DOCK: "dock",
  ORCHARD: "orchard",
  SPRING: "spring",
  INDOOR_1: "indoor_1",
  INDOOR_2: "indoor_2"
});

// One big home map now holds every plot; kept as a set so farm rules do not
// need to know how many scenes exist.
export const FARM_SCENES = Object.freeze(
  new Set([SCENE.OUTDOOR, SCENE.GREENHOUSE])
);

export const ACTION = Object.freeze({
  FIELD_CLICKED: "FIELD_CLICKED",
  PLANT_CROP: "PLANT_CROP",
  WATER_CROP: "WATER_CROP",
  HARVEST_CROP: "HARVEST_CROP",
  CLEAR_HAZARD: "CLEAR_HAZARD",
  UNLOCK_PLOT: "UNLOCK_PLOT",
  BUY_SEED: "BUY_SEED",
  BUY_GREENHOUSE: "BUY_GREENHOUSE",
  CLAIM_GIFT: "CLAIM_GIFT",
  CLOSE_PLOT_PANEL: "CLOSE_PLOT_PANEL",
  ENTER_HOUSE: "ENTER_HOUSE",
  EXIT_HOUSE: "EXIT_HOUSE",
  ENTER_GREENHOUSE: "ENTER_GREENHOUSE",
  EXIT_GREENHOUSE: "EXIT_GREENHOUSE",
  ENTER_MEADOW: "ENTER_MEADOW",
  EXIT_MEADOW: "EXIT_MEADOW",
  ENTER_DOCK: "ENTER_DOCK",
  EXIT_DOCK: "EXIT_DOCK",
  ENTER_ORCHARD: "ENTER_ORCHARD",
  EXIT_ORCHARD: "EXIT_ORCHARD",
  ENTER_SPRING: "ENTER_SPRING",
  EXIT_SPRING: "EXIT_SPRING",
  UNLOCK_SCENE: "UNLOCK_SCENE",
  COLLECT_RESOURCE: "COLLECT_RESOURCE",
  SELL_GOODS: "SELL_GOODS",
  GO_UPSTAIRS: "GO_UPSTAIRS",
  GO_DOWNSTAIRS: "GO_DOWNSTAIRS",
  OPEN_DECOR: "OPEN_DECOR",
  CLOSE_DECOR: "CLOSE_DECOR",
  BUY_DECOR: "BUY_DECOR",
  REMOVE_DECOR: "REMOVE_DECOR",
  OPEN_SHOP: "OPEN_SHOP",
  CLOSE_SHOP: "CLOSE_SHOP",
  READ_BOARD: "READ_BOARD",
  CLOSE_BOARD: "CLOSE_BOARD",
  POST_MESSAGE: "POST_MESSAGE",
  SIT_SWING: "SIT_SWING",
  SIT_SEESAW: "SIT_SEESAW",
  STAND_UP: "STAND_UP",
  SLEEP: "SLEEP",
  WORK: "WORK",
  SIT_SOFA: "SIT_SOFA",
  OPEN_KITCHEN: "OPEN_KITCHEN",
  CLOSE_KITCHEN: "CLOSE_KITCHEN",
  COOK_DISH: "COOK_DISH",
  SELL_DISH: "SELL_DISH",
  SERVE_MEAL: "SERVE_MEAL",
  SIT_MEAL: "SIT_MEAL",
  EAT_MEAL: "EAT_MEAL",
  GREET_SPIRIT: "GREET_SPIRIT",
  INSPECT: "INSPECT",
  RAIN_WATER: "RAIN_WATER",
  WALK_TO: "WALK_TO",
  MOVE_TICK: "MOVE_TICK",
  CLEAR_NOTICE: "CLEAR_NOTICE"
});

// Chat is deliberately not a reducer action: messages are ephemeral and do
// not belong to durable game state. The room client exposes sendChat/ackChat.
export const SEND_CHAT = "SEND_CHAT";

export const SCENE_META = Object.freeze({
  outdoor: {
    code: "01",
    title: "小院",
    hint: "点田地种菜 · 点地面走动 · 点房门进屋"
  },
  greenhouse: {
    code: "G",
    title: "温室",
    hint: "点田地照料温室作物 · 点门回小院"
  },
  meadow: {
    code: "M",
    title: "花间坡",
    hint: "点野花/蜂巢采集 · 点门回小院"
  },
  dock: {
    code: "D",
    title: "溪畔码头",
    hint: "点鱼篓/贝壳采集 · 点木门回小院"
  },
  orchard: {
    code: "O",
    title: "山坡果园",
    hint: "点果树采集果子 · 点门回小院"
  },
  spring: {
    code: "S",
    title: "雾汤温泉",
    hint: "点茶丛/温泉蛋采集 · 点门回小院"
  },
  indoor_1: {
    code: "02",
    title: "一层 · 双卧 · 双书房",
    hint: "靠近自己的卧室门会开 · 卫生间 · 双书房 · 楼梯上二层"
  },
  indoor_2: {
    code: "03",
    title: "二层 · 娱乐室",
    hint: "点装修牌添置电视/游戏机/沙发 · 点楼梯回一层"
  },
});

export const FACING_YAW = Object.freeze({
  south: 0,
  southeast: Math.PI / 4,
  east: Math.PI / 2,
  northeast: (Math.PI * 3) / 4,
  north: Math.PI,
  northwest: (-Math.PI * 3) / 4,
  west: -Math.PI / 2,
  southwest: -Math.PI / 4
});

export const FACING_OCTANTS = Object.freeze([
  "north",
  "northwest",
  "west",
  "southwest",
  "south",
  "southeast",
  "east",
  "northeast",
  "north"
]);

export const INPUT = Object.freeze({
  // v0.5 breathing-room pass: a slightly wider orthographic frustum shows
  // more lawn around the house and keeps the six plots from touching.
  BASE_VIEW_WIDTH: 10.8,
  BASE_VIEW_HEIGHT: 14.6
});

export const COLORS = Object.freeze({
  grass: "#a9ca94",
  grassLight: "#b9d7a2",
  grassDark: "#8eb278",
  earth: "#856552",
  earthDark: "#6e5141",
  path: "#d8c6aa",
  pathAlt: "#cdb99c",
  house: "#f0ddc2",
  houseSide: "#e6cda9",
  houseTrim: "#fff3df",
  roof: "#bd6b50",
  roofTop: "#a95b44",
  window: "#a9d0d2",
  windowInset: "#7bb2b5",
  door: "#4f7463",
  doorLine: "#3d5c4e",
  brass: "#e2b76b",
  wood: "#c99663",
  woodDark: "#a7754c",
  woodDeep: "#805636",
  soil: "#885d42",
  soilLine: "#714a33",
  cork: "#c58f5b",
  paper: "#fff3d7",
  paperAlt: "#f4cfa9",
  sage: "#7e9b82",
  sageDark: "#637e68",
  rose: "#d39b87",
  cream: "#f7ead6",
  wall: "#f5e7d5",
  wallShade: "#ead8c5",
  floor: "#d8b080",
  floorLine: "#c39668",
  rug: "#e7c3a7",
  rugAlt: "#c9d2b2",
  concrete: "#d8cfc2",
  concreteDark: "#bfb3a4",
  stair: "#c69a69",
  stairDark: "#a87d51",
  metal: "#586c63",
  leaf: "#719d74",
  leafLight: "#8eb887",
  leafDark: "#537c5d",
  trunk: "#8d674d",
  plantPot: "#b56e53",
  ink: "#2f3e33",
  white: "#fffaf0",
  terracotta: "#b96545",
  honey: "#e6b769",
  cropSeed: "#6f4e38",
  cropStem: "#6e966a",
  cropLeaf: "#8db277",
  cropLeafLight: "#b5cf91",
  radish: "#d8795f",
  radishDark: "#bc634d",
  carrot: "#e0913f",
  carrotDark: "#c1762c",
  tomato: "#cf5f45",
  tomatoDark: "#a94532",
  glass: "#cfe4de",
  glassEdge: "#9fbfb5",
  weed: "#7f9c5c",
  weedDark: "#5f7a44",
  pest: "#4b4632",
  swingRope: "#b08a5c",
  seesaw: "#c98a5c",
  seesawAlt: "#a96b45"
});

export const PLAYER_RADIUS = 0.22;
export const MAX_WALK_STEP_SECONDS = 0.05;

// v0.6: one large farm map. Four columns by three rows leaves real paths
// between plots and room for the greenhouse, pond and outbuildings.
export const FIELD_GRID = Object.freeze({
  startX: -4.8,
  startZ: 1.4,
  stepX: 2.75,
  stepZ: 2.35,
  size: 1.6,
  columns: 4,
  rows: 3
});

function gridObstacles(grid) {
  const rects = [];
  for (let row = 0; row < grid.rows; row += 1) {
    for (let col = 0; col < grid.columns; col += 1) {
      const x = grid.startX + col * grid.stepX;
      const z = grid.startZ + row * grid.stepZ;
      rects.push({
        minX: x - grid.size / 2,
        maxX: x + grid.size / 2,
        minZ: z - grid.size / 2,
        maxZ: z + grid.size / 2
      });
    }
  }
  return rects;
}

export const FIELD_OBSTACLES = gridObstacles(FIELD_GRID);

/**
 * Three prototype crops with different pace and value. Growth times stay in
 * the seconds range so the whole loop can be tested by hand.
 */
export const CROPS = Object.freeze({
  radish: Object.freeze({
    id: "radish",
    label: "小萝卜",
    short: "萝卜",
    description: "长得最快，适合先攒金币。",
    seedCost: 2,
    sellPrice: 5,
    leafyAfterMs: 5000,
    readyAfterMs: 12000,
    seedYieldChance: 55,
    stem: "#6e966a",
    leaf: "#8db277",
    leafLight: "#b5cf91",
    fruit: "#d8795f",
    fruitDark: "#bc634d",
    shape: "root",
    season: "spring"
  }),
  carrot: Object.freeze({
    id: "carrot",
    label: "胡萝卜",
    short: "胡萝卜",
    description: "中生长期，卖价更稳。",
    seedCost: 4,
    sellPrice: 10,
    leafyAfterMs: 9000,
    readyAfterMs: 22000,
    seedYieldChance: 45,
    stem: "#6b9466",
    leaf: "#86ae74",
    leafLight: "#b9d296",
    fruit: "#e0913f",
    fruitDark: "#c1762c",
    shape: "cone",
    season: "autumn"
  }),
  tomato: Object.freeze({
    id: "tomato",
    label: "小番茄",
    short: "番茄",
    description: "成熟慢，但能卖个好价钱。",
    seedCost: 7,
    sellPrice: 18,
    leafyAfterMs: 14000,
    readyAfterMs: 35000,
    seedYieldChance: 35,
    stem: "#5f8a5f",
    leaf: "#7fa86f",
    leafLight: "#aecb8b",
    fruit: "#cf5f45",
    fruitDark: "#a94532",
    shape: "round",
    season: "summer"
  })
});

export const CROP_IDS = Object.freeze(Object.keys(CROPS));
// Legacy alias kept for modules that only need the default crop.
export const CROP = CROPS.radish;

export const PLOT_IDS = Object.freeze(
  Array.from(
    { length: FIELD_GRID.rows * FIELD_GRID.columns },
    (_, index) => `field_${String(index + 1).padStart(2, "0")}`
  )
);
export const HOME_PLOT_IDS = PLOT_IDS;

export const PLOT_SCENE = Object.freeze(
  Object.fromEntries(PLOT_IDS.map((id) => [id, SCENE.OUTDOOR]))
);

// Six open beds are enough to start a real farm; six more are reclaimable.
export const INITIAL_UNLOCKED_PLOTS = Object.freeze(PLOT_IDS.slice(0, 6));
export const PLOT_UNLOCK_COST = Object.freeze({
  field_07: 25,
  field_08: 35,
  field_09: 45,
  field_10: 60,
  field_11: 80,
  field_12: 100
});
export const GREENHOUSE_PLOTS = Object.freeze(["field_11", "field_12"]);
export const GREENHOUSE_COST = 80;
export const GREENHOUSE_SELL_MULTIPLIER = 1.25;
export const GREENHOUSE_FRAME = Object.freeze({
  x: 2.075,
  z: 6.1,
  width: 4.85,
  depth: 2.1
});
// The greenhouse's outside approach point is in front of its door.
export const GREENHOUSE_DOOR = Object.freeze({
  outside: Object.freeze({ x: 2.075, y: 7.65 }),
  inside: Object.freeze({ x: 0, y: 1.4 })
});

export function plotSceneFor(world, plotId) {
  if (world?.greenhouse && GREENHOUSE_PLOTS.includes(plotId)) {
    return SCENE.GREENHOUSE;
  }
  return PLOT_SCENE[plotId] ?? SCENE.OUTDOOR;
}

// Shared, coin-funded extra scenes. The first one is deliberately small: one
// daily flower patch and one daily hive, both stored in the pantry.
export const SCENE_UNLOCKS = Object.freeze({
  meadow: Object.freeze({
    id: "meadow",
    title: "花间坡",
    cost: 120,
    entry: "西侧小径",
    description: "野花与蜂蜜，每天可以采集一次。"
  }),
  dock: Object.freeze({
    id: "dock",
    title: "溪畔码头",
    cost: 180,
    entry: "南侧木桥",
    description: "钓鱼和捡贝壳，每天可以采集一次。"
  }),
  orchard: Object.freeze({
    id: "orchard",
    title: "山坡果园",
    cost: 240,
    entry: "东侧坡道",
    description: "果树和果香，每天可以采集一次。"
  }),
  spring: Object.freeze({
    id: "spring",
    title: "雾汤温泉",
    cost: 320,
    entry: "北侧石阶",
    description: "温泉、茶与蛋，夜里也会冒热气。"
  })
});

export const GOODS = Object.freeze({
  flower: Object.freeze({
    id: "flower",
    label: "野花",
    short: "野花",
    sellPrice: 4,
    color: "#d98f9f"
  }),
  honey: Object.freeze({
    id: "honey",
    label: "蜂蜜",
    short: "蜂蜜",
    sellPrice: 10,
    color: "#dca84f"
  }),
  fish: Object.freeze({
    id: "fish",
    label: "小鱼",
    short: "小鱼",
    sellPrice: 8,
    color: "#7faec0"
  }),
  shell: Object.freeze({
    id: "shell",
    label: "贝壳",
    short: "贝壳",
    sellPrice: 3,
    color: "#e8c9aa"
  }),
  fruit: Object.freeze({
    id: "fruit",
    label: "果子",
    short: "果子",
    sellPrice: 12,
    color: "#d77e63"
  }),
  tea: Object.freeze({
    id: "tea",
    label: "茶叶",
    short: "茶叶",
    sellPrice: 9,
    color: "#7f9c68"
  }),
  onsenEgg: Object.freeze({
    id: "onsenEgg",
    label: "温泉蛋",
    short: "温泉蛋",
    sellPrice: 6,
    color: "#f0d39a"
  })
});

export const GOOD_IDS = Object.freeze(Object.keys(GOODS));

/**
 * Cooked dishes. Harvesting a crop now leaves one produce item in the pantry;
 * combining it with foraged goods turns a slow harvest into a warm meal. The
 * bowl/soup colours are used by the tiny 3D bowl on the dining table.
 */
export const DISHES = Object.freeze({
  radish_soup: Object.freeze({
    id: "radish_soup",
    label: "萝卜清汤",
    short: "萝卜汤",
    description: "小火慢慢煨软的萝卜，汤是甜的。",
    sellPrice: 16,
    soup: "#e3c489",
    bowl: "#f1e7d5"
  }),
  honey_carrot: Object.freeze({
    id: "honey_carrot",
    label: "蜂蜜烤胡萝卜",
    short: "烤胡萝卜",
    description: "烤到边缘微焦，再淋一勺蜂蜜。",
    sellPrice: 34,
    soup: "#d98a3f",
    bowl: "#f1e7d5"
  }),
  tomato_fish: Object.freeze({
    id: "tomato_fish",
    label: "番茄炖鱼",
    short: "番茄鱼",
    description: "酸甜的番茄汤里卧着一尾小鱼。",
    sellPrice: 56,
    soup: "#c65a3f",
    bowl: "#f1e7d5"
  })
});

export const DISH_IDS = Object.freeze(Object.keys(DISHES));

export const RECIPES = Object.freeze({
  radish_soup: Object.freeze({
    id: "radish_soup",
    dishId: "radish_soup",
    label: "萝卜清汤",
    description: "两块萝卜，一锅清水，慢慢煨软。",
    produce: Object.freeze({ radish: 2 }),
    goods: Object.freeze({})
  }),
  honey_carrot: Object.freeze({
    id: "honey_carrot",
    dishId: "honey_carrot",
    label: "蜂蜜烤胡萝卜",
    description: "两根胡萝卜烤软，淋上花间坡的蜂蜜。",
    produce: Object.freeze({ carrot: 2 }),
    goods: Object.freeze({ honey: 1 })
  }),
  tomato_fish: Object.freeze({
    id: "tomato_fish",
    dishId: "tomato_fish",
    label: "番茄炖鱼",
    description: "两颗番茄和一尾小鱼，炖出一锅酸甜。",
    produce: Object.freeze({ tomato: 2 }),
    goods: Object.freeze({ fish: 1 })
  })
});

export const RECIPE_IDS = Object.freeze(Object.keys(RECIPES));

export const KITCHEN = Object.freeze({
  id: "kitchen",
  center: Object.freeze({ x: -3.7, z: 5.15 }),
  stand: Object.freeze({ x: -2.55, z: 4.2 }),
  // Close enough to the counter to cook; the dining table is just outside.
  radius: 2.4
});

// Two-seat dining table. Both seats face the table, and the table is also a
// real walk obstacle so players cannot cut through it.
export const DINING = Object.freeze({
  id: "dining",
  // Kept a little north of the front door: at z=4.55 the low front wall and
  // the door leaf hide the tabletop from the fixed south-east camera.
  center: Object.freeze({ x: -1.2, z: 3.55 }),
  stand: Object.freeze({ x: -2.45, z: 3.55 }),
  radius: 3.2,
  seats: Object.freeze([
    Object.freeze({ slot: 0, x: -1.2, z: 2.82, facing: "south" }),
    Object.freeze({ slot: 1, x: -1.2, z: 4.28, facing: "north" })
  ])
});

export function diningSeat(slot) {
  return DINING.seats.find((seat) => seat.slot === slot) ?? DINING.seats[0];
}

export const KITCHEN_ECONOMY = Object.freeze({
  sharedMealCoins: 12
});

export const SCENE_RESOURCES = Object.freeze({
  spring: Object.freeze([
    Object.freeze({
      id: "spring_tea",
      label: "茶丛",
      goods: "tea",
      amount: 2,
      x: -2.4,
      z: 0.1
    }),
    Object.freeze({
      id: "spring_eggs",
      label: "温泉蛋篮",
      goods: "onsenEgg",
      amount: 2,
      x: 2.4,
      z: 0.4
    })
  ]),
  orchard: Object.freeze([
    Object.freeze({
      id: "orchard_apples",
      label: "苹果树",
      goods: "fruit",
      amount: 2,
      x: -2.4,
      z: -0.4
    }),
    Object.freeze({
      id: "orchard_pears",
      label: "梨树",
      goods: "fruit",
      amount: 2,
      x: 2.4,
      z: -0.4
    })
  ]),
  dock: Object.freeze([
    Object.freeze({
      id: "dock_fish",
      label: "鱼篓",
      goods: "fish",
      amount: 1,
      x: 0.2,
      z: 0.1
    }),
    Object.freeze({
      id: "dock_shells",
      label: "贝壳堆",
      goods: "shell",
      amount: 2,
      x: 2.8,
      z: 0.8
    })
  ]),
  meadow: Object.freeze([
    Object.freeze({
      id: "meadow_flowers",
      label: "野花丛",
      goods: "flower",
      amount: 2,
      x: -2.3,
      z: 0.4
    }),
    Object.freeze({
      id: "meadow_hive",
      label: "蜂巢",
      goods: "honey",
      amount: 1,
      x: 2.2,
      z: 0.2
    })
  ])
});

export const ECONOMY = Object.freeze({
  startingCoins: 24,
  startingSeeds: Object.freeze({ radish: 3, carrot: 1, tomato: 0 }),
  giftCoins: 6,
  giftSeeds: 2,
  giftCrop: "radish",
  harvestSeedHash: 100
});

export const HAZARD = Object.freeze({
  chancePercent: 58,
  minDelayMs: 5500,
  spreadMs: 4500
});

export const FARM_SAVE_KEY = "duet.farm.v3";
export const LEGACY_FARM_SAVE_KEY = "duet.farm.v2";
export const FARM_SAVE_VERSION = 3;

// Where an interaction walks to before it is allowed to change scene.
export const STAIRS = Object.freeze({
  x: 4.8,
  bottom: Object.freeze({ x: 4.8, y: 4.35 }),
  top: Object.freeze({ x: 4.8, y: 2.3 })
});

export const APPROACH_POINTS = Object.freeze({
  enter: Object.freeze({ x: 0, y: -1.2 }),
  exit: Object.freeze({ x: 0, y: 4.25 }),
  upstairs: Object.freeze({ ...STAIRS.bottom }),
  downstairs: Object.freeze({ ...STAIRS.top }),
  greenhouseEnter: Object.freeze({ x: 2.075, y: 7.65 }),
  greenhouseExit: Object.freeze({ x: 0, y: 1.4 }),
  meadowEnter: Object.freeze({ x: -10.9, y: 1.2 }),
  meadowExit: Object.freeze({ x: 0, y: 2.45 }),
  dockEnter: Object.freeze({ x: -4.5, y: 8.9 }),
  dockExit: Object.freeze({ x: 0, y: 2.45 }),
  orchardEnter: Object.freeze({ x: 10.85, y: 1.2 }),
  orchardExit: Object.freeze({ x: 0, y: 2.45 }),
  springEnter: Object.freeze({ x: 10.4, y: -8.7 }),
  springExit: Object.freeze({ x: 0, y: 2.45 })
});

export const APPROACH_RADIUS = 0.55;

export const WALK_LAYOUTS = Object.freeze({
  outdoor: {
    speed: 2.8,
    // Visible fence line is around +/-12.6 / +/-9.8; the walkable rectangle
    // sits just inside it. There is no extra camera band any more.
    bounds: { minX: -11.8, maxX: 11.8, minZ: -9.2, maxZ: 9.2 },
    obstacles: [
      ...FIELD_OBSTACLES,
      // Villa (main block + west/east wings).
      { minX: -8.2, maxX: 8.2, minZ: -8.8, maxZ: -2.0 },
      // Well, potting shed, compost bin and pond.
      { minX: -8.8, maxX: -7.6, minZ: 0.9, maxZ: 2.1 },
      { minX: 7.65, maxX: 9.55, minZ: 0.42, maxZ: 1.98 },
      { minX: -8.825, maxX: -7.575, minZ: 4.3, maxZ: 5.3 },
      { minX: 6.2, maxX: 10.8, minZ: 3.8, maxZ: 7.6 }
    ],
    emptyRoom: null
  },
  greenhouse: {
    speed: 1.9,
    bounds: { minX: -3.1, maxX: 3.1, minZ: -1.8, maxZ: 2.05 },
    obstacles: [
      { minX: -2.9, maxX: -0.9, minZ: -1.0, maxZ: 1.0 },
      { minX: 0.9, maxX: 2.9, minZ: -1.0, maxZ: 1.0 }
    ],
    emptyRoom: null
  },
  spring: {
    speed: 1.9,
    bounds: { minX: -5.6, maxX: 5.6, minZ: -3.3, maxZ: 3.0 },
    obstacles: [],
    emptyRoom: null
  },
  orchard: {
    speed: 2.0,
    bounds: { minX: -5.6, maxX: 5.6, minZ: -3.3, maxZ: 3.0 },
    obstacles: [],
    emptyRoom: null
  },
  dock: {
    speed: 2.0,
    bounds: { minX: -5.6, maxX: 5.6, minZ: -3.3, maxZ: 3.0 },
    obstacles: [],
    emptyRoom: null
  },
  meadow: {
    speed: 2.0,
    bounds: { minX: -5.6, maxX: 5.6, minZ: -3.3, maxZ: 3.0 },
    obstacles: [],
    emptyRoom: null
  },
  indoor_1: {
    speed: 2.1,
    bounds: { minX: -8.75, maxX: 8.75, minZ: -5.75, maxZ: 5.75 },
    obstacles: [
      // Bedroom front walls: exactly one door per bedroom.
      { minX: -8.75, maxX: -4.95, minZ: -1.55, maxZ: -1.25 },
      { minX: -3.45, maxX: -1.25, minZ: -1.55, maxZ: -1.25 },
      { minX: 1.25, maxX: 3.45, minZ: -1.55, maxZ: -1.25 },
      { minX: 4.95, maxX: 8.75, minZ: -1.55, maxZ: -1.25 },
      // Solid bedroom side walls (no second door).
      { minX: -1.45, maxX: -1.25, minZ: -5.75, maxZ: -1.4 },
      { minX: 1.25, maxX: 1.45, minZ: -5.75, maxZ: -1.4 },
      // Bathroom walls and its south door.
      { minX: -1.25, maxX: -1.05, minZ: -5.75, maxZ: -2.75 },
      { minX: 1.05, maxX: 1.25, minZ: -5.75, maxZ: -2.75 },
      { minX: -1.25, maxX: -0.6, minZ: -2.95, maxZ: -2.75 },
      { minX: 0.6, maxX: 1.25, minZ: -2.95, maxZ: -2.75 },
      // Study A walls with a living-room door.
      { minX: -5.7, maxX: -5.5, minZ: 0.8, maxZ: 2.4 },
      { minX: -5.7, maxX: -5.5, minZ: 3.6, maxZ: 4.8 },
      { minX: -8.75, maxX: -5.5, minZ: 0.8, maxZ: 1.0 },
      { minX: -8.75, maxX: -5.5, minZ: 4.6, maxZ: 4.8 },
      // Study B walls with a living-room door.
      { minX: 5.5, maxX: 5.7, minZ: 0.8, maxZ: 1.6 },
      { minX: 5.5, maxX: 5.7, minZ: 2.8, maxZ: 3.4 },
      { minX: 5.5, maxX: 8.75, minZ: 0.8, maxZ: 1.0 },
      { minX: 5.5, maxX: 8.75, minZ: 3.2, maxZ: 3.4 },
      // Beds and nightstands.
      { minX: -7.2, maxX: -5.5, minZ: -5.0, maxZ: -2.9 },
      { minX: 5.5, maxX: 7.2, minZ: -5.0, maxZ: -2.9 },
      { minX: -8.15, maxX: -7.65, minZ: -4.3, maxZ: -3.3 },
      { minX: 7.65, maxX: 8.15, minZ: -4.3, maxZ: -3.3 },
      // Bathroom fixtures.
      { minX: -0.95, maxX: -0.15, minZ: -5.55, maxZ: -4.65 },
      { minX: 0.2, maxX: 0.95, minZ: -5.55, maxZ: -4.85 },
      { minX: 0.35, maxX: 1.0, minZ: -4.05, maxZ: -3.35 },
      // Study desks/chairs.
      { minX: -8.35, maxX: -6.4, minZ: 1.25, maxZ: 2.25 },
      { minX: 6.4, maxX: 8.35, minZ: 1.2, maxZ: 2.2 },
      // Living sofa, table, kitchen counter and storage cabinets.
      { minX: -3.8, maxX: -2.6, minZ: 0.2, maxZ: 2.6 },
      { minX: -0.9, maxX: 0.9, minZ: 0.8, maxZ: 1.9 },
      { minX: -4.9, maxX: -2.8, minZ: 4.8, maxZ: 5.55 },
      { minX: -5.55, maxX: -4.45, minZ: 4.55, maxZ: 5.25 },
      { minX: 1.95, maxX: 3.05, minZ: 4.65, maxZ: 5.35 },
      // Dining table (the two benches sit just outside this box).
      { minX: -1.95, maxX: -0.45, minZ: 3.08, maxZ: 4.02 },
      // Staircase footprint (bottom/top landing points stay outside).
      { minX: 3.8, maxX: 5.8, minZ: 2.7, maxZ: 4.05 }
    ],
    emptyRoom: null
  },
  indoor_2: {
    speed: 2.1,
    bounds: { minX: -8.75, maxX: 8.75, minZ: -5.75, maxZ: 5.75 },
    obstacles: [
      // The stairwell is a real opening; decor collision is added dynamically.
      { minX: 3.8, maxX: 5.8, minZ: 2.5, maxZ: 4.25 }
    ],
    emptyRoom: { minX: -5.6, maxX: 5.6, minZ: -4.4, maxZ: 4.4 }
  }
});

/**
 * Garden playground props. Sitting is a low-frequency action (one event per
 * sit/stand), so it works without any realtime loop. The swing phase is
 * derived from the shared `since` timestamp.
 */
export const PLAYGROUND = Object.freeze({
  swing: Object.freeze({
    id: "swing",
    label: "秋千",
    pivot: Object.freeze({ x: -8.4, y: -1.0 }),
    hangY: 1.82,
    ropeLength: 1.3,
    stand: Object.freeze({ x: -7.5, y: -1.0 }),
    walkRadius: 1.9,
    periodMs: 2600,
    amplitude: 0.38,
    duoAmplitude: 0.5,
    seats: Object.freeze([
      Object.freeze({ slot: 0, x: -8.67, y: -1.0 }),
      Object.freeze({ slot: 1, x: -8.13, y: -1.0 })
    ])
  }),
  seesaw: Object.freeze({
    id: "seesaw",
    label: "跷跷板",
    pivot: Object.freeze({ x: -8.8, y: 6.6 }),
    walkRadius: 1.9,
    periodMs: 3200,
    restAngle: 0.16,
    ends: Object.freeze([
      Object.freeze({ side: "a", x: -9.34, y: 6.6, stand: Object.freeze({ x: -9.12, y: 6.3 }) }),
      Object.freeze({ side: "b", x: -8.26, y: 6.6, stand: Object.freeze({ x: -7.96, y: 6.3 }) })
    ])
  }),
  seatY: 0.46
});

// Second-floor decoration. Each piece has a fixed, reserved spot in
// indoor_2; buying it toggles that spot on for both players.
export const DECOR = Object.freeze({
  tv: Object.freeze({
    id: "tv",
    label: "大电视",
    cost: 40,
    description: "二层娱乐角的大屏幕，纯装饰。"
  }),
  console: Object.freeze({
    id: "console",
    label: "游戏机",
    cost: 30,
    description: "电视柜上的游戏机，纯装饰。"
  }),
  sofa: Object.freeze({
    id: "sofa",
    label: "双人沙发",
    cost: 35,
    description: "正对电视的双人沙发，适合一起窝着。"
  }),
  rug: Object.freeze({
    id: "rug",
    label: "羊毛地毯",
    cost: 12,
    description: "一块暖色地毯，让娱乐角立刻有了落脚点。"
  }),
  shelf: Object.freeze({
    id: "shelf",
    label: "小书架",
    cost: 20,
    description: "钉在后墙上的书架，可以摆几本旧书。"
  }),
  plant: Object.freeze({
    id: "plant",
    label: "窗边绿植",
    cost: 8,
    description: "一盆耐养的绿植，给角落添点生气。"
  }),
  lamp: Object.freeze({
    id: "lamp",
    label: "落地灯",
    cost: 16,
    description: "暖黄色落地灯，让二层在傍晚也暖洋洋的。"
  })
});

export const DECOR_IDS = Object.freeze(Object.keys(DECOR));

// Fixed furniture collision, only added for pieces that are actually owned.
export const DECOR_OBSTACLES = Object.freeze({
  tv: Object.freeze({ minX: -1.6, maxX: 1.6, minZ: -5.7, maxZ: -5.15 }),
  console: Object.freeze({ minX: -1.2, maxX: 1.2, minZ: -5.1, maxZ: -4.65 }),
  sofa: Object.freeze({ minX: -2.2, maxX: 2.2, minZ: -3.9, maxZ: -2.7 }),
  plant: Object.freeze({ minX: -7.6, maxX: -7.1, minZ: -4.2, maxZ: -3.7 }),
  lamp: Object.freeze({ minX: 6.1, maxX: 6.6, minZ: 1.8, maxZ: 2.3 })
});

// One online room. The old TEST instance is retired as an entry point.
export const ROOMS = Object.freeze({
  MAIN: Object.freeze({ id: "MAIN", label: "正式", title: "正式房间" })
});
export const DEFAULT_ROOM_ID = ROOMS.MAIN.id;
export const SOLO_PARAM = "solo";

export const PLAYER_ID = "local-player";

// Fixed character names. Change these two strings to rename the pair; there is
// intentionally no in-game rename UI or free-form name entry.
export const CHARACTERS = Object.freeze({
  A: Object.freeze({ id: "A", name: "A" }),
  B: Object.freeze({ id: "B", name: "B" })
});
export const DEFAULT_CHARACTER_ID = "A";

export function characterNameFor(value, fallback = "") {
  const text = String(value ?? "").trim();
  if (text === "B" || text === "b") {
    return CHARACTERS.B.name;
  }
  if (text === "A" || text === "a") {
    return CHARACTERS.A.name;
  }
  return fallback;
}
export const BEDROOMS = Object.freeze({
  A: Object.freeze({
    id: "A",
    owner: CHARACTERS.A.name,
    label: "卧室 A",
    door: Object.freeze({ minX: -4.95, maxX: -3.45, minZ: -1.55, maxZ: -1.25 }),
    center: Object.freeze({ x: -4.2, z: -1.4 }),
    hingeX: -4.95,
    width: 1.4,
    openAngle: -Math.PI / 2,
    bed: Object.freeze({ x: -6.0, z: -4.1 }),
    sleep: Object.freeze({ x: -6.0, z: -3.25 }),
    wake: Object.freeze({ x: -6.0, z: -2.55 })
  }),
  B: Object.freeze({
    id: "B",
    owner: CHARACTERS.B.name,
    label: "卧室 B",
    door: Object.freeze({ minX: 3.45, maxX: 4.95, minZ: -1.55, maxZ: -1.25 }),
    center: Object.freeze({ x: 4.2, z: -1.4 }),
    hingeX: 4.95,
    width: 1.4,
    openAngle: Math.PI / 2,
    bed: Object.freeze({ x: 6.0, z: -4.1 }),
    sleep: Object.freeze({ x: 6.0, z: -3.25 }),
    wake: Object.freeze({ x: 6.0, z: -2.55 })
  })
});

export function bedroomForPlayer(player) {
  const name = String(player?.name ?? "").trim();
  if (name === BEDROOMS.A.owner) return BEDROOMS.A;
  if (name === BEDROOMS.B.owner) return BEDROOMS.B;
  return null;
}

// Two shared studies on the first floor. Each desk is a seated work station.
export const STUDIES = Object.freeze({
  A: Object.freeze({
    id: "study_a",
    label: "书房 A",
    desk: Object.freeze({ x: -7.2, z: 1.85 }),
    seats: Object.freeze([
      Object.freeze({ slot: 0, x: -7.65, z: 2.72 }),
      Object.freeze({ slot: 1, x: -6.75, z: 2.72 })
    ]),
    stand: Object.freeze({ x: -7.2, z: 3.55 }),
    bounds: Object.freeze({ minX: -8.7, maxX: -5.6, minZ: 0.8, maxZ: 4.8 })
  }),
  B: Object.freeze({
    id: "study_b",
    label: "书房 B",
    desk: Object.freeze({ x: 7.2, z: 1.9 }),
    seats: Object.freeze([
      Object.freeze({ slot: 0, x: 6.75, z: 2.72 }),
      Object.freeze({ slot: 1, x: 7.65, z: 2.72 })
    ]),
    stand: Object.freeze({ x: 7.2, z: 3.1 }),
    bounds: Object.freeze({ minX: 5.6, maxX: 8.7, minZ: 0.8, maxZ: 3.3 })
  })
});

export const STUDY_IDS = Object.freeze(Object.values(STUDIES).map((study) => study.id));

export function studyById(id) {
  return Object.values(STUDIES).find((study) => study.id === id) ?? null;
}

export function studySeat(study, slot) {
  return (
    study?.seats?.find((seat) => seat.slot === slot) ??
    study?.seats?.[0] ??
    null
  );
}

// Two-seat living-room sofa. Clicking the sofa picks the first free seat.
export const SOFA = Object.freeze({
  id: "sofa",
  center: Object.freeze({ x: -3.2, z: 1.4 }),
  seats: Object.freeze([
    Object.freeze({ slot: 0, x: -3.2, z: 0.78, facing: "east" }),
    Object.freeze({ slot: 1, x: -3.2, z: 2.02, facing: "east" })
  ]),
  stand: Object.freeze({ x: -2.25, z: 1.4 })
});

export function sofaSeat(slot) {
  return SOFA.seats.find((seat) => seat.slot === slot) ?? SOFA.seats[0];
}

export const ROOM_MAX_PLAYERS = 2;

export const CHAT = Object.freeze({
  textLimit: 60,
  codePointLimit: 120,
  durationMs: 12000,
  fadeMs: 420,
  rateCapacity: 3,
  rateRefillPerSecond: 0.6
});

export const SEASONS = Object.freeze({
  spring: Object.freeze({
    id: "spring",
    label: "春",
    sky: ["#e7efdc", "#f6ead4"],
    sun: 0xfff1dc,
    sunIntensity: 2.25,
    ambient: 0xf4eee4,
    ambientIntensity: 1.55
  }),
  summer: Object.freeze({
    id: "summer",
    label: "夏",
    sky: ["#e3f0d6", "#f7edd2"],
    sun: 0xfff4d8,
    sunIntensity: 2.4,
    ambient: 0xf6efe0,
    ambientIntensity: 1.6
  }),
  autumn: Object.freeze({
    id: "autumn",
    label: "秋",
    sky: ["#f1e4cd", "#f6dfc4"],
    sun: 0xffe5c2,
    sunIntensity: 2.2,
    ambient: 0xf4e6d6,
    ambientIntensity: 1.5
  }),
  winter: Object.freeze({
    id: "winter",
    label: "冬",
    sky: ["#e6eef0", "#f2eee4"],
    sun: 0xf3f4f8,
    sunIntensity: 1.95,
    ambient: 0xeeeef0,
    ambientIntensity: 1.45
  })
});

export const WEATHERS = Object.freeze({
  sunny: Object.freeze({ id: "sunny", label: "晴" }),
  cloudy: Object.freeze({ id: "cloudy", label: "多云" }),
  rain: Object.freeze({ id: "rain", label: "小雨" })
});

// The yard has one fixed real-world home. Both players live in Shenzhen and
// this is not expected to change, so the weather source never asks for
// browser geolocation or an IP lookup.
export const HOME_LOCATION = Object.freeze({
  name: "深圳",
  lat: 22.5431,
  lon: 114.0579,
  timeZone: "Asia/Shanghai"
});

export const CAMERA_RIG = Object.freeze({
  // The camera now smoothly follows the player; this is only the boot focus.
  target: Object.freeze({ x: 0, y: 1.1, z: 0.4 }),
  offset: Object.freeze({ x: 24, y: 24, z: 24 }),
  followLerp: 7.5,
  // While lying down, pull back to the middle of the first floor so both
  // bedrooms and chat bubbles stay visible.
  sleepTarget: Object.freeze({ x: 0, y: 1.1, z: 0 }),
  sleepZoom: 0.68
});

export const LIGHTING = Object.freeze({
  sun: Object.freeze({
    color: 0xfff1dc,
    intensity: 2.25,
    position: Object.freeze({ x: -6, y: 11, z: 7 }),
    target: Object.freeze({ x: 0, y: 0, z: -1 })
  }),
  ambient: Object.freeze({
    color: 0xf4eee4,
    intensity: 1.55
  })
});
