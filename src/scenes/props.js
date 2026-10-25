import { COLORS } from "../config.js";
import { addBox, addCylinder, addGroup } from "../render/geometry.js";

export function buildTree(parent, x, z, scale = 1) {
  const tree = addGroup(parent, x, 0, z);
  tree.scale.setScalar(scale);

  addCylinder(tree, 0.1, 0.16, 1.25, 7, COLORS.trunk, 0, 0.625, 0);
  addBox(tree, 1.2, 0.74, 0.92, COLORS.leafDark, 0, 1.28, 0, { ry: 0.22 });
  addBox(tree, 0.95, 0.62, 0.78, COLORS.leaf, 0.1, 1.78, -0.02, { ry: -0.32 });
  addBox(tree, 0.6, 0.45, 0.55, COLORS.leafLight, -0.08, 2.2, 0.04, { ry: 0.18 });
  return tree;
}

export function buildBush(parent, x, z, scale = 1) {
  const bush = addGroup(parent, x, 0, z);
  bush.scale.setScalar(scale);
  addBox(bush, 0.55, 0.35, 0.45, COLORS.leafDark, 0, 0.18, 0, { ry: 0.25 });
  addBox(bush, 0.42, 0.3, 0.4, COLORS.leaf, 0.18, 0.33, 0.02, { ry: -0.18 });
  addBox(bush, 0.34, 0.24, 0.3, COLORS.leafLight, -0.18, 0.34, -0.03, { ry: 0.4 });
  return bush;
}

export function buildStairs(parent, x, zStart, steps, width, depth, rise, color) {
  const stairGroup = addGroup(parent, x, 0, zStart);
  for (let i = 0; i < steps; i += 1) {
    const stepHeight = rise * (i + 1);
    addBox(
      stairGroup,
      width,
      stepHeight,
      depth,
      i % 2 === 0 ? color : COLORS.stairDark,
      0,
      stepHeight / 2,
      -i * depth
    );
  }

  // No long handrail: the bare steps read cleaner in the small upstairs room.
  return stairGroup;
}

export function buildPottedPlant(parent, x, z, scale = 1) {
  const plant = addGroup(parent, x, 0, z);
  plant.scale.setScalar(scale);
  addCylinder(plant, 0.2, 0.16, 0.38, 8, COLORS.plantPot, 0, 0.19, 0);
  addCylinder(plant, 0.035, 0.045, 0.5, 6, COLORS.leafDark, 0, 0.55, 0);
  addBox(plant, 0.46, 0.08, 0.22, COLORS.leaf, 0.12, 0.74, 0, { ry: 0.2, rz: -0.4 });
  addBox(plant, 0.4, 0.07, 0.2, COLORS.leafLight, -0.12, 0.85, 0.02, { ry: -0.35, rz: 0.45 });
  addBox(plant, 0.34, 0.07, 0.18, COLORS.leafDark, 0.03, 0.96, -0.03, { ry: 0.8, rz: 0.22 });
  return plant;
}

/**
 * Garden bench swing. The `pivot` group rotates around X so both seats swing
 * along Z; the presentation reads the same angle to place seated avatars.
 */
export function buildSwing(parent, anchor) {
  const frame = addGroup(parent, anchor.x, 0, anchor.y);
  const wood = COLORS.woodDark;
  const rope = COLORS.swingRope;

  for (const sideX of [-0.38, 0.38]) {
    for (const sideZ of [-0.52, 0.52]) {
      addBox(frame, 0.08, 1.78, 0.08, wood, sideX, 0.89, sideZ);
    }
    // Top side rails run front-to-back. The old version rotated these
    // boxes around X, turning them into two vertical sticks above the frame.
    addBox(frame, 0.07, 0.07, 1.12, wood, sideX, 1.79, 0);
  }
  addBox(frame, 0.86, 0.08, 0.08, COLORS.wood, 0, 1.86, 0);
  addBox(frame, 0.9, 0.04, 0.1, COLORS.woodDeep, 0, 1.81, 0);

  const pivot = addGroup(frame, 0, 1.82, 0);
  const seats = [];
  for (const [index, seatX] of [-0.27, 0.27].entries()) {
    for (const ropeX of [-0.17, 0.17]) {
      addBox(pivot, 0.025, 1.28, 0.025, rope, seatX + ropeX, -0.64, 0);
    }
    addBox(pivot, 0.46, 0.07, 0.32, COLORS.wood, seatX, -1.3, 0);
    addBox(pivot, 0.44, 0.03, 0.3, COLORS.honey, seatX, -1.26, 0.01);
    seats.push({ slot: index, x: seatX });
  }

  return { frame, pivot, seats, hangY: 1.82, ropeLength: 1.3 };
}

