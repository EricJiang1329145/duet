import { PLAYER_RADIUS, WALK_LAYOUTS } from "../config.js";

/**
 * Small deterministic grid A*. The world is made of axis-aligned boxes, so a
 * 0.25-unit grid with inflated obstacles is enough to route through doorways
 * without introducing a runtime dependency.
 */
const CELL = 0.25;
const DIAGONAL = Math.SQRT2;
const EPS = 1e-9;

function pointInsideRect(x, y, rect, pad = 0) {
  return (
    x >= rect.minX - pad &&
    x <= rect.maxX + pad &&
    y >= rect.minZ - pad &&
    y <= rect.maxZ + pad
  );
}

export function obstaclesForScene(scene, extraObstacles = []) {
  const layout = WALK_LAYOUTS[scene];
  if (!layout) return [];
  return [...layout.obstacles, ...extraObstacles];
}

export function isWalkablePoint(
  scene,
  x,
  y,
  extraObstacles = [],
  layout = WALK_LAYOUTS[scene]
) {
  if (!layout) return false;
  const bounds = layout.bounds;
  if (
    x < bounds.minX + PLAYER_RADIUS ||
    x > bounds.maxX - PLAYER_RADIUS ||
    y < bounds.minZ + PLAYER_RADIUS ||
    y > bounds.maxZ - PLAYER_RADIUS
  ) {
    return false;
  }

  for (const rect of obstaclesForScene(scene, extraObstacles)) {
    // A circle vs. AABB test against the un-inflated box. This keeps the
    // visual footprint honest: you can touch the edge of a bed but not enter.
    const nearestX = Math.max(rect.minX, Math.min(x, rect.maxX));
    const nearestY = Math.max(rect.minZ, Math.min(y, rect.maxZ));
    const dx = x - nearestX;
    const dy = y - nearestY;
    if (dx * dx + dy * dy < PLAYER_RADIUS * PLAYER_RADIUS) return false;
  }
  return true;
}

function cellWalkable(scene, col, row, grid, extraObstacles) {
  if (col < 0 || row < 0 || col >= grid.cols || row >= grid.rows) return false;
  const wx = grid.minX + (col + 0.5) * CELL;
  const wz = grid.minZ + (row + 0.5) * CELL;
  return isWalkablePoint(scene, wx, wz, extraObstacles);
}

