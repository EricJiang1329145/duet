import {
  ACTION,
  COLORS,
  FIELD_GRID,
  GREENHOUSE_PLOTS,
  HOME_PLOT_IDS,
  PLAYGROUND,
  SCENE_UNLOCKS
} from "../config.js";
import { buildPlotField } from "./plotField.js";
import {
  buildBush,
  buildGreenhouse,
  buildSeesaw,
  buildSwing,
  buildTree
} from "./props.js";
import { buildSpirit } from "./spirit.js";
import { buildWeatherEffects } from "./weather.js";

/**
 * One large outdoor map: villa, twelve beds, greenhouse, pond, well, shed,
 * compost and the playground. The camera follows the player, so the map can be
 * much larger than one screen without invisible camera walls.
 */
export function buildOutdoorScene(kit) {
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

  // A much larger low meadow sits under the raised island. It fills the
  // camera view when the player walks to the fence, so the scene never ends in
  // a hard diagonal edge, while the fence still marks the walkable boundary.
  addBox(scene, 84, 0.12, 64, COLORS.grassDark, 0, -0.23, 0);

  // Big grass island and a visible fence around the playable rectangle.
  const grass = addBox(scene, 26, 0.34, 20, COLORS.grass, 0, -0.17, 0);
  markWalkSurface(grass);
  addBox(scene, 26, 0.72, 20, COLORS.earth, 0, -0.7, 0);
  addBox(scene, 26.2, 0.08, 0.8, COLORS.earthDark, 0, -1.0, 0);

  addPlane(scene, 19, 4.2, COLORS.grassLight, 1.0, 0.012, 3.0, {
    materialOptions: { transparent: true, opacity: 0.24 }
  });
  addPlane(scene, 8.5, 2.8, COLORS.grassDark, -8.2, 0.011, -0.6, {
    materialOptions: { transparent: true, opacity: 0.13 }
  });

  buildFence(scene, addBox);

  // Stone path from the villa door to the farm and around the pond.
  const path = [
    [0, -1.3, 0.02, 1.9],
    [0, 0.2, 0.03, 0.6],
    [0.1, 1.25, 0.0, 0.8],
    [-0.2, 7.2, -0.02, 1.4]
  ];
  for (let i = 0; i < path.length; i += 1) {
    const [x, z, ry, rz] = path[i];
    addBox(scene, 1.15, 0.03, 0.62, i % 2 ? COLORS.pathAlt : COLORS.path, x, 0.018, z, {
      ry,
      rz
    });
  }
  addBox(scene, 7.0, 0.03, 0.55, COLORS.pathAlt, -2.0, 0.018, 0.0, { ry: 0.02 });
  addBox(scene, 0.55, 0.03, 4.0, COLORS.path, 5.0, 0.018, 2.7, { ry: -0.04 });

  buildVilla(kit);
  buildPlotField(kit, {
    parent: scene,
    grid: FIELD_GRID,
    ids: HOME_PLOT_IDS,
    indexOffset: 0
  });

  // Well, shed and compost are the working corners of the big garden.
  buildWell(scene, addGroup, addBox, addCylinder, addHitbox, addWorldLabel);
  buildShed(scene, addGroup, addBox, addHitbox, addWorldLabel);
  buildCompost(scene, addGroup, addBox, addHitbox, addWorldLabel);
  buildPond(scene, addBox, addPlane, addHitbox, addWorldLabel);

  // Trees frame the map without creating invisible collision.
  buildTree(scene, -10.7, -3.2, 0.9);
  buildTree(scene, -10.9, 3.4, 0.78);
  buildTree(scene, 10.8, -2.2, 0.85);
  buildTree(scene, 9.9, 8.2, 0.7);
  buildBush(scene, -7.2, -1.3, 0.8);
  buildBush(scene, -7.0, 6.0, 0.65);
  buildBush(scene, 6.4, -1.4, 0.72);
  buildBush(scene, -9.7, 7.4, 0.55);
  buildBush(scene, 2.3, 8.5, 0.6);

  // Playground.
  const swing = buildSwing(scene, PLAYGROUND.swing.pivot);
  swing.labelEl = addWorldLabel(
    "秋千",
    PLAYGROUND.swing.pivot.x - 1.15,
    1.55,
    PLAYGROUND.swing.pivot.y,
    "action"
  );
  registerProp("swing", swing);
  addHitbox(scene, ACTION.SIT_SWING, "swing", {
    w: 1.15,
    h: 1.35,
    d: 1.05,
    x: PLAYGROUND.swing.pivot.x,
    y: 0.72,
    z: PLAYGROUND.swing.pivot.y
  });

  const spirit = buildSpirit(scene, addGroup, addBox, addCylinder, addHitbox);
  spirit.labelEl = addWorldLabel(
    "团子",
    spirit.position.x,
    1.28,
    spirit.position.z,
    "room"
  );
  registerProp("spirit", spirit);
  registerProp("weather", buildWeatherEffects(scene, addGroup, addBox));
  registerProp("meadowGate", buildMeadowGate(
    scene,
    addGroup,
    addBox,
    addHitbox,
    addWorldLabel
  ));
  registerProp("dockGate", buildDockGate(
    scene,
    addGroup,
    addBox,
    addHitbox,
    addWorldLabel
  ));
  registerProp("orchardGate", buildOrchardGate(
    scene,
    addGroup,
    addBox,
    addHitbox,
    addWorldLabel
  ));
  registerProp("springGate", buildSpringGate(
    scene,
    addGroup,
    addBox,
    addHitbox,
    addWorldLabel
  ));

  const seesaw = buildSeesaw(scene, PLAYGROUND.seesaw);
  seesaw.labelEl = addWorldLabel(
    "跷跷板",
    PLAYGROUND.seesaw.pivot.x + 1.15,
    1.35,
    PLAYGROUND.seesaw.pivot.y,
    "action"
  );
  registerProp("seesaw", seesaw);
  for (const end of PLAYGROUND.seesaw.ends) {
    addHitbox(scene, ACTION.SIT_SEESAW, `seesaw_${end.side}`, {
      w: 0.72,
      h: 0.9,
      d: 0.66,
      x: end.x,
      y: 0.5,
      z: end.y
    });
  }

  // Greenhouse over the two premium beds (11/12).
  const centers = GREENHOUSE_PLOTS.map((id) => {
    const index = HOME_PLOT_IDS.indexOf(id);
    const col = index % FIELD_GRID.columns;
    const row = Math.floor(index / FIELD_GRID.columns);
    return {
      x: FIELD_GRID.startX + col * FIELD_GRID.stepX,
      z: FIELD_GRID.startZ + row * FIELD_GRID.stepZ
    };
  });
  const greenhouseX = (centers[0].x + centers[1].x) / 2;
  const greenhouseZ = centers[0].z;
  const greenhouseWidth =
    Math.abs(centers[1].x - centers[0].x) + FIELD_GRID.size + 0.5;
  const greenhouseDepth = FIELD_GRID.size + 0.5;
  const greenhouse = buildGreenhouse(scene, {
    x: greenhouseX,
    z: greenhouseZ,
    width: greenhouseWidth,
    depth: greenhouseDepth,
    height: 1.25
  });
  greenhouse.visible = false;
  addBox(greenhouse, 0.92, 1.15, 0.07, COLORS.door, 0, 0.6, greenhouseDepth / 2 + 0.035);
  addBox(greenhouse, 0.82, 0.05, 0.08, COLORS.doorLine, 0, 1.12, greenhouseDepth / 2 + 0.08);
  addBox(greenhouse, 0.05, 0.05, 0.05, COLORS.brass, 0.28, 0.62, greenhouseDepth / 2 + 0.09);
  addHitbox(greenhouse, ACTION.ENTER_GREENHOUSE, "greenhouse_enter", {
    w: 1.15,
    h: 1.5,
    d: 0.25,
    x: 0,
    y: 0.72,
    z: greenhouseDepth / 2 + 0.03
  });
  const greenhouseLabel = addWorldLabel(
    "温室",
    greenhouseX,
    1.8,
    greenhouseZ + greenhouseDepth / 2 + 0.12,
    "room"
  );
  greenhouseLabel.style.display = "none";

  // Before it is built, a small sign marks the future greenhouse site. This
  // makes the purchase discoverable without covering the two farmable beds.
  const greenhouseSite = addGroup(
    scene,
    greenhouseX,
    0,
    greenhouseZ + greenhouseDepth / 2 + 0.55
  );
  addBox(greenhouseSite, 0.07, 0.85, 0.07, COLORS.woodDeep, 0, 0.42, 0);
  addBox(greenhouseSite, 0.82, 0.36, 0.06, COLORS.wood, 0, 0.78, 0.01);
  addBox(greenhouseSite, 0.72, 0.05, 0.07, COLORS.paper, 0, 0.84, 0.045);
  const greenhouseSiteLabel = addWorldLabel(
    "温室选址 · 搭温室",
    greenhouseX,
    1.35,
    greenhouseZ + greenhouseDepth / 2 + 0.55,
    "room"
  );
  addHitbox(greenhouseSite, ACTION.OPEN_SHOP, "greenhouse_site", {
    w: 0.95,
    h: 1.15,
    d: 0.3,
    x: 0,
    y: 0.62,
    z: 0.04
  });
  registerProp("greenhouse", {
    group: greenhouse,
    labelEl: greenhouseLabel,
    site: greenhouseSite,
    siteLabel: greenhouseSiteLabel
  });
}

