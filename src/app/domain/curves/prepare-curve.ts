import { ClosureMode, Dimension, Point, PreparedCurve, CurveSamples } from '../model';
export function distance(a: Point, b: Point): number {
  return Math.hypot(...a.map((x, i) => x - b[i]));
}
export function validatePoints(points: readonly Point[], dimension: Dimension): void {
  if (!points.length) throw new Error('EMPTY: dibuja al menos tres puntos');
  if (points.length > 10000) throw new Error('LIMIT: máximo 10 000 puntos');
  for (const p of points) {
    if (p.length !== dimension) throw new Error('DIMENSION');
    if (p.some((x) => !Number.isFinite(x))) throw new Error('NON_FINITE');
    if (p.some((x) => Math.abs(x) > 1e6)) throw new Error('BOUNDS');
  }
}
export function resampleClosedPolyline(
  points: readonly Point[],
  dimension: Dimension,
  count: number,
): CurveSamples {
  validatePoints(points, dimension);
  if (!Number.isInteger(count) || count < 2 || count > 8192) throw new Error('COUNT');
  const lengths = [0];
  for (let i = 0; i < points.length; i++)
    lengths.push(lengths[i] + distance(points[i], points[(i + 1) % points.length]));
  const total = lengths.at(-1)!;
  if (total < 1e-12) throw new Error('DEGENERATE');
  const coordinates = new Float64Array(count * dimension);
  let edge = 0;
  for (let j = 0; j < count; j++) {
    const target = (total * j) / count;
    while (edge < points.length - 1 && lengths[edge + 1] <= target) edge++;
    const span = lengths[edge + 1] - lengths[edge],
      fraction = span === 0 ? 0 : (target - lengths[edge]) / span;
    for (let d = 0; d < dimension; d++)
      coordinates[j * dimension + d] =
        points[edge][d] + fraction * (points[(edge + 1) % points.length][d] - points[edge][d]);
  }
  return { dimension, count, coordinates };
}
export function prepareCurve(
  points: readonly Point[],
  dimension: Dimension,
  closure: ClosureMode,
  count: number,
): PreparedCurve {
  validatePoints(points, dimension);
  if (![256, 512, 1024, 2048].includes(count)) throw new Error('COUNT');
  if (closure !== 'segment' && closure !== 'return') throw new Error('CLOSURE');
  const min = Array.from({ length: dimension }, (_, d) => Math.min(...points.map((p) => p[d]))),
    max = Array.from({ length: dimension }, (_, d) => Math.max(...points.map((p) => p[d]))),
    size = Math.max(...max.map((x, d) => x - min[d]));
  if (size < 1e-9) throw new Error('DEGENERATE');
  const center = min.map((x, d) => (x + max[d]) / 2) as unknown as Point,
    scale = 2 / size,
    clean: Point[] = [];
  for (const p of points) {
    const normalized = p.map((x, d) => (x - center[d]) * scale) as unknown as Point;
    if (!clean.length || distance(normalized, clean.at(-1)!) >= 1e-8) clean.push(normalized);
  }
  if (clean.length > 1 && distance(clean[0], clean.at(-1)!) < 1e-8) clean.pop();
  if (clean.length < 3) throw new Error('DEGENERATE');
  return {
    samples: resampleClosedPolyline(
      closure === 'return' ? [...clean, ...clean.slice(1, -1).reverse()] : clean,
      dimension,
      count,
    ),
    sourceCenter: center,
    sourceScale: scale,
  };
}