function makeGrid(scene, extraObstacles) {
  const layout = WALK_LAYOUTS[scene];
  if (!layout) return null;
  const minX = layout.bounds.minX + PLAYER_RADIUS;
  const maxX = layout.bounds.maxX - PLAYER_RADIUS;
  const minZ = layout.bounds.minZ + PLAYER_RADIUS;
  const maxZ = layout.bounds.maxZ - PLAYER_RADIUS;
  const cols = Math.max(1, Math.ceil((maxX - minX) / CELL));
  const rows = Math.max(1, Math.ceil((maxZ - minZ) / CELL));
  const grid = { scene, minX, minZ, maxX, maxZ, cols, rows, extraObstacles };
  grid.free = new Uint8Array(cols * rows);
  for (let row = 0; row < rows; row += 1) {
    for (let col = 0; col < cols; col += 1) {
      grid.free[row * cols + col] = cellWalkable(
        scene,
        col,
        row,
        grid,
        extraObstacles
      )
        ? 1
        : 0;
    }
  }
  return grid;
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function cellOf(grid, x, y) {
  return {
    col: clamp(Math.floor((x - grid.minX) / CELL), 0, grid.cols - 1),
    row: clamp(Math.floor((y - grid.minZ) / CELL), 0, grid.rows - 1)
  };
}

function cellCenter(grid, col, row) {
  return {
    x: grid.minX + (col + 0.5) * CELL,
    y: grid.minZ + (row + 0.5) * CELL
  };
}

function nearestFreeCell(grid, cell, maxRadius = 10) {
  const startIndex = cell.row * grid.cols + cell.col;
  if (grid.free[startIndex]) return { ...cell, index: startIndex };

  for (let radius = 1; radius <= maxRadius; radius += 1) {
    let best = null;
    let bestDist = Infinity;
    for (let row = cell.row - radius; row <= cell.row + radius; row += 1) {
      for (let col = cell.col - radius; col <= cell.col + radius; col += 1) {
        if (col < 0 || row < 0 || col >= grid.cols || row >= grid.rows) continue;
        const index = row * grid.cols + col;
        if (!grid.free[index]) continue;
        const dx = col - cell.col;
        const dy = row - cell.row;
        const dist = dx * dx + dy * dy;
        if (dist < bestDist) {
          bestDist = dist;
          best = { col, row, index };
        }
      }
    }
    if (best) return best;
  }
  return null;
}

class MinHeap {
  constructor() {
    this.items = [];
  }

  push(index, priority) {
    const items = this.items;
    items.push({ index, priority });
    let child = items.length - 1;
    while (child > 0) {
      const parent = (child - 1) >> 1;
      if (items[parent].priority <= items[child].priority) break;
      [items[parent], items[child]] = [items[child], items[parent]];
      child = parent;
    }
  }

  pop() {
    const items = this.items;
    if (!items.length) return null;
    const top = items[0];
    const last = items.pop();
    if (items.length && last) {
      items[0] = last;
      let parent = 0;
      for (;;) {
        const left = parent * 2 + 1;
        const right = left + 1;
        let smallest = parent;
        if (left < items.length && items[left].priority < items[smallest].priority) {
          smallest = left;
        }
        if (right < items.length && items[right].priority < items[smallest].priority) {
          smallest = right;
        }
        if (smallest === parent) break;
        [items[parent], items[smallest]] = [items[smallest], items[parent]];
        parent = smallest;
      }
    }
    return top;
  }

  get size() {
    return this.items.length;
  }
}

function octile(ax, ay, bx, by) {
  const dx = Math.abs(ax - bx);
  const dy = Math.abs(ay - by);
  return Math.max(dx, dy) + (DIAGONAL - 1) * Math.min(dx, dy);
}

/**
 * Find a route to `goal`. If the exact point is blocked or unreachable, the
 * nearest reachable cell is used and `adjustedGoal` records the actual target.
 */
export function findPath(scene, start, goal, extraObstacles = []) {
  const layout = WALK_LAYOUTS[scene];
  if (!layout || !start || !goal) return null;
  const grid = makeGrid(scene, extraObstacles);
  if (!grid) return null;

  const startCell = nearestFreeCell(grid, cellOf(grid, start.x, start.y));
  if (!startCell) return null;
  const goalCell = nearestFreeCell(grid, cellOf(grid, goal.x, goal.y), 12);
  if (!goalCell) return null;

  const total = grid.cols * grid.rows;
  const gScore = new Float32Array(total);
  gScore.fill(Infinity);
  const cameFrom = new Int32Array(total);
  cameFrom.fill(-1);
  const closed = new Uint8Array(total);
  const open = new MinHeap();

  gScore[startCell.index] = 0;
  open.push(startCell.index, octile(
    startCell.col,
    startCell.row,
    goalCell.col,
    goalCell.row
  ));

  const neighbors = [
    [-1, 0, 1],
    [1, 0, 1],
    [0, -1, 1],
    [0, 1, 1],
    [-1, -1, DIAGONAL],
    [1, -1, DIAGONAL],
    [-1, 1, DIAGONAL],
    [1, 1, DIAGONAL]
  ];

  while (open.size) {
    const current = open.pop();
    if (!current) break;
    const index = current.index;
    if (closed[index]) continue;
    closed[index] = 1;
    if (index === goalCell.index) break;

    const col = index % grid.cols;
    const row = Math.floor(index / grid.cols);

    for (const [dc, dr, cost] of neighbors) {
      const nc = col + dc;
      const nr = row + dr;
      if (nc < 0 || nr < 0 || nc >= grid.cols || nr >= grid.rows) continue;
      const ni = nr * grid.cols + nc;
      if (!grid.free[ni] || closed[ni]) continue;

      // A diagonal may not cut through the corner of two blocked cells.
      if (dc && dr) {
        const sideA = grid.free[row * grid.cols + nc];
        const sideB = grid.free[nr * grid.cols + col];
        if (!sideA || !sideB) continue;
      }

      const tentative = gScore[index] + cost;
      if (tentative + EPS >= gScore[ni]) continue;
      gScore[ni] = tentative;
      cameFrom[ni] = index;
      open.push(ni, tentative + octile(nc, nr, goalCell.col, goalCell.row));
    }
  }

  if (startCell.index !== goalCell.index && cameFrom[goalCell.index] < 0) {
    return null;
  }

  const cells = [];
  let index = goalCell.index;
  let guard = 0;
  while (index >= 0 && guard < total + 1) {
    const col = index % grid.cols;
    const row = Math.floor(index / grid.cols);
    cells.push({ col, row, point: cellCenter(grid, col, row) });
    if (index === startCell.index) break;
    index = cameFrom[index];
    guard += 1;
  }
  cells.reverse();

  const points = cells.map((cell) => ({ ...cell.point }));
  // Replace the final cell centre with the exact goal when it is walkable and
  // has a clear line from the last cell. This makes clicks feel precise.
  const goalIsExact = isWalkablePoint(scene, goal.x, goal.y, extraObstacles);
  if (goalIsExact) {
    points.push({ x: goal.x, y: goal.y });
  }

  const smoothed = smoothPath(scene, start, points, extraObstacles);
  const final = smoothed[smoothed.length - 1] ?? { ...points[points.length - 1] };
  const reachedExact =
    goalIsExact && Math.hypot(final.x - goal.x, final.y - goal.y) <= 0.2;
  return {
    path: smoothed,
    adjustedGoal: reachedExact ? null : { ...final }
  };
}

function segmentWalkable(scene, a, b, extraObstacles) {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const length = Math.hypot(dx, dy);
  const steps = Math.max(1, Math.ceil(length / 0.12));
  for (let i = 1; i <= steps; i += 1) {
    const t = i / steps;
    if (!isWalkablePoint(scene, a.x + dx * t, a.y + dy * t, extraObstacles)) {
      return false;
    }
  }
  return true;
}

function smoothPath(scene, start, points, extraObstacles) {
  const result = [];
  let current = { ...start };
  let index = 0;

  while (index < points.length) {
    let farthest = index;
    for (let candidate = points.length - 1; candidate >= index; candidate -= 1) {
      if (segmentWalkable(scene, current, points[candidate], extraObstacles)) {
        farthest = candidate;
        break;
      }
    }
    const next = points[farthest];
    if (Math.hypot(next.x - current.x, next.y - current.y) > 0.04) {
      result.push({ x: next.x, y: next.y });
    }
    current = next;
    index = farthest + 1;
  }

  return result;
}

export function pathLength(path) {
  let total = 0;
  for (let i = 1; i < (path?.length ?? 0); i += 1) {
    total += Math.hypot(path[i].x - path[i - 1].x, path[i].y - path[i - 1].y);
  }
  return total;
}
