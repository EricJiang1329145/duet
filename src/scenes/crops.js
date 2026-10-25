import { COLORS } from "../config.js";
import { getCropConfig } from "../game/crop.js";
import { addBox, addCylinder, addGroup } from "../render/geometry.js";

const SPOTS = [
  { x: -0.27, z: 0.16, lean: 0.14 },
  { x: 0.2, z: 0.22, lean: -0.11 },
  { x: 0.02, z: -0.24, lean: 0.19 }
];

function leaf(parent, x, y, z, color, options = {}) {
  return addBox(parent, 0.3, 0.055, 0.12, color, x, y, z, options);
}

/**
 * Build one growth-stage group for a crop type. The caller hides/shows these
 * groups as the derived stage changes; nothing here writes game state.
 */
export function buildCropStageGroup(plot, stage, plotIndex, cropType = "radish") {
  const crop = getCropConfig(cropType);
  const group = addGroup(plot, 0, 0, 0);
  group.visible = false;

  const spots = SPOTS.map((spot, index) => ({
    ...spot,
    lean: spot.lean + plotIndex * 0.01 + index * 0.005
  }));
  const stem = crop.stem ?? COLORS.cropStem;
  const leafColor = crop.leaf ?? COLORS.cropLeaf;
  const leafLight = crop.leafLight ?? COLORS.cropLeafLight;
  const fruit = crop.fruit ?? COLORS.radish;
  const fruitDark = crop.fruitDark ?? COLORS.radishDark;

  if (stage === "seeded") {
    addCylinder(group, 0.34, 0.42, 0.08, 10, COLORS.soilLine, 0, 0.27, 0);
    spots.forEach((spot, index) => {
      addBox(
        group,
        0.095,
        0.045,
        0.07,
        index === 1 ? COLORS.paperAlt : COLORS.cropSeed,
        spot.x * 0.72,
        0.328,
        spot.z * 0.72,
        { ry: plotIndex * 0.4 + index * 0.5 }
      );
    });
    addBox(group, 0.055, 0.03, 0.05, leafColor, 0.02, 0.35, -0.03, {
      ry: 0.5
    });
    return group;
  }

  if (stage === "sprout") {
    addCylinder(group, 0.3, 0.38, 0.065, 10, COLORS.soilLine, 0, 0.263, 0);
    spots.forEach((spot, index) => {
      addCylinder(
        group,
        0.018,
        0.028,
        0.22 + index * 0.035,
        5,
        stem,
        spot.x,
        0.36 + index * 0.014,
        spot.z,
        { rz: spot.lean }
      );
      leaf(
        group,
        spot.x + (index % 2 ? 0.06 : -0.06),
        0.5 + index * 0.018,
        spot.z,
        index % 2 ? leafColor : leafLight,
        { rz: index % 2 ? -0.38 : 0.32, ry: index * 0.4 }
      );
    });
    return group;
  }

  if (stage === "growing") {
    addCylinder(group, 0.3, 0.38, 0.065, 10, COLORS.soilLine, 0, 0.263, 0);
    spots.forEach((spot, index) => {
      addCylinder(
        group,
        0.022,
        0.034,
        0.42 + index * 0.04,
        5,
        stem,
        spot.x,
        0.46 + index * 0.018,
        spot.z,
        { rz: spot.lean }
      );
      leaf(
        group,
        spot.x + (index % 2 ? 0.08 : -0.08),
        0.64 + index * 0.026,
        spot.z,
        leafColor,
        { rz: index % 2 ? -0.42 : 0.35, ry: index * 0.5 }
      );
      leaf(
        group,
        spot.x + (index === 1 ? -0.08 : 0.08),
        0.78 + index * 0.018,
        spot.z + 0.02,
        leafLight,
        { rz: index === 1 ? 0.36 : -0.3, ry: -0.3 + index * 0.3 }
      );
    });
    return group;
  }

  // Ready stage: leafy tops plus a crop-specific fruit/root.
  addCylinder(group, 0.3, 0.4, 0.065, 10, COLORS.soilLine, 0, 0.263, 0);
  spots.forEach((spot, index) => {
    addCylinder(
      group,
      0.032,
      0.05,
      0.38 + index * 0.025,
      5,
      stem,
      spot.x,
      0.47 + index * 0.02,
      spot.z,
      { rz: spot.lean }
    );

    if (crop.shape === "cone") {
      addCylinder(
        group,
        0.12,
        0.03,
        0.26,
        6,
        index % 2 ? fruitDark : fruit,
        spot.x,
        0.37,
        spot.z,
        { rz: spot.lean * 0.4 }
      );
    } else if (crop.shape === "round") {
      addCylinder(
        group,
        0.09,
        0.09,
        0.14,
        6,
        index % 2 ? fruitDark : fruit,
        spot.x - 0.05,
        0.59 + index * 0.015,
        spot.z + 0.03
      );
      addCylinder(
        group,
        0.07,
        0.07,
        0.12,
        6,
        fruit,
        spot.x + 0.11,
        0.53 + index * 0.015,
        spot.z - 0.05
      );
    } else {
      addCylinder(
        group,
        0.1,
        0.065,
        0.18,
        6,
        index % 2 ? fruitDark : fruit,
        spot.x,
        0.36,
        spot.z,
        { rz: spot.lean * 0.35 }
      );
    }

    addBox(
      group,
      0.34,
      0.06,
      0.14,
      leafColor,
      spot.x + (index % 2 ? 0.1 : -0.1),
      0.69 + index * 0.025,
      spot.z,
      { rz: index === 1 ? 0.42 : -0.4, ry: index * 0.45 }
    );
    addBox(
      group,
      0.25,
      0.05,
      0.12,
      leafLight,
      spot.x + (index === 0 ? 0.08 : -0.08),
      0.83 + index * 0.02,
      spot.z + 0.02,
      { rz: index === 1 ? -0.36 : 0.3, ry: 0.4 - index * 0.25 }
    );
    addBox(
      group,
      0.17,
      0.045,
      0.1,
      stem,
      spot.x,
      0.93 + index * 0.016,
      spot.z,
      { rz: -0.15 + index * 0.2 }
    );
  });

  // A small floating honey diamond says "ready" without adding lights.
  addBox(group, 0.16, 0.16, 0.035, COLORS.honey, 0, 1.13, 0, {
    rz: Math.PI / 4,
    ry: Math.PI / 4
  });

  return group;
}

