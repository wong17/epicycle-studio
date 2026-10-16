import { Vec2 } from '../model';

export interface Raster {
  width: number;
  height: number;
  data: Uint8ClampedArray;
}
export interface TraceOptions {
  style: 'contours' | 'continuous';
  detail: number;
  contrast: number;
  invert: boolean;
}

export function validateTraceOptions(options: TraceOptions): void {
  if (
    !options ||
    !['contours', 'continuous'].includes(options.style) ||
    !Number.isInteger(options.detail) ||
    options.detail < 1 ||
    options.detail > 5 ||
    !Number.isFinite(options.contrast) ||
    options.contrast < 0.5 ||
    options.contrast > 2 ||
    typeof options.invert !== 'boolean'
  )
    throw new Error('Opciones de imagen no válidas.');
}

/** A bounded, deterministic route: all pixel work is limited to 256 x 256. */
export function traceRaster(raster: Raster, options: TraceOptions): Vec2[] {
  validateTraceOptions(options);
  const { width, height, data } = raster;
  if (
    !Number.isInteger(width) ||
    !Number.isInteger(height) ||
    width < 2 ||
    height < 2 ||
    width > 256 ||
    height > 256 ||
    !(data instanceof Uint8ClampedArray) ||
    data.length !== width * height * 4
  )
    throw new Error('Dimensiones de imagen no válidas (máximo 256 por lado).');
  const luminance = new Float32Array(width * height);
  let sum = 0,
    squared = 0;
  for (let i = 0; i < luminance.length; i++) {
    const alpha = data[i * 4 + 3] / 255;
    const light =
      (0.2126 * data[i * 4] + 0.7152 * data[i * 4 + 1] + 0.0722 * data[i * 4 + 2]) / 255;
    const composited = 1 - alpha + light * alpha;
    const value = Math.min(1, Math.max(0, (composited - 0.5) * options.contrast + 0.5));
    luminance[i] = options.invert ? 1 - value : value;
    sum += value;
    squared += value * value;
  }
  const variance = squared / luminance.length - (sum / luminance.length) ** 2;
  if (variance < 0.00002)
    throw new Error('La imagen es uniforme o no contiene suficiente detalle.');
  const count = 300 + (options.detail - 1) * 475;
  const route =
    options.style === 'contours'
      ? contourRoute(luminance, width, height, options.detail)
      : tonalRoute(luminance, width, height, count);
  if (route.length < 2)
    throw new Error('No se encontró suficiente detalle. Prueba otro contraste o estilo.');
  const points = options.style === 'contours' ? resample(route, count) : route;
  const scale = Math.max(width, height);
  return points.map(([x, y]): Vec2 => [(2 * x - width) / scale, (height - 2 * y) / scale]);
}

