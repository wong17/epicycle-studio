import type { Vec2 } from '../model';
import type { RouteOrder } from './types';

const MAX_POINTS = 10_000;

function validate(points: readonly Vec2[]): void {
  if (points.length < 2) throw new Error('Drawing needs at least two points.');
  if (points.length > MAX_POINTS) throw new Error('Drawing exceeds 10000 points.');
  if (points.some(([x, y]) => !Number.isFinite(x) || !Number.isFinite(y)))
    throw new Error('Drawing coordinates must be finite.');
  const first = points[0];
  if (!points.some(([x, y]) => x !== first[0] || y !== first[1]))
    throw new Error('Drawing has no extent.');
}

/** Center the bounding box and fit its longest side to [-1, 1]. */
export function normalizeDrawing(points: readonly Vec2[]): Vec2[] {
  validate(points);
  let minX = Infinity,
    minY = Infinity,
    maxX = -Infinity,
    maxY = -Infinity;
  for (const [x, y] of points) {
    minX = Math.min(minX, x);
    maxX = Math.max(maxX, x);
    minY = Math.min(minY, y);
    maxY = Math.max(maxY, y);
  }
  const cx = minX / 2 + maxX / 2,
    cy = minY / 2 + maxY / 2;
  const halfExtent = Math.max(maxX / 2 - minX / 2, maxY / 2 - minY / 2);
  if (halfExtent === 0) throw new Error('Drawing extent is too small.');
  return points.map(([x, y]): Vec2 => [
    ((x / 2 - cx / 2) / halfExtent) * 2,
    ((y / 2 - cy / 2) / halfExtent) * 2,
  ]);
}

/** Every adjacent pair is drawn, including bridges between separate strokes. */
export function connectStrokes(
  strokes: readonly (readonly Vec2[])[],
  order: RouteOrder = 'nearest',
): Vec2[] {
  if (order !== 'nearest' && order !== 'original') throw new Error('Unknown route order.');
  const points = strokes.flat();
  validate(points);
  if (
    strokes.some(
      (stroke) =>
        stroke.length < 2 || !stroke.some(([x, y]) => x !== stroke[0][0] || y !== stroke[0][1]),
    )
  )
    throw new Error('Each stroke needs at least two distinct points.');
  const remaining = strokes.map((stroke) => [...stroke]);
  const route = remaining.shift() ?? [];
  while (remaining.length) {
    let selected = 0,
      reverse = false,
      entry = 0;
    if (order === 'nearest') {
      const end = route[route.length - 1];
      let nearest = Infinity;
      for (let i = 0; i < remaining.length; i++) {
        const stroke = remaining[i];
        const start = stroke[0],
          last = stroke[stroke.length - 1];
        const closed =
          stroke.length > 3 && Math.hypot(start[0] - last[0], start[1] - last[1]) < 1e-10;
        if (closed) {
          for (let vertex = 0; vertex < stroke.length - 1; vertex++) {
            const p = stroke[vertex];
            const distance = Math.hypot(end[0] - p[0], end[1] - p[1]);
            if (distance < nearest) {
              nearest = distance;
              selected = i;
              reverse = false;
              entry = vertex;
            }
          }
          continue;
        }
        for (const backwards of [false, true]) {
          const p = stroke[backwards ? stroke.length - 1 : 0];
          const distance = Math.hypot(end[0] - p[0], end[1] - p[1]);
          if (distance < nearest) {
            nearest = distance;
            selected = i;
            reverse = backwards;
            entry = 0;
          }
        }
      }
    }
    const stroke = remaining.splice(selected, 1)[0];
    if (entry > 0) {
      const ring = stroke.slice(0, -1);
      route.push(...ring.slice(entry), ...ring.slice(0, entry), ring[entry]);
    } else route.push(...(reverse ? stroke.reverse() : stroke));
  }
  return route.map(([x, y]): Vec2 => [x, y]);
}