function buildFence(scene, addBox) {
  const color = COLORS.woodDark;
  const minX = -12.4;
  const maxX = 12.4;
  const minZ = -9.7;
  const maxZ = 9.7;
  for (let x = minX; x <= maxX + 0.01; x += 1.75) {
    addBox(scene, 0.12, 0.8, 0.12, color, x, 0.4, minZ);
    addBox(scene, 0.12, 0.8, 0.12, color, x, 0.4, maxZ);
  }
  for (let z = minZ; z <= maxZ + 0.01; z += 1.65) {
    addBox(scene, 0.12, 0.8, 0.12, color, minX, 0.4, z);
    addBox(scene, 0.12, 0.8, 0.12, color, maxX, 0.4, z);
  }
  for (const y of [0.28, 0.64]) {
    addBox(scene, maxX - minX, 0.08, 0.07, COLORS.wood, 0, y, minZ);
    addBox(scene, maxX - minX, 0.08, 0.07, COLORS.wood, 0, y, maxZ);
    addBox(scene, 0.07, 0.08, maxZ - minZ, COLORS.wood, minX, y, 0);
    addBox(scene, 0.07, 0.08, maxZ - minZ, COLORS.wood, maxX, y, 0);
  }
}

function buildVilla(kit) {
  const {
    scene,
    addBox,
    addCylinder,
    addGroup,
    addHitbox,
    addWorldLabel,
    registerDoor
  } = kit;
  const house = addGroup(scene, 0, 0, -5.4);

  // Main two-storey block. Front face is south (+Z local 3.4).
  addBox(house, 10.4, 0.18, 7.2, COLORS.path, 0, 0.09, 0);
  addBox(house, 10.0, 2.9, 6.8, COLORS.house, 0, 1.45, 0);
  addBox(house, 10.1, 0.16, 6.9, COLORS.houseTrim, 0, 2.95, 0);
  addBox(house, 9.2, 2.35, 6.0, COLORS.houseSide, 0, 4.1, 0);
  addBox(house, 9.3, 0.16, 6.1, COLORS.houseTrim, 0, 5.3, 0);

  // A real eave connects the rectangular upper floor to the hipped roof. Keep
  // the pyramid base just inside this slab so there is no floating gap or
  // paper-thin edge where the two shapes meet.
  addBox(house, 10.3, 0.16, 7.1, COLORS.roof, 0, 5.35, 0);
  addBox(house, 10.05, 0.07, 6.85, COLORS.roofTop, 0, 5.445, 0);

  const roof = addCylinder(house, 0.18, 6.4, 1.8, 4, COLORS.roof, 0, 6.34, 0, {
    ry: Math.PI / 4
  });
  roof.scale.set(1.1, 1, 0.78);
  addBox(house, 0.42, 1.25, 0.42, COLORS.houseSide, 3.1, 6.65, -1.0);
  addBox(house, 0.55, 0.14, 0.55, COLORS.roofTop, 3.1, 7.35, -1.0);

  // Facade: lower windows and the front door.
  for (const x of [-3.1, 3.1]) {
    addBox(house, 1.65, 1.25, 0.08, COLORS.houseTrim, x, 1.65, 3.43);
    addBox(house, 1.35, 0.98, 0.045, COLORS.window, x, 1.65, 3.48);
    addBox(house, 0.05, 0.98, 0.05, COLORS.houseTrim, x, 1.65, 3.51);
    addBox(house, 1.65, 0.06, 0.13, COLORS.houseTrim, x, 1.16, 3.46);
  }

  // Upper windows and balcony.
  for (const x of [-3.2, 0, 3.2]) {
    addBox(house, 1.35, 1.05, 0.08, COLORS.houseTrim, x, 4.25, 3.03);
    addBox(house, 1.1, 0.82, 0.045, COLORS.window, x, 4.25, 3.08);
    addBox(house, 0.05, 0.82, 0.05, COLORS.houseTrim, x, 4.25, 3.11);
  }
  addBox(house, 5.7, 0.12, 1.0, COLORS.roofTop, 0, 3.22, 3.5);
  for (const x of [-2.6, -1.3, 0, 1.3, 2.6]) {
    addBox(house, 0.07, 0.55, 0.07, COLORS.houseTrim, x, 3.56, 3.96);
  }
  addBox(house, 5.5, 0.07, 0.07, COLORS.houseTrim, 0, 3.8, 3.96);

  // Side wings: a west service wing and an east glass sunroom.
  addBox(house, 2.9, 2.5, 4.2, COLORS.houseSide, -6.4, 1.25, -0.1);
  addBox(house, 2.95, 0.14, 4.25, COLORS.houseTrim, -6.4, 2.55, -0.1);
  addBox(house, 3.2, 0.12, 4.5, COLORS.roof, -6.4, 2.57, -0.1);
  const westRoof = addCylinder(house, 0.16, 2.4, 0.9, 4, COLORS.roof, -6.4, 3.08, -0.1, {
    ry: Math.PI / 4
  });
  westRoof.scale.set(0.94, 1, 1.32);
  addBox(house, 1.1, 0.9, 0.07, COLORS.houseTrim, -6.4, 1.55, 2.06);
  addBox(house, 0.88, 0.68, 0.045, COLORS.window, -6.4, 1.55, 2.1);

  addBox(house, 2.9, 2.25, 4.2, COLORS.window, 6.4, 1.12, -0.1);
  addBox(house, 2.96, 0.12, 4.26, COLORS.houseTrim, 6.4, 2.3, -0.1);
  addBox(house, 3.2, 0.12, 4.5, COLORS.roof, 6.4, 2.33, -0.1);
  const eastRoof = addCylinder(house, 0.16, 2.4, 0.75, 4, COLORS.roof, 6.4, 2.78, -0.1, {
    ry: Math.PI / 4
  });
  eastRoof.scale.set(0.94, 1, 1.32);
  for (const z of [-1.6, -0.1, 1.4]) {
    addBox(house, 0.07, 1.7, 0.07, COLORS.houseTrim, 7.88, 1.1, z);
  }

  // Front door and porch. The door leaf is a hinge group for the transition.
  addBox(house, 1.7, 2.25, 0.14, COLORS.houseTrim, 0, 1.2, 3.44);
  const doorHinge = addGroup(house, -0.66, 0, 3.54);
  addBox(doorHinge, 1.32, 2.0, 0.1, COLORS.door, 0.66, 1.12, 0);
  addBox(doorHinge, 0.82, 0.04, 0.03, COLORS.doorLine, 0.66, 1.7, 0.06);
  addBox(doorHinge, 0.82, 0.04, 0.03, COLORS.doorLine, 0.66, 1.2, 0.06);
  addCylinder(doorHinge, 0.045, 0.045, 0.08, 8, COLORS.brass, 1.02, 1.08, 0.08, {
    rx: Math.PI / 2
  });
  registerDoor(doorHinge, { openAngle: -1.4 });

  addBox(house, 4.4, 0.16, 1.6, COLORS.roofTop, 0, 2.95, 4.2);
  for (const x of [-1.9, 1.9]) {
    addCylinder(house, 0.08, 0.1, 2.7, 8, COLORS.houseTrim, x, 1.35, 4.55);
  }
  addBox(house, 4.0, 0.08, 0.55, COLORS.path, 0, 0.04, 4.45);
  addBox(house, 3.1, 0.06, 0.45, COLORS.pathAlt, 0, 0.04, 4.95);

  addHitbox(house, ACTION.ENTER_HOUSE, "door_outdoor", {
    w: 2.2,
    h: 3.2,
    d: 1.0,
    x: 0,
    y: 1.6,
    z: 3.65
  });
  addWorldLabel("进屋", 0, 3.4, -1.9, "action");
}

