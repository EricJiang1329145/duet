import {
  ACTION,
  BEDROOMS,
  COLORS,
  DINING,
  KITCHEN,
  SOFA,
  STUDIES
} from "../config.js";
import { buildPottedPlant, buildStairs } from "./props.js";

/**
 * Enlarged first floor: two bedrooms (one door each), a central bathroom, two
 * studies, living room, kitchen/dining, storage cabinets and the staircase.
 * Bedroom doors are owned by A/B and are animated by presentation.
 */
export function buildIndoorOneScene(kit) {
  const {
    scene,
    addBox,
    addCylinder,
    addPlane,
    addGroup,
    addHitbox,
    markWalkSurface,
    addWorldLabel,
    registerDoor,
    registerProp
  } = kit;

  const W = 18;
  const D = 12;
  addBox(scene, W + 0.2, 0.42, D + 0.2, COLORS.woodDark, 0, -0.33, 0);
  const floor = addBox(scene, W, 0.3, D, COLORS.floor, 0, -0.15, 0);
  markWalkSurface(floor);
  for (let i = 0; i < 14; i += 1) {
    const z = -5.55 + i * 0.82;
    addPlane(scene, W - 0.2, 0.018, COLORS.floorLine, 0, 0.008, z, {
      materialOptions: { transparent: true, opacity: 0.28 }
    });
  }

  // Shell.
  addBox(scene, W, 2.4, 0.18, COLORS.wall, 0, 1.2, -6.02);
  addBox(scene, W, 0.14, 0.24, COLORS.houseTrim, 0, 0.1, -5.92);
  addBox(scene, 0.18, 1.55, D, COLORS.wallShade, -9.0, 0.77, 0);
  addBox(scene, 0.18, 1.55, D, COLORS.wallShade, 9.0, 0.77, 0);
  addBox(scene, 7.8, 0.5, 0.18, COLORS.wallShade, -5.1, 0.25, 5.92);
  addBox(scene, 7.8, 0.5, 0.18, COLORS.wallShade, 5.1, 0.25, 5.92);

  // Bedrooms: solid side walls, one front door each.
  const bedroomDoorViews = [];
  const sleepLabelViews = [];
  const workLabelViews = [];
  for (const [side, bedroom] of [
    [-1, BEDROOMS.A],
    [1, BEDROOMS.B]
  ]) {
    addBox(scene, 3.95, 1.7, 0.16, COLORS.wall, side * 6.9, 0.85, -1.4);
    addBox(scene, 2.1, 1.7, 0.16, COLORS.wall, side * 2.4, 0.85, -1.4);
    addBox(scene, 0.24, 0.12, 1.7, COLORS.houseTrim, side * 4.95, 1.75, -1.4);
    addBox(scene, 0.24, 0.12, 1.1, COLORS.houseTrim, side * 3.45, 1.75, -1.4);
    // Solid side partition, replacing the old side doorway.
    addBox(scene, 0.16, 1.9, 4.5, COLORS.wall, side * 1.35, 0.95, -3.5);
    addBox(scene, 0.12, 1.78, 0.12, COLORS.woodDark, side * 4.95, 0.89, -1.4);
    addBox(scene, 0.12, 1.78, 0.12, COLORS.woodDark, side * 3.45, 0.89, -1.4);
    addBox(scene, 1.52, 0.12, 0.22, COLORS.houseTrim, side * 4.2, 1.76, -1.4);
    addWorldLabel(bedroom.label, side * 5.9, 2.3, -4.2, "room");
    buildBed(scene, addGroup, addBox, addPlane, side * 6.0, side < 0 ? COLORS.sage : COLORS.rose);
    addHitbox(scene, ACTION.SLEEP, bedroom.id, {
      w: 2.3,
      h: 1.3,
      d: 2.2,
      x: side * 6.0,
      y: 0.66,
      z: -4.1
    });
    const sleepAction = addWorldLabel("睡觉", side * 6.0, 1.35, -2.9, "action");
    const zzz = addWorldLabel("ZZZ", side * 6.0, 1.55, -4.8, "sleep");
    sleepLabelViews.push({ id: bedroom.id, el: zzz, action: sleepAction });
    addBox(scene, 0.55, 0.5, 0.55, COLORS.woodDark, side * 8.05, 0.25, -4.0);
    addCylinder(scene, 0.07, 0.09, 0.16, 8, COLORS.paper, side * 8.05, 0.56, -4.0);
    addBox(scene, 0.22, 0.42, 0.22, COLORS.honey, side * 8.25, 0.95, -2.4);
    for (const x of [side * 5.2, side * 7.1]) {
      addBox(scene, 1.1, 1.0, 0.08, COLORS.houseTrim, x, 1.55, -5.9);
      addBox(scene, 0.9, 0.78, 0.04, COLORS.window, x, 1.55, -5.86);
      addBox(scene, 1.1, 0.06, 0.14, COLORS.houseTrim, x, 1.0, -5.86);
    }
    addPlane(scene, 2.8, 1.7, COLORS.rug, side * 5.9, 0.014, -2.3, {
      materialOptions: { transparent: true, opacity: 0.65 }
    });
    // Door leaf: closed by default; presentation opens it for its owner.
    const pivot = addGroup(scene, bedroom.hingeX, 0, -1.4);
    const dir = side < 0 ? 1 : -1;
    addBox(pivot, 1.35, 1.55, 0.07, COLORS.wood, dir * 0.7, 0.79, 0);
    addBox(pivot, 0.92, 0.035, 0.075, COLORS.woodDark, dir * 0.7, 1.13, 0.045);
    addBox(pivot, 0.92, 0.035, 0.075, COLORS.woodDark, dir * 0.7, 0.46, 0.045);
    addCylinder(pivot, 0.045, 0.045, 0.07, 8, COLORS.brass, dir * 1.24, 0.79, 0.06, {
      rx: Math.PI / 2
    });
    bedroomDoorViews.push({
      id: bedroom.id,
      owner: bedroom.owner,
      label: bedroom.label,
      pivot,
      closedAngle: 0,
      openAngle: side < 0 ? Math.PI / 2 : -Math.PI / 2,
      center: bedroom.center
    });
  }

  registerProp("bedroomDoors", { doors: bedroomDoorViews });
  registerProp("sleepLabels", { labels: sleepLabelViews });
  registerProp("workLabels", { labels: workLabelViews });

  // Bathroom between the bedrooms.
  for (const x of [-1.15, 1.15]) {
    addBox(scene, 0.16, 1.9, 2.85, COLORS.wall, x, 0.95, -4.25);
  }
  addBox(scene, 0.55, 1.9, 0.16, COLORS.wall, -0.6, 0.95, -2.8);
  addBox(scene, 0.55, 1.9, 0.16, COLORS.wall, 0.6, 0.95, -2.8);
  addBox(scene, 1.4, 0.12, 0.22, COLORS.houseTrim, 0, 1.96, -2.8);
  addWorldLabel("卫生间", 0, 2.15, -3.1, "room");
  addPlane(scene, 1.9, 2.5, "#cfd9d5", 0, 0.012, -4.3, {
    materialOptions: { transparent: true, opacity: 0.7 }
  });
  addBox(scene, 0.9, 0.45, 1.5, COLORS.paper, -0.45, 0.24, -4.55);
  addBox(scene, 0.82, 0.18, 1.4, COLORS.windowInset, -0.45, 0.48, -4.55);
  addBox(scene, 0.38, 0.7, 0.38, COLORS.paper, 0.55, 0.35, -4.6);
  addCylinder(scene, 0.14, 0.18, 0.08, 8, COLORS.metal, 0.55, 0.74, -4.6);
  addBox(scene, 0.5, 0.38, 0.65, COLORS.paper, 0.55, 0.19, -3.5);

  // Two studies, one west and one east.
  buildStudy(
    scene,
    addBox,
    addCylinder,
    addGroup,
    addHitbox,
    addWorldLabel,
    -1,
    COLORS.sage,
    workLabelViews
  );
  buildStudy(
    scene,
    addBox,
    addCylinder,
    addGroup,
    addHitbox,
    addWorldLabel,
    1,
    COLORS.rose,
    workLabelViews
  );

  // Living room.
  addPlane(scene, 4.6, 3.2, COLORS.rug, 0, 0.014, 1.3, {
    materialOptions: { transparent: true, opacity: 0.85 }
  });
  addPlane(scene, 3.5, 2.3, COLORS.rugAlt, 0, 0.022, 1.3, {
    materialOptions: { transparent: true, opacity: 0.35 }
  });
  const sofa = addGroup(scene, -3.2, 0, 1.4);
  addBox(sofa, 1.0, 0.5, 2.0, COLORS.sage, 0, 0.32, 0);
  addBox(sofa, 0.22, 0.58, 2.0, COLORS.sageDark, -0.48, 0.6, 0);
  addBox(sofa, 1.0, 0.3, 0.22, COLORS.sage, 0, 0.7, -1.0);
  addBox(sofa, 1.0, 0.3, 0.22, COLORS.sage, 0, 0.7, 1.0);
  addHitbox(scene, ACTION.SIT_SOFA, "sofa", {
    w: 1.35,
    h: 1.15,
    d: 2.2,
    x: SOFA.center.x,
    y: 0.62,
    z: SOFA.center.z
  });
  addWorldLabel("坐下", SOFA.center.x, 1.25, 2.75, "action");
  const table = addGroup(scene, 0, 0, 1.55);
  addBox(table, 1.5, 0.09, 0.9, COLORS.wood, 0, 0.34, 0);
  for (const [x, z] of [[-0.55, -0.3], [0.55, -0.3], [-0.55, 0.3], [0.55, 0.3]]) {
    addBox(table, 0.09, 0.3, 0.09, COLORS.woodDark, x, 0.15, z);
  }
  addCylinder(table, 0.07, 0.09, 0.12, 8, COLORS.paper, -0.25, 0.45, 0.1);
  addCylinder(table, 0.07, 0.09, 0.12, 8, COLORS.paperAlt, 0.25, 0.45, -0.1);

  // Kitchen counter and dining, south-west/center.
  const kitchen = addGroup(scene, -3.7, 0, 5.15);
  addBox(kitchen, 1.7, 0.9, 0.72, COLORS.woodDark, 0, 0.45, 0);
  addBox(kitchen, 1.78, 0.1, 0.8, COLORS.houseTrim, 0, 0.93, 0);
  addBox(kitchen, 0.5, 0.08, 0.5, COLORS.metal, -0.4, 0.98, 0);
  addBox(kitchen, 0.45, 0.05, 0.4, COLORS.ink, 0.4, 1.0, 0);
  const dining = addGroup(scene, DINING.center.x, 0, DINING.center.z);
  addBox(dining, 1.5, 0.1, 0.95, COLORS.wood, 0, 0.38, 0);
  for (const [x, z] of [[-0.6, -0.32], [0.6, -0.32], [-0.6, 0.32], [0.6, 0.32]]) {
    addBox(dining, 0.08, 0.34, 0.08, COLORS.woodDark, x, 0.17, z);
  }
  for (const z of [-0.7, 0.7]) {
    addBox(dining, 0.55, 0.08, 0.45, COLORS.sage, 0, 0.46, z);
    addBox(dining, 0.55, 0.55, 0.08, COLORS.sageDark, 0, 0.72, z + (z > 0 ? 0.2 : -0.2));
  }
  const diningLabel = addWorldLabel(
    "餐桌",
    DINING.center.x - 0.95,
    1.05,
    DINING.center.z,
    "action"
  );
  const diningHitbox = addHitbox(scene, ACTION.SIT_MEAL, "dining", {
    w: 1.8,
    h: 1.2,
    d: 1.2,
    x: DINING.center.x,
    y: 0.62,
    z: DINING.center.z
  });
  // The table itself becomes EAT_MEAL while seated; the two stools stay on
  // SIT_MEAL so "起身" is always reachable without clicking the floor.
  for (const seat of DINING.seats) {
    addHitbox(scene, ACTION.SIT_MEAL, "dining", {
      w: 1.0,
      h: 0.6,
      d: 0.55,
      x: seat.x,
      y: 0.5,
      z: seat.z
    });
  }

  // A small bowl lives on the table and only appears while a dish is waiting
  // for someone. Presentation animates the steam and tints the soup.
  const mealGroup = addGroup(
    scene,
    DINING.center.x,
    0.44,
    DINING.center.z
  );
  addCylinder(mealGroup, 0.24, 0.19, 0.1, 12, COLORS.paper, 0, 0.05, 0);
  const soup = addCylinder(mealGroup, 0.17, 0.17, 0.025, 12, "#e3c489", 0, 0.108, 0);
  addBox(mealGroup, 0.26, 0.018, 0.018, COLORS.woodDark, 0.03, 0.132, 0.075, {
    ry: 0.18
  });
  addBox(mealGroup, 0.26, 0.018, 0.018, COLORS.woodDark, 0.06, 0.132, 0.105, {
    ry: 0.18
  });
  const steam = [];
  for (const [x, z, phase] of [
    [-0.06, -0.02, 0],
    [0.05, 0.03, 0.45],
    [-0.01, 0.06, 0.9]
  ]) {
    const puff = addCylinder(mealGroup, 0.045, 0.015, 0.16, 6, COLORS.white, x, 0.27, z, {
      materialOptions: { transparent: true, opacity: 0.22, depthWrite: false }
    });
    steam.push({ mesh: puff, phase });
  }
  mealGroup.visible = false;

  // Stove interaction and the pot that hints at cooking.
  addCylinder(kitchen, 0.17, 0.2, 0.13, 10, COLORS.metal, 0, 1.03, 0);
  addCylinder(kitchen, 0.16, 0.16, 0.03, 10, COLORS.metal, 0, 1.11, 0);
  const stoveHitbox = addHitbox(scene, ACTION.OPEN_KITCHEN, "stove", {
    w: 1.45,
    h: 1.25,
    d: 1.0,
    x: KITCHEN.center.x,
    y: 0.62,
    z: KITCHEN.center.z
  });
  addWorldLabel("灶台", KITCHEN.center.x, 1.5, KITCHEN.center.z, "action");
  registerProp("kitchen", {
    hitbox: stoveHitbox,
    center: KITCHEN.center
  });
  registerProp("dining", {
    hitbox: diningHitbox,
    label: diningLabel,
    group: mealGroup,
    soup,
    steam,
    center: DINING.center
  });

  // Notice board on the south wall, left of the door.
  const board = addGroup(scene, -6.9, 0, 5.88);
  addBox(board, 3.1, 1.35, 0.12, COLORS.woodDeep, 0, 1.45, 0);
  addBox(board, 2.9, 1.1, 0.1, COLORS.cork, 0, 1.45, 0.07);
  addBox(board, 0.38, 0.28, 0.02, COLORS.paper, -0.8, 1.58, 0.14, { rz: -0.06 });
  addBox(board, 0.32, 0.24, 0.02, COLORS.paperAlt, 0.1, 1.72, 0.14, { rz: 0.04 });
  addHitbox(board, ACTION.READ_BOARD, "notice_board", {
    w: 3.25,
    h: 2.2,
    d: 0.65,
    x: 0,
    y: 1.3,
    z: 0.1
  });
  addWorldLabel("留言板", -6.9, 2.55, 5.7, "board");

  // Storage cabinets: two readable, non-blocking storage landmarks.
  buildCabinet(scene, addBox, addHitbox, addWorldLabel, -5.0, 4.9);
  buildCabinet(scene, addBox, addHitbox, addWorldLabel, 2.5, 5.0);
  buildPottedPlant(scene, 3.7, -0.4, 1.0);

  // Staircase and front door.
  buildStairs(scene, 4.8, 3.95, 7, 1.2, 0.27, 0.2, COLORS.stair);
  addHitbox(scene, ACTION.GO_UPSTAIRS, "stairs_up", {
    w: 1.55,
    h: 1.8,
    d: 1.55,
    x: 4.8,
    y: 0.85,
    z: 3.35
  });
  addWorldLabel("上楼", 5.65, 1.45, 3.35, "action");

  addBox(scene, 2.2, 0.04, 1.1, COLORS.rug, 0, 0.02, 5.1);
  addBox(scene, 1.72, 0.055, 0.55, COLORS.path, 0, 0.04, 5.55);
  addBox(scene, 0.14, 2.45, 0.14, COLORS.woodDark, -0.95, 1.22, 5.8);
  addBox(scene, 0.14, 2.45, 0.14, COLORS.woodDark, 0.95, 1.22, 5.8);
  addBox(scene, 2.05, 0.16, 0.18, COLORS.woodDark, 0, 2.45, 5.8);
  addPlane(scene, 1.55, 2.05, COLORS.paper, 0, 1.05, 5.84, {
    materialOptions: { transparent: true, opacity: 0.32, depthWrite: false }
  });
  const doorHinge = addGroup(scene, -0.9, 0, 5.86);
  addBox(doorHinge, 1.8, 2.1, 0.07, COLORS.door, 0.9, 1.05, 0);
  addBox(doorHinge, 0.95, 0.04, 0.03, COLORS.doorLine, 0.9, 1.6, 0.05);
  addBox(doorHinge, 0.95, 0.04, 0.03, COLORS.doorLine, 0.9, 1.15, 0.05);
  addCylinder(doorHinge, 0.045, 0.045, 0.07, 8, COLORS.brass, 1.6, 1.05, 0.06, {
    rx: Math.PI / 2
  });
  registerDoor(doorHinge, { openAngle: -1.5 });
  addHitbox(scene, ACTION.EXIT_HOUSE, "door_indoor", {
    w: 2.2,
    h: 3.0,
    d: 0.9,
    x: 0,
    y: 1.5,
    z: 5.8
  });
  addWorldLabel("出门", 0, 2.75, 5.7, "action");
}