/**
 * Seesaw. The board pivot rotates around Z, so one end rises while the other
 * falls. Seated avatars are placed on the board from the same angle.
 */
export function buildSeesaw(parent, prop) {
  const root = addGroup(parent, prop.pivot.x, 0, prop.pivot.y);
  addBox(root, 0.44, 0.34, 0.6, COLORS.woodDark, 0, 0.17, 0);
  addBox(root, 0.26, 0.12, 0.42, COLORS.metal, 0, 0.38, 0);

  const pivot = addGroup(root, 0, prop.pivotY ?? 0.46, 0);
  addBox(pivot, 2.08, 0.09, 0.36, COLORS.seesaw, 0, 0, 0);
  addBox(pivot, 1.96, 0.025, 0.16, COLORS.seesawAlt, 0, 0.055, 0);

  for (const end of prop.ends) {
    const offset = end.x - prop.pivot.x;
    addBox(pivot, 0.4, 0.06, 0.3, COLORS.honey, offset, 0.08, 0);
    addBox(pivot, 0.05, 0.24, 0.05, COLORS.metal, offset, 0.2, -0.14);
    addBox(pivot, 0.05, 0.24, 0.05, COLORS.metal, offset, 0.2, 0.14);
    addBox(pivot, 0.42, 0.05, 0.05, COLORS.metal, offset, 0.32, 0);
  }

  return { root, pivot, boardY: prop.pivotY ?? 0.46 };
}

/** A simple glass cold-frame over the greenhouse plots. */
export function buildGreenhouse(parent, { x, z, width, depth, height = 1.4 }) {
  const group = addGroup(parent, x, 0, z);
  const edge = COLORS.glassEdge;
  const glass = COLORS.glass;

  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      addBox(
        group,
        0.055,
        height,
        0.055,
        edge,
        (sx * width) / 2,
        height / 2,
        (sz * depth) / 2
      );
    }
  }

  addBox(group, width, 0.06, 0.06, edge, 0, height, -depth / 2);
  addBox(group, width, 0.06, 0.06, edge, 0, height, depth / 2);
  addBox(group, 0.06, 0.06, depth, edge, -width / 2, height, 0);
  addBox(group, 0.06, 0.06, depth, edge, width / 2, height, 0);

  const glassOptions = {
    materialOptions: { transparent: true, opacity: 0.12, depthWrite: false }
  };
  addBox(group, width, height, 0.03, glass, 0, height / 2, -depth / 2, glassOptions);
  addBox(group, width, height, 0.03, glass, 0, height / 2, depth / 2, glassOptions);
  addBox(group, 0.03, height, depth, glass, -width / 2, height / 2, 0, glassOptions);
  addBox(group, 0.03, height, depth, glass, width / 2, height / 2, 0, glassOptions);
  addBox(group, width, 0.03, depth, glass, 0, height, 0, glassOptions);

  // Roof pitch: two thin slabs leaning to a ridge.
  addBox(group, width, 0.03, depth / 2 + 0.08, glass, 0, height + 0.18, -depth / 4, {
    rx: -0.34,
    ...glassOptions
  });
  addBox(group, width, 0.03, depth / 2 + 0.08, glass, 0, height + 0.18, depth / 4, {
    rx: 0.34,
    ...glassOptions
  });

  return group;
}