function buildMeadowGate(
  scene,
  addGroup,
  addBox,
  addHitbox,
  addWorldLabel
) {
  const gate = addGroup(scene, -10.85, 0, 1.2);
  addBox(gate, 0.12, 1.7, 0.12, COLORS.woodDeep, -0.55, 0.85, 0);
  addBox(gate, 0.12, 1.7, 0.12, COLORS.woodDeep, 0.55, 0.85, 0);
  addBox(gate, 1.25, 0.14, 0.16, COLORS.wood, 0, 1.62, 0);
  addBox(gate, 0.48, 0.5, 0.06, COLORS.paper, 0, 1.25, 0.08);
  const cost = SCENE_UNLOCKS.meadow.cost;
  const labelEl = addWorldLabel(
    `花间坡 · ${cost} 金币`,
    -10.85,
    1.95,
    1.2,
    "action"
  );
  addHitbox(gate, ACTION.ENTER_MEADOW, "meadow_gate", {
    w: 1.35,
    h: 1.9,
    d: 0.55,
    x: 0,
    y: 0.95,
    z: 0
  });
  return {
    group: gate,
    labelEl,
    setUnlocked(unlocked) {
      labelEl.textContent = unlocked ? "花间坡" : `花间坡 · ${cost} 金币`;
      gate.userData.unlocked = Boolean(unlocked);
    }
  };
}

