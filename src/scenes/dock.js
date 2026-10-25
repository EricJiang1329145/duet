import { ACTION, COLORS } from "../config.js";

/**
 * The river dock is a second small extra scene. Its two nodes are a fishing
 * creel and a shell pile; both feed the shared warehouse.
 */
export function buildDockScene(kit) {
  const {
    scene,
    addBox,
    addPlane,
    addGroup,
    addHitbox,
    addWorldLabel,
    markWalkSurface
  } = kit;

  addBox(scene, 13, 0.16, 8.6, COLORS.earth, 0, -0.08, 0);
  const water = addBox(scene, 12.6, 0.05, 8.2, "#9fc4c9", 0, 0, 0);
  markWalkSurface(water);
  addBox(scene, 12.8, 0.04, 0.7, "#b7d3d0", 0, 0.03, -3.55);
  addBox(scene, 3.8, 0.07, 5.0, COLORS.wood, 0, 0.085, 0.2);
  for (let i = 0; i < 6; i += 1) {
    addBox(scene, 3.9, 0.02, 0.08, COLORS.woodDark, 0, 0.12, -2.1 + i * 0.9);
  }
  addBox(scene, 0.16, 0.5, 0.16, COLORS.woodDeep, -1.75, 0.3, -1.9);
  addBox(scene, 0.16, 0.5, 0.16, COLORS.woodDeep, 1.75, 0.3, -1.9);
  addBox(scene, 3.6, 0.12, 0.22, COLORS.woodDark, 0, 0.55, -1.9);

  // Little rowboat moored beside the planks.
  const boat = addGroup(scene, -2.7, 0, 0.1);
  addBox(boat, 2.0, 0.22, 0.7, COLORS.woodDark, 0, 0.15, 0);
  addBox(boat, 1.5, 0.1, 0.42, COLORS.wood, 0, 0.29, 0);
  addBox(boat, 0.12, 0.45, 0.12, COLORS.wood, -0.85, 0.35, 0);
  addBox(boat, 0.12, 0.45, 0.12, COLORS.wood, 0.85, 0.35, 0);
  addWorldLabel("小船", -2.7, 1.0, 0.1, "room");

  addBox(scene, 0.8, 0.35, 0.6, COLORS.woodDeep, 0.2, 0.3, 0.1);
  addBox(scene, 0.68, 0.08, 0.5, COLORS.soil, 0.2, 0.5, 0.1);
  addBox(scene, 0.16, 0.16, 0.16, "#7faec0", 0.2, 0.62, 0.1);
  addWorldLabel("鱼篓 · 每天采集", 0.2, 1.0, 0.1, "action");
  addHitbox(scene, ACTION.COLLECT_RESOURCE, "dock_fish", {
    w: 1.2,
    h: 1.2,
    d: 0.95,
    x: 0.2,
    y: 0.55,
    z: 0.1
  });

  const shells = addGroup(scene, 2.8, 0, 0.8);
  addBox(shells, 1.6, 0.1, 0.9, COLORS.sand ?? "#d8c6aa", 0, 0.05, 0);
  for (let i = 0; i < 7; i += 1) {
    const x = -0.55 + ((i * 31) % 11) / 11 * 1.1;
    const z = -0.25 + ((i * 17) % 7) / 7 * 0.5;
    addBox(shells, 0.22, 0.08, 0.16, i % 2 ? "#f0d3b3" : "#d9a98d", x, 0.12, z, {
      ry: i * 0.4
    });
  }
  addWorldLabel("贝壳堆 · 每天采集", 2.8, 0.95, 0.8, "action");
  addHitbox(scene, ACTION.COLLECT_RESOURCE, "dock_shells", {
    w: 1.9,
    h: 0.9,
    d: 1.2,
    x: 2.8,
    y: 0.45,
    z: 0.8
  });

  // Exit back to the south garden bridge.
  addBox(scene, 1.0, 1.7, 0.08, COLORS.door, 0, 0.86, 3.35);
  addBox(scene, 0.84, 0.05, 0.09, COLORS.doorLine, 0, 1.45, 3.4);
  addBox(scene, 0.06, 0.06, 0.06, COLORS.brass, 0.3, 0.88, 3.42);
  addWorldLabel("回小院", 1.1, 1.9, 3.18, "action");
  addHitbox(scene, ACTION.EXIT_DOCK, "dock_exit", {
    w: 1.2,
    h: 1.8,
    d: 0.28,
    x: 0,
    y: 0.85,
    z: 3.22
  });

  addWorldLabel("溪畔码头", 0, 2.3, 0, "room");
}