function distanceSquared(a: Vec2, b: Vec2): number {
  return (a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2;
}

function tonalRoute(light: Float32Array, width: number, height: number, count: number): Vec2[] {
  const cumulative = new Float64Array(light.length);
  let mass = 0;
  for (let i = 0; i < light.length; i++) {
    // Squared darkness gives the route more ink in shadow and less in highlights.
    mass += Math.max(0, 1 - light[i] - 0.015) ** 2;
    cumulative[i] = mass;
  }
  if (mass < 0.01) return [];
  const sites: Vec2[] = [];
  for (let i = 0; i < count; i++) {
    // A low-discrepancy mass sequence avoids the horizontal bands caused by
    // equally spaced raster ranks while preserving the darkness distribution.
    const target = (((i + 0.5) * 0.7548776662466927) % 1) * mass;
    let low = 0,
      high = cumulative.length - 1;
    while (low < high) {
      const mid = (low + high) >>> 1;
      if (cumulative[mid] < target) low = mid + 1;
      else high = mid;
    }
    // Irrational offsets distribute subpixel sites without random or row hatching.
    sites.push([
      (low % width) + (((i + 1) * 0.61803398875) % 1),
      Math.floor(low / width) + (((i + 1) * 0.41421356237) % 1),
    ]);
  }
  const route = [sites[0]];
  const used = new Uint8Array(count);
  used[0] = 1;
  for (let step = 1; step < count; step++) {
    const last = route[route.length - 1];
    let nearest = -1,
      best = Infinity;
    for (let i = 0; i < count; i++) {
      if (used[i]) continue;
      const distance = distanceSquared(last, sites[i]);
      if (distance < best) {
        best = distance;
        nearest = i;
      }
    }
    used[nearest] = 1;
    route.push(sites[nearest]);
  }
  // Local 2-opt removes crossings with a strict O(count * 32 * 3) search budget.
  for (let pass = 0; pass < 3; pass++) {
    for (let i = 0; i < count - 3; i++) {
      const a = route[i],
        b = route[i + 1];
      for (let j = i + 2; j < Math.min(count - 1, i + 34); j++) {
        const c = route[j],
          d = route[j + 1];
        const before = Math.sqrt(distanceSquared(a, b)) + Math.sqrt(distanceSquared(c, d));
        const after = Math.sqrt(distanceSquared(a, c)) + Math.sqrt(distanceSquared(b, d));
        if (after + 0.0001 < before) {
          for (let lo = i + 1, hi = j; lo < hi; lo++, hi--)
            [route[lo], route[hi]] = [route[hi], route[lo]];
          break;
        }
      }
    }
  }
  return route;
}

function contourRoute(light: Float32Array, width: number, height: number, detail: number): Vec2[] {
  const size = width * height;
  const magnitude = new Float32Array(size);
  const direction = new Uint8Array(size);
  const positive: number[] = [];
  for (let y = 1; y < height - 1; y++)
    for (let x = 1; x < width - 1; x++) {
      const i = y * width + x;
      const gx =
        -light[i - width - 1] +
        light[i - width + 1] -
        2 * light[i - 1] +
        2 * light[i + 1] -
        light[i + width - 1] +
        light[i + width + 1];
      const gy =
        -light[i - width - 1] -
        2 * light[i - width] -
        light[i - width + 1] +
        light[i + width - 1] +
        2 * light[i + width] +
        light[i + width + 1];
      const strength = Math.hypot(gx, gy);
      magnitude[i] = strength;
      if (strength > 0.03) positive.push(strength);
      const angle = ((Math.atan2(gy, gx) * 180) / Math.PI + 180) % 180;
      direction[i] = angle < 22.5 || angle >= 157.5 ? 0 : angle < 67.5 ? 1 : angle < 112.5 ? 2 : 3;
    }
  if (positive.length === 0) return [];
  positive.sort((a, b) => a - b);
  const threshold = Math.max(0.06, positive[Math.floor(positive.length * (0.76 - detail * 0.085))]);
  const candidates: number[] = [];
  const offsets = [1, width + 1, width, width - 1];
  for (let y = 1; y < height - 1; y++)
    for (let x = 1; x < width - 1; x++) {
      const i = y * width + x,
        offset = offsets[direction[i]],
        value = magnitude[i];
      if (value >= threshold && value >= magnitude[i - offset] && value >= magnitude[i + offset])
        candidates.push(i);
    }
  // Protect graph work even for noisy input; ties use source order for determinism.
  candidates.sort((a, b) => magnitude[b] - magnitude[a] || a - b);
  candidates.length = Math.min(candidates.length, 10000);
  const available = new Uint8Array(size);
  for (const i of candidates) available[i] = 1;
  const neighbors = (i: number): number[] => {
    const result: number[] = [],
      x = i % width,
      y = Math.floor(i / width);
    for (let dy = -1; dy <= 1; dy++)
      for (let dx = -1; dx <= 1; dx++) {
        if ((!dx && !dy) || x + dx < 0 || x + dx >= width || y + dy < 0 || y + dy >= height)
          continue;
        const next = i + dy * width + dx;
        if (available[next]) result.push(next);
      }
    return result;
  };
  const chains: Vec2[][] = [];
  // Walk endpoints before loops. Each graph vertex is visited at most once.
  const seeds = [...candidates.filter((i) => neighbors(i).length <= 1), ...candidates];
  for (const seed of seeds) {
    if (!available[seed]) continue;
    const chain: Vec2[] = [];
    let current = seed,
      previous = -1;
    while (current >= 0) {
      available[current] = 0;
      chain.push([(current % width) + 0.5, Math.floor(current / width) + 0.5]);
      const next = neighbors(current);
      let chosen = next[0] ?? -1;
      if (previous >= 0 && next.length > 1) {
        const dx = (current % width) - (previous % width),
          dy = Math.floor(current / width) - Math.floor(previous / width);
        let best = -Infinity;
        for (const candidate of next) {
          const nx = (candidate % width) - (current % width),
            ny = Math.floor(candidate / width) - Math.floor(current / width);
          const alignment = (dx * nx + dy * ny) / Math.hypot(nx, ny);
          if (alignment > best) {
            best = alignment;
            chosen = candidate;
          }
        }
      }
      previous = current;
      current = chosen;
    }
    if (chain.length >= 3) chains.push(chain);
  }
  chains.sort((a, b) => b.length - a.length);
  chains.length = Math.min(chains.length, 600);
  if (chains.length === 0) return [];
  const first = chains.shift();
  if (!first) return [];
  const route = [...first];
  while (chains.length) {
    const last = route[route.length - 1];
    let index = 0,
      reverse = false,
      best = Infinity;
    for (let i = 0; i < chains.length; i++) {
      const chain = chains[i];
      const start = distanceSquared(last, chain[0]),
        end = distanceSquared(last, chain[chain.length - 1]);
      if (start < best) {
        best = start;
        index = i;
        reverse = false;
      }
      if (end < best) {
        best = end;
        index = i;
        reverse = true;
      }
    }
    const chain = chains.splice(index, 1)[0];
    if (reverse) chain.reverse();
    // The nearest endpoint bridge turns disconnected edges into one drawable route.
    route.push(...chain);
  }
  return route;
}

function resample(route: Vec2[], count: number): Vec2[] {
  const lengths = [0];
  for (let i = 1; i < route.length; i++)
    lengths.push(lengths[i - 1] + Math.sqrt(distanceSquared(route[i - 1], route[i])));
  const total = lengths[lengths.length - 1];
  if (total === 0) return [];
  const result: Vec2[] = [];
  let segment = 1;
  for (let i = 0; i < count; i++) {
    const target = (total * i) / (count - 1);
    while (segment < route.length - 1 && lengths[segment] < target) segment++;
    const a = route[segment - 1],
      b = route[segment];
    const length = lengths[segment] - lengths[segment - 1];
    const t = length ? (target - lengths[segment - 1]) / length : 0;
    result.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]);
  }
  return result;
}