function buildDockGate(
  scene,
  addGroup,
  addBox,
  addHitbox,
  addWorldLabel
) {
  const gate = addGroup(scene, -4.5, 0, 8.9);
  addBox(gate, 0.12, 1.7, 0.12, COLORS.woodDeep, -0.7, 0.85, 0);
  addBox(gate, 0.12, 1.7, 0.12, COLORS.woodDeep, 0.7, 0.85, 0);
  addBox(gate, 1.55, 0.14, 0.16, COLORS.wood, 0, 1.62, 0);
  addBox(gate, 0.52, 0.5, 0.06, COLORS.paper, 0, 1.24, 0.08);
  const cost = SCENE_UNLOCKS.dock.cost;
  const labelEl = addWorldLabel(
    `溪畔码头 · ${cost} 金币`,
    -4.5,
    1.95,
    8.9,
    "action"
  );
  addHitbox(gate, ACTION.ENTER_DOCK, "dock_gate", {
    w: 1.55,
    h: 1.9,
    d: 0.55,
    x: 0,
    y: 0.95,
    z: 0
  });
  return {
    group: gate,
    labelEl,
    setUnlocked(unlocked) {
      labelEl.textContent = unlocked ? "溪畔码头" : `溪畔码头 · ${cost} 金币`;
      gate.userData.unlocked = Boolean(unlocked);
    }
  };
}

