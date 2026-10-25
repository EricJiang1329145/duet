import { disposeChildren } from "../render/dispose.js";
import {
  buildCropStageGroup,
  buildLockedOverlay,
  buildPlotHazardGroup,
  buildPlotSelectionFrame
} from "./crops.js";
import { ACTION, COLORS } from "../config.js";

/**
 * Build one grid of field plots and register its views. The merged farm uses
 * this for all twelve beds.
 */
export function buildPlotField(kit, {
  parent,
  grid,
  ids,
  indexOffset = 0,
  plotViews = kit.plotViews
}) {
  const { addBox, addGroup, addHitbox, addWorldLabel } = kit;
  const fieldSize = grid.size;

  for (let row = 0; row < grid.rows; row += 1) {
    for (let col = 0; col < grid.columns; col += 1) {
      const index = row * grid.columns + col;
      const id = ids[index];
      if (!id) continue;
      const x = grid.startX + col * grid.stepX;
      const z = grid.startZ + row * grid.stepZ;
      const visualIndex = index + indexOffset;

      const plot = addGroup(parent, x, 0, z);
      addBox(
        plot,
        fieldSize,
        0.16,
        fieldSize,
        index % 2 ? COLORS.woodDark : COLORS.wood,
        0,
        0.08,
        0
      );
      addBox(plot, fieldSize - 0.18, 0.09, fieldSize - 0.18, COLORS.soil, 0, 0.19, 0);

      for (let rowLine = -1; rowLine <= 1; rowLine += 1) {
        addBox(
          plot,
          fieldSize - 0.42,
          0.025,
          0.09,
          COLORS.soilLine,
          0,
          0.245,
          rowLine * 0.27
        );
      }

      addBox(plot, 0.08, 0.3, 0.08, COLORS.woodDeep, -fieldSize / 2 + 0.18, 0.31, -fieldSize / 2 + 0.18);
      addBox(plot, 0.08, 0.3, 0.08, COLORS.woodDeep, fieldSize / 2 - 0.18, 0.31, fieldSize / 2 - 0.18);

      addHitbox(plot, ACTION.FIELD_CLICKED, id, {
        w: fieldSize,
        h: 0.78,
        d: fieldSize,
        x: 0,
        y: 0.39,
        z: 0
      });

      const labelEl = addWorldLabel(
        id.slice(-2),
        x + 0.38,
        0.3,
        z - 0.42,
        "field"
      );

      const cropRoot = addGroup(plot, 0, 0, 0);
      const view = {
        root: plot,
        cropGroups: {},
        cropType: null,
        hazardGroups: {
          weeds: buildPlotHazardGroup(plot, "weeds"),
          pest: buildPlotHazardGroup(plot, "pest")
        },
        lockedOverlay: buildLockedOverlay(plot, fieldSize),
        selectionFrame: buildPlotSelectionFrame(plot, fieldSize),
        labelEl,
        lastStage: null,
        lastSelected: null,
        lastLocked: null,
        lastHazard: null,
        lastReady: null,
        lastType: null
      };

      view.setCropType = (type) => {
        if (view.cropType === type) return;
        view.cropType = type;
        disposeChildren(cropRoot);
        const groups = {};
        for (const stage of ["seeded", "sprout", "growing", "ready"]) {
          groups[stage] = buildCropStageGroup(cropRoot, stage, visualIndex, type);
        }
        view.cropGroups = groups;
        view.lastStage = null;
      };

      plotViews[id] = view;
    }
  }
}
