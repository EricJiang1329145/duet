import {
  ACTION,
  COLORS,
  GREENHOUSE_PLOTS
} from "../config.js";
import { buildPlotField } from "./plotField.js";

/**
 * The greenhouse interior uses the existing 11/12 beds. When the greenhouse is
 * built those two beds move here, so the same persisted crops are visible and
 * tended inside instead of duplicating a second farm.
 */
export function buildGreenhouseScene(kit) {
  const {
    scene,
    addBox,
    addGroup,
    addHitbox,
    addWorldLabel,
    markWalkSurface
  } = kit;

  addBox(scene, 7.6, 0.18, 5.4, COLORS.earth, 0, -0.09, 0);
  const floor = addBox(scene, 7.3, 0.05, 5.0, COLORS.concrete, 0, 0.0, 0);
  markWalkSurface(floor);
  addBox(scene, 6.4, 0.025, 0.8, COLORS.path, 0, 0.035, 1.55);

  // Glass shell and pale frame.
  const width = 7.2;
  const depth = 5.0;
  const height = 2.2;
  const glass = {
    materialOptions: {
      transparent: true,
      opacity: 0.13,
      depthWrite: false
    }
  };
  for (const x of [-width / 2, width / 2]) {
    for (const z of [-depth / 2, depth / 2]) {
      addBox(scene, 0.08, height, 0.08, COLORS.glassEdge, x, height / 2, z);
    }
    addBox(scene, 0.035, height, depth, COLORS.glass, x, height / 2, 0, glass);
  }
  addBox(scene, width, height, 0.035, COLORS.glass, 0, height / 2, -depth / 2, glass);
  addBox(scene, width, height, 0.035, COLORS.glass, 0, height / 2, depth / 2, glass);
  addBox(scene, width, 0.04, depth, COLORS.glass, 0, height, 0, glass);
  for (const x of [-3.0, -1.0, 1.0, 3.0]) {
    addBox(scene, 0.07, 0.07, depth, COLORS.glassEdge, x, height, 0);
  }

  // Two raised beds are the existing field_11 / field_12 plots.
  buildPlotField(kit, {
    parent: scene,
    grid: {
      startX: -1.9,
      startZ: -0.1,
      stepX: 3.8,
      stepZ: 0,
      size: 2.0,
      columns: 2,
      rows: 1
    },
    ids: GREENHOUSE_PLOTS
  });

  // Potting bench, watering can and a little stack of pots.
  const bench = addGroup(scene, 0, 0, -1.95);
  addBox(bench, 2.4, 0.12, 0.46, COLORS.wood, 0, 0.62, 0);
  addBox(bench, 0.1, 0.6, 0.36, COLORS.woodDark, -0.92, 0.3, 0);
  addBox(bench, 0.1, 0.6, 0.36, COLORS.woodDark, 0.92, 0.3, 0);
  addBox(bench, 0.3, 0.24, 0.22, COLORS.glassEdge, -0.65, 0.8, 0);
  addBox(bench, 0.22, 0.3, 0.22, COLORS.plantPot, 0.35, 0.84, 0);
  addBox(bench, 0.18, 0.22, 0.18, COLORS.plantPot, 0.62, 0.78, 0);

  // Exit back to the garden.
  addBox(scene, 0.95, 1.55, 0.06, COLORS.door, 0, 0.8, depth / 2 + 0.01);
  addBox(scene, 0.82, 0.05, 0.07, COLORS.doorLine, 0, 1.4, depth / 2 + 0.06);
  addBox(scene, 0.05, 0.05, 0.05, COLORS.brass, 0.3, 0.82, depth / 2 + 0.07);
  addWorldLabel("出温室", 1.15, 1.72, depth / 2 - 0.12, "action");
  addHitbox(scene, ACTION.EXIT_GREENHOUSE, "greenhouse_exit", {
    w: 1.15,
    h: 1.7,
    d: 0.25,
    x: 0,
    y: 0.8,
    z: depth / 2 - 0.02
  });

  addWorldLabel("温室", 0, 2.25, 0, "room");
}