function buildOrchardGate(
  scene,
  addGroup,
  addBox,
  addHitbox,
  addWorldLabel
) {
  const gate = addGroup(scene, 10.85, 0, 1.2);
  addBox(gate, 0.12, 1.7, 0.12, COLORS.woodDeep, -0.7, 0.85, 0);
  addBox(gate, 0.12, 1.7, 0.12, COLORS.woodDeep, 0.7, 0.85, 0);
  addBox(gate, 1.55, 0.14, 0.16, COLORS.wood, 0, 1.62, 0);
  addBox(gate, 0.52, 0.5, 0.06, COLORS.paper, 0, 1.24, 0.08);
  const cost = SCENE_UNLOCKS.orchard.cost;
  const labelEl = addWorldLabel(
    `山坡果园 · ${cost} 金币`,
    10.85,
    1.95,
    1.2,
    "action"
  );
  addHitbox(gate, ACTION.ENTER_ORCHARD, "orchard_gate", {
    w: 1.55,
    h: 1.9,
    d: 0.55,
    x: 0,
    y: 0.95,
    z: 0
  });
  return {
    group: gate,
    labelEl,
    setUnlocked(unlocked) {
      labelEl.textContent = unlocked ? "山坡果园" : `山坡果园 · ${cost} 金币`;
      gate.userData.unlocked = Boolean(unlocked);
    }
  };
}

