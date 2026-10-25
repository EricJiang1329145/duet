/**
 * Resample a polyline into evenly spaced dots. Keeping this pure makes the
 * dotted-guide math testable without importing Three.js.
 */
export function samplePathPoints(
  points,
  { spacing = 0.32, start = 0.14, end = 0.16, max = 260 } = {}
) {
  if (!Array.isArray(points) || points.length < 2 || max <= 0) return [];

  const clean = [];
  for (const point of points) {
    const x = Number(point?.x);
    const y = Number(point?.y);
    if (!Number.isFinite(x) || !Number.isFinite(y)) continue;
    const last = clean[clean.length - 1];
    if (last && Math.hypot(x - last.x, y - last.y) < 1e-4) continue;
    clean.push({ x, y });
  }
  if (clean.length < 2) return [];

  const segments = [];
  let total = 0;
  for (let i = 1; i < clean.length; i += 1) {
    const a = clean[i - 1];
    const b = clean[i];
    const length = Math.hypot(b.x - a.x, b.y - a.y);
    if (length < 1e-4) continue;
    segments.push({ a, b, length, from: total });
    total += length;
  }
  if (!segments.length || total <= start + end) return [];

  const stop = Math.max(start, total - end);
  const dots = [];
  let segmentIndex = 0;
  for (let distance = start; distance <= stop + 1e-6; distance += spacing) {
    while (
      segmentIndex < segments.length - 1 &&
      distance > segments[segmentIndex].from + segments[segmentIndex].length
    ) {
      segmentIndex += 1;
    }
    const segment = segments[segmentIndex];
    const t = Math.min(1, Math.max(0, (distance - segment.from) / segment.length));
    dots.push({
      x: segment.a.x + (segment.b.x - segment.a.x) * t,
      y: segment.a.y + (segment.b.y - segment.a.y) * t
    });
    if (dots.length >= max) break;
  }
  return dots;
}