function buildBed(scene, addGroup, addBox, addPlane, x, blanketColor) {
  const bed = addGroup(scene, x, 0, -4.1);
  addBox(bed, 2.2, 0.32, 2.15, COLORS.woodDark, 0, 0.2, 0);
  addBox(bed, 2.02, 0.2, 1.95, COLORS.cream, 0, 0.46, 0.02);
  addBox(bed, 2.06, 0.1, 1.15, blanketColor, 0, 0.59, 0.38);
  addBox(bed, 2.3, 1.02, 0.16, COLORS.woodDark, 0, 0.61, -1.08);
  addBox(bed, 0.72, 0.16, 0.42, COLORS.paper, 0, 0.65, -0.65, { rz: -0.02 });
  addPlane(bed, 2.6, 1.5, COLORS.rugAlt, 0, 0.011, 0.2, {
    materialOptions: { transparent: true, opacity: 0.35 }
  });
}

function buildStudy(
  scene,
  addBox,
  addCylinder,
  addGroup,
  addHitbox,
  addWorldLabel,
  side,
  accent,
  workLabelViews
) {
  const x = side * 7.0;
  const study = side < 0 ? STUDIES.A : STUDIES.B;
  // Room walls: inner wall has a door gap, plus north/south walls.
  addBox(
    scene,
    0.16,
    1.65,
    side < 0 ? 1.6 : 0.8,
    COLORS.wall,
    side * 5.6,
    0.82,
    side < 0 ? 1.6 : 1.2
  );
  // West study is taller/deeper; east fits above the stairs.
  if (side < 0) {
    addBox(scene, 0.16, 1.65, 1.2, COLORS.wall, -5.6, 0.82, 4.2);
    addBox(scene, 3.1, 1.65, 0.16, COLORS.wall, -7.15, 0.82, 1.0);
    addBox(scene, 3.1, 1.65, 0.16, COLORS.wall, -7.15, 0.82, 4.7);
    addBox(scene, 0.12, 0.12, 1.2, COLORS.houseTrim, -5.6, 1.7, 3.0);
  } else {
    addBox(scene, 0.16, 1.65, 0.8, COLORS.wall, 5.6, 0.82, 1.2);
    addBox(scene, 0.16, 1.65, 0.5, COLORS.wall, 5.6, 0.82, 3.05);
    addBox(scene, 3.1, 1.65, 0.16, COLORS.wall, 7.15, 0.82, 1.0);
    addBox(scene, 3.1, 1.65, 0.16, COLORS.wall, 7.15, 0.82, 3.3);
    addBox(scene, 0.12, 0.12, 1.15, COLORS.houseTrim, 5.6, 1.7, 2.2);
  }
  const desk = addGroup(scene, side * 7.2, 0, side < 0 ? 1.85 : 1.9);
  addBox(desk, 1.7, 0.1, 0.85, COLORS.wood, 0, 0.42, 0);
  addBox(desk, 0.1, 0.4, 0.75, COLORS.woodDark, -0.7, 0.2, 0);
  addBox(desk, 0.1, 0.4, 0.75, COLORS.woodDark, 0.7, 0.2, 0);
  addBox(desk, 0.55, 0.08, 0.35, COLORS.paper, 0.2, 0.5, 0);
  addCylinder(desk, 0.05, 0.06, 0.2, 8, COLORS.metal, -0.35, 0.58, 0.05);
  addBox(desk, 0.5, 0.45, 0.5, accent, 0, 0.23, 0.9);
  addBox(scene, 2.2, 1.7, 0.28, COLORS.woodDark, side * 7.2, 0.85, side < 0 ? 1.15 : 1.15);

  // Two desk chairs, so both players can study together.
  for (const seat of study.seats) {
    addBox(scene, 0.58, 0.12, 0.58, accent, seat.x, 0.5, seat.z);
    addBox(scene, 0.58, 0.62, 0.1, COLORS.woodDark, seat.x, 0.82, seat.z + 0.25);
    for (const [dx, dz] of [[-0.2, -0.2], [0.2, -0.2], [-0.2, 0.2], [0.2, 0.2]]) {
      addBox(scene, 0.07, 0.46, 0.07, COLORS.woodDark, seat.x + dx, 0.23, seat.z + dz);
    }
  }
  addHitbox(scene, ACTION.WORK, study.id, {
    w: 2.2,
    h: 1.45,
    d: 1.55,
    x: study.desk.x,
    y: 0.72,
    z: study.desk.z + 0.85
  });
  const workLabel = addWorldLabel("工作", study.desk.x, 1.3, 2.85, "action");
  workLabelViews.push({ id: study.id, el: workLabel });
  for (let i = 0; i < 4; i += 1) {
    addBox(scene, 0.28, 0.34, 0.18, [COLORS.rose, COLORS.sage, COLORS.honey, COLORS.paper][i], side * 7.2 - 0.65 + i * 0.4, 0.95, 1.18);
  }
  addWorldLabel(side < 0 ? "书房 A" : "书房 B", side * 7.0, 2.0, 2.6, "room");
}

function buildCabinet(scene, addBox, addHitbox, addWorldLabel, x, z) {
  const cabinet = addBox(scene, 1.0, 1.8, 0.55, COLORS.woodDark, x, 0.9, z);
  addBox(scene, 0.92, 1.55, 0.05, COLORS.wood, x, 0.95, z - 0.3);
  addBox(scene, 0.08, 0.08, 0.06, COLORS.brass, x + 0.35, 0.95, z - 0.34);
  addBox(scene, 0.08, 0.08, 0.06, COLORS.brass, x - 0.35, 0.95, z - 0.34);
  addWorldLabel("储物柜", x, 1.95, z, "room");
  addHitbox(scene, ACTION.INSPECT, "storage", {
    w: 1.15,
    h: 1.9,
    d: 0.7,
    x,
    y: 0.9,
    z
  });
  return cabinet;
}