function buildSpringGate(
  scene,
  addGroup,
  addBox,
  addHitbox,
  addWorldLabel
) {
  const gate = addGroup(scene, 10.4, 0, -8.7);
  addBox(gate, 0.12, 1.7, 0.12, COLORS.woodDeep, -0.7, 0.85, 0);
  addBox(gate, 0.12, 1.7, 0.12, COLORS.woodDeep, 0.7, 0.85, 0);
  addBox(gate, 1.55, 0.14, 0.16, COLORS.wood, 0, 1.62, 0);
  addBox(gate, 0.52, 0.5, 0.06, COLORS.paper, 0, 1.24, 0.08);
  const cost = SCENE_UNLOCKS.spring.cost;
  const labelEl = addWorldLabel(
    `雾汤温泉 · ${cost} 金币`,
    10.4,
    1.95,
    -8.7,
    "action"
  );
  addHitbox(gate, ACTION.ENTER_SPRING, "spring_gate", {
    w: 1.55,
    h: 1.9,
    d: 0.55,
    x: 0,
    y: 0.95,
    z: 0
  });
  return {
    group: gate,
    labelEl,
    setUnlocked(unlocked) {
      labelEl.textContent = unlocked ? "雾汤温泉" : `雾汤温泉 · ${cost} 金币`;
      gate.userData.unlocked = Boolean(unlocked);
    }
  };
}

function buildWell(
  scene,
  addGroup,
  addBox,
  addCylinder,
  addHitbox,
  addWorldLabel
) {
  const well = addGroup(scene, -8.2, 0, 1.5);
  addCylinder(well, 0.62, 0.7, 0.52, 10, COLORS.concreteDark, 0, 0.26, 0);
  addCylinder(well, 0.5, 0.58, 0.1, 10, COLORS.ink, 0, 0.52, 0);
  addCylinder(well, 0.06, 0.07, 1.45, 6, COLORS.woodDark, -0.48, 0.72, 0);
  addCylinder(well, 0.06, 0.07, 1.45, 6, COLORS.woodDark, 0.48, 0.72, 0);
  addBox(well, 1.2, 0.08, 1.0, COLORS.roof, 0, 1.45, 0, { ry: Math.PI / 4 });
  addCylinder(well, 0.07, 0.07, 0.8, 8, COLORS.wood, 0, 1.07, 0, {
    rz: Math.PI / 2
  });
  addWorldLabel("水井", -8.2, 1.62, 1.5, "room");
  addHitbox(well, ACTION.INSPECT, "well", {
    w: 1.5,
    h: 1.7,
    d: 1.3,
    x: 0,
    y: 0.8,
    z: 0
  });
}