export function buildPlotSelectionFrame(plot, fieldSize) {
  const frame = addGroup(plot, 0, 0, 0);
  frame.visible = false;
  const edgeY = 0.29;
  const edgeThickness = 0.055;
  const edgeColor = COLORS.honey;
  const half = fieldSize / 2 + 0.055;

  addBox(frame, fieldSize + 0.13, 0.022, edgeThickness, edgeColor, 0, edgeY, -half);
  addBox(frame, fieldSize + 0.13, 0.022, edgeThickness, edgeColor, 0, edgeY, half);
  addBox(frame, edgeThickness, 0.022, fieldSize + 0.13, edgeColor, -half, edgeY, 0);
  addBox(frame, edgeThickness, 0.022, fieldSize + 0.13, edgeColor, half, edgeY, 0);

  return frame;
}

export function buildPlotHazardGroup(plot, kind) {
  const group = addGroup(plot, 0, 0, 0);
  group.visible = false;

  if (kind === "weeds") {
    for (let i = 0; i < 5; i += 1) {
      const x = -0.42 + i * 0.2;
      const z = -0.32 + (i % 3) * 0.28;
      addBox(group, 0.16, 0.22 + (i % 2) * 0.1, 0.06, COLORS.weed, x, 0.33, z, {
        ry: i * 0.8,
        rz: i % 2 ? 0.22 : -0.18
      });
      addBox(
        group,
        0.1,
        0.16,
        0.05,
        COLORS.weedDark,
        x + 0.06,
        0.3,
        z + 0.05,
        { ry: -i * 0.6, rz: i % 2 ? -0.26 : 0.2 }
      );
    }
    return group;
  }

  for (let i = 0; i < 4; i += 1) {
    const x = -0.3 + i * 0.22;
    const z = -0.18 + (i % 2) * 0.26;
    addBox(group, 0.09, 0.06, 0.12, COLORS.pest, x, 0.35, z, {
      ry: i * 0.6
    });
    addBox(group, 0.03, 0.03, 0.03, COLORS.pest, x - 0.04, 0.37, z + 0.04);
    addBox(group, 0.03, 0.03, 0.03, COLORS.pest, x + 0.04, 0.37, z + 0.04);
  }
  return group;
}

export function buildLockedOverlay(plot, fieldSize) {
  const group = addGroup(plot, 0, 0, 0);
  const half = fieldSize / 2;
  const edge = 0.06;
  // A low unclaimed border plus a few tufts reads as "not opened yet" with
  // far less visual noise than crossed planks.
  addBox(group, fieldSize, 0.05, edge, COLORS.woodDeep, 0, 0.32, -half + 0.04);
  addBox(group, fieldSize, 0.05, edge, COLORS.woodDeep, 0, 0.32, half - 0.04);
  addBox(group, edge, 0.05, fieldSize, COLORS.woodDeep, -half + 0.04, 0.32, 0);
  addBox(group, edge, 0.05, fieldSize, COLORS.woodDeep, half - 0.04, 0.32, 0);

  for (let i = 0; i < 3; i += 1) {
    const x = -half + 0.34 + i * (fieldSize - 0.7) * 0.5;
    const z = i % 2 ? 0.2 : -0.16;
    addBox(
      group,
      0.18,
      0.2 + (i % 2) * 0.06,
      0.07,
      i % 2 ? COLORS.weed : COLORS.weedDark,
      x,
      0.32,
      z,
      { ry: i * 0.7, rz: i % 2 ? 0.2 : -0.16 }
    );
  }
  return group;
}
