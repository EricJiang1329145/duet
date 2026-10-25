import { ACTION, COLORS } from "../config.js";

/**
 * A small, shared flower slope. It deliberately reuses the indoor Three.Scene
 * like the other interior rooms, so the game still has only two physical
 * scenes. The two daily nodes are the first warehouse-facing activity.
 */
export function buildMeadowScene(kit) {
  const {
    scene,
    addBox,
    addCylinder,
    addGroup,
    addHitbox,
    addWorldLabel,
    markWalkSurface
  } = kit;

  addBox(scene, 13, 0.16, 8.6, COLORS.earth, 0, -0.08, 0);
  const floor = addBox(scene, 12.6, 0.05, 8.2, COLORS.grass, 0, 0, 0);
  markWalkSurface(floor);
  addBox(scene, 4.6, 0.025, 1.0, COLORS.path, 0, 0.035, 2.3);
  addBox(scene, 1.2, 0.025, 4.6, COLORS.pathAlt, 0, 0.037, 0.1);

  // Fence posts keep the slope visually bounded like the main garden.
  for (const x of [-5.9, -2.9, 0, 2.9, 5.9]) {
    addBox(scene, 0.08, 0.58, 0.08, COLORS.woodDeep, x, 0.3, -3.7);
    addBox(scene, 0.08, 0.58, 0.08, COLORS.woodDeep, x, 0.3, 3.7);
  }
  for (const z of [-3.7, -1.1, 1.6, 3.7]) {
    addBox(scene, 0.08, 0.58, 0.08, COLORS.woodDeep, -6.1, 0.3, z);
    addBox(scene, 0.08, 0.58, 0.08, COLORS.woodDeep, 6.1, 0.3, z);
  }

  // Flower patch.
  const flowers = addGroup(scene, -2.3, 0, 0.4);
  addBox(flowers, 2.1, 0.08, 1.6, COLORS.soil, 0, 0.04, 0);
  for (let i = 0; i < 11; i += 1) {
    const x = -0.8 + ((i * 37) % 11) / 11 * 1.6;
    const z = -0.55 + ((i * 53) % 11) / 11 * 1.1;
    const stem = COLORS.sageDark;
    addCylinder(flowers, 0.025, 0.025, 0.38, 6, stem, x, 0.25, z);
    const petal = ["#e69aa9", "#f1c2a1", "#f4df9a", "#c6a3d6"][i % 4];
    addBox(flowers, 0.16, 0.08, 0.16, petal, x, 0.48, z);
    addBox(flowers, 0.06, 0.06, 0.06, "#fff1b8", x, 0.53, z);
  }
  addWorldLabel("野花丛 · 每天采集", -2.3, 1.1, 0.4, "action");
  addHitbox(scene, ACTION.COLLECT_RESOURCE, "meadow_flowers", {
    w: 2.3,
    h: 1.4,
    d: 1.9,
    x: -2.3,
    y: 0.7,
    z: 0.4
  });

  // Beehive on a little stand.
  const hive = addGroup(scene, 2.2, 0, 0.2);
  addBox(hive, 0.16, 0.45, 0.16, COLORS.woodDeep, 0, 0.22, 0);
  addBox(hive, 0.9, 0.1, 0.9, COLORS.wood, 0, 0.48, 0);
  addBox(hive, 0.72, 0.62, 0.72, "#e6ad55", 0, 0.83, 0);
  addBox(hive, 0.76, 0.08, 0.76, "#f1c875", 0, 0.95, 0);
  addBox(hive, 0.16, 0.12, 0.06, "#6b4c32", 0, 0.65, 0.37);
  addBox(hive, 0.1, 0.1, 0.1, "#f4df9a", -0.55, 1.05, 0.2);
  addBox(hive, 0.08, 0.08, 0.08, "#f4df9a", 0.55, 0.9, -0.25);
  addWorldLabel("蜂巢 · 每天采集", 2.2, 1.4, 0.2, "action");
  addHitbox(scene, ACTION.COLLECT_RESOURCE, "meadow_hive", {
    w: 1.25,
    h: 1.55,
    d: 1.15,
    x: 2.2,
    y: 0.78,
    z: 0.2
  });

  // A two-person bench makes the shared nature of the slope visible.
  const bench = addGroup(scene, 0, 0, -1.7);
  addBox(bench, 2.3, 0.16, 0.58, COLORS.wood, 0, 0.48, 0);
  addBox(bench, 2.3, 0.42, 0.12, COLORS.woodDark, 0, 0.7, -0.25);
  addBox(bench, 0.12, 0.48, 0.5, COLORS.woodDeep, -0.92, 0.25, 0);
  addBox(bench, 0.12, 0.48, 0.5, COLORS.woodDeep, 0.92, 0.25, 0);
  addWorldLabel("长椅", 0, 1.15, -1.7, "room");

  // Exit back to the west garden path.
  addBox(scene, 1.0, 1.7, 0.08, COLORS.door, 0, 0.86, 3.35);
  addBox(scene, 0.84, 0.05, 0.09, COLORS.doorLine, 0, 1.45, 3.4);
  addBox(scene, 0.06, 0.06, 0.06, COLORS.brass, 0.3, 0.88, 3.42);
  addWorldLabel("回小院", 1.1, 1.9, 3.18, "action");
  addHitbox(scene, ACTION.EXIT_MEADOW, "meadow_exit", {
    w: 1.2,
    h: 1.8,
    d: 0.28,
    x: 0,
    y: 0.85,
    z: 3.22
  });

  addWorldLabel("花间坡", 0, 2.3, 0, "room");
}