function buildShed(scene, addGroup, addBox, addHitbox, addWorldLabel) {
  const shed = addGroup(scene, 8.6, 0, 1.2);
  addBox(shed, 1.9, 1.8, 1.55, COLORS.wood, 0, 0.9, 0);
  addBox(shed, 2.05, 0.13, 1.7, COLORS.roofTop, 0, 1.85, 0, { rz: 0.02 });
  addBox(shed, 0.7, 1.25, 0.06, COLORS.door, 0, 0.7, 0.8);
  addBox(shed, 0.7, 0.05, 0.07, COLORS.doorLine, 0, 1.08, 0.83);
  addBox(shed, 0.06, 0.06, 0.04, COLORS.brass, 0.24, 0.66, 0.84);
  addBox(shed, 0.42, 0.1, 0.04, COLORS.woodDeep, -0.42, 1.5, 0.82, {
    rz: 0.05
  });
  addWorldLabel("工具棚", 8.6, 2.05, 1.2, "room");
  addHitbox(shed, ACTION.OPEN_SHOP, "shed", {
    w: 2.1,
    h: 2.0,
    d: 1.8,
    x: 0,
    y: 0.9,
    z: 0
  });
}

function buildCompost(scene, addGroup, addBox, addHitbox, addWorldLabel) {
  const compost = addGroup(scene, -8.2, 0, 4.8);
  addBox(compost, 1.25, 0.75, 1.0, COLORS.woodDark, 0, 0.38, 0);
  addBox(compost, 1.08, 0.1, 0.84, COLORS.soil, 0, 0.72, 0);
  addBox(compost, 0.42, 0.16, 0.34, COLORS.soil, -0.25, 0.78, 0.08, { ry: 0.2 });
  addBox(compost, 0.34, 0.12, 0.3, COLORS.weed, 0.25, 0.77, -0.1, { ry: -0.3 });
  addWorldLabel("堆肥", -8.2, 1.18, 4.8, "room");
  addHitbox(compost, ACTION.INSPECT, "compost", {
    w: 1.4,
    h: 1.0,
    d: 1.1,
    x: 0,
    y: 0.45,
    z: 0
  });
}

function buildPond(scene, addBox, addPlane, addHitbox, addWorldLabel) {
  // Rectangular pond so the visible water/stone rim and the collision rect
  // match exactly (no invisible corners at the pond edge).
  addBox(scene, 4.2, 0.04, 3.4, COLORS.windowInset, 8.5, 0.02, 5.7);
  addBox(scene, 4.0, 0.02, 3.2, COLORS.window, 8.5, 0.05, 5.7);
  for (const [w, d, x, z] of [
    [4.6, 0.22, 8.5, 3.9],
    [4.6, 0.22, 8.5, 7.5],
    [0.22, 3.8, 6.3, 5.7],
    [0.22, 3.8, 10.7, 5.7]
  ]) {
    addBox(scene, w, 0.16, d, COLORS.concrete, x, 0.08, z);
  }
  addPlane(scene, 1.0, 0.4, COLORS.glass, 7.8, 0.08, 5.1, {
    ry: 0.3,
    materialOptions: { transparent: true, opacity: 0.4 }
  });
  addWorldLabel("池塘", 8.5, 0.45, 5.7, "room");
  addHitbox(scene, ACTION.INSPECT, "pond", {
    w: 4.0,
    h: 0.2,
    d: 3.2,
    x: 8.5,
    y: 0.08,
    z: 5.7
  });
}
