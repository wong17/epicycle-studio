import { Project, parseProject, projectSchema } from '../../domain/projects/project-schema';
import { z } from 'zod';
import { CurveSamples } from '../../domain/model';
export function download(blob: Blob, name: string): void {
  const url = URL.createObjectURL(blob),
    a = document.createElement('a');
  a.href = url;
  a.download = name.replace(/[^\p{L}\p{N}._ -]/gu, '_');
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
export function exportSvg(
  s: CurveSamples,
  color: string,
  width: number,
  options: {
    background?: 'dark' | 'black' | 'transparent';
    grid?: boolean;
    bounds?: [number, number, number, number];
    pixels?: number;
  } = {},
): string {
  if (
    s.dimension !== 2 ||
    !['#d4f477', '#ffa68b', '#89dce6'].includes(color) ||
    width < 1 ||
    width > 6
  )
    throw new Error('SVG: parámetros inválidos');
  const xs: number[] = [],
    ys: number[] = [];
  for (let i = 0; i < s.count; i++) {
    xs.push(s.coordinates[i * 2]);
    ys.push(-s.coordinates[i * 2 + 1]);
  }
  const minX = Math.min(...xs),
    minY = Math.min(...ys),
    w = Math.max(...xs) - minX,
    h = Math.max(...ys) - minY,
    pad = Math.max(w, h) * 0.04 || 0.04,
    stroke = (width * Math.max(w, h)) / 800;
  const frame = options.bounds ?? [minX - pad, minY - pad, w + 2 * pad, h + 2 * pad];
  const background = options.background === 'black' ? '#000000' : '#151515';
  const backdrop =
    options.background === 'transparent'
      ? ''
      : `<rect data-epicycle-layer="background" x="${frame[0]}" y="${frame[1]}" width="${frame[2]}" height="${frame[3]}" fill="${background}"/>`;
  const step = (frame[2] * 32) / (options.pixels ?? 800);
  const grid = options.grid
    ? `<g data-epicycle-layer="grid" stroke="#252525" stroke-width="${step / 32}">${[
        ...Array.from(
          { length: Math.ceil(frame[2] / step) + 1 },
          (_, i) =>
            `<line x1="${frame[0] + i * step}" y1="${frame[1]}" x2="${frame[0] + i * step}" y2="${frame[1] + frame[3]}"/>`,
        ),
        ...Array.from(
          { length: Math.ceil(frame[3] / step) + 1 },
          (_, i) =>
            `<line x1="${frame[0]}" y1="${frame[1] + i * step}" x2="${frame[0] + frame[2]}" y2="${frame[1] + i * step}"/>`,
        ),
      ].join('')}</g>`
    : '';
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${frame.join(' ')}"><title>Epicycle Studio · reconstrucción muestreada</title>${backdrop}${grid}<path d="${xs.map((x, i) => `${i ? 'L' : 'M'}${x},${ys[i]}`).join(' ')} Z" fill="none" stroke="${color}" stroke-width="${options.bounds ? (width * frame[2]) / (options.pixels ?? 800) : stroke}" stroke-linejoin="round"/></svg>`;
}
const shareSchema = z.strictObject({
  shareVersion: z.literal(1),
  name: projectSchema.shape.name,
  dimension: projectSchema.shape.dimension,
  source: projectSchema.shape.source,
  analysis: projectSchema.shape.analysis,
  appearance: projectSchema.shape.appearance,
  playback: projectSchema.shape.playback,
  view: projectSchema.shape.view,
});
export function encodeShare(project: Project): string | null {
  const { name, dimension, source, analysis, appearance, playback, view } = project;
  const bytes = new TextEncoder().encode(
    JSON.stringify({
      shareVersion: 1,
      name,
      dimension,
      source,
      analysis,
      appearance,
      playback,
      view,
    }),
  );
  if (bytes.length > 6000) return null;
  const encoded = btoa(String.fromCharCode(...bytes))
    .replaceAll('+', '-')
    .replaceAll('/', '_')
    .replace(/=+$/, '');
  return encoded.length > 8000 ? null : encoded;
}
export function decodeShare(encoded: string): Project {
  if (encoded.length > 8000 || !/^[\w-]+$/.test(encoded))
    throw new Error('Enlace inválido o demasiado grande');
  const bytes = Uint8Array.from(atob(encoded.replaceAll('-', '+').replaceAll('_', '/')), (c) =>
    c.charCodeAt(0),
  );
  if (bytes.length > 6000) throw new Error('Enlace demasiado grande');
  const text = new TextDecoder('utf-8', { fatal: true }).decode(bytes),
    decoded = JSON.parse(text),
    shared = shareSchema.parse(decoded);
  const p = parseProject(
    JSON.stringify({
      ...shared,
      shareVersion: undefined,
      format: 'epicycle-studio',
      schemaVersion: 2,
      id: crypto.randomUUID(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }),
  );
  return {
    ...p,
    id: crypto.randomUUID(),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}
export function capturePng(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) =>
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error('No se pudo capturar la imagen'))),
      'image/png',
    ),
  );
}
export function inspectSvg(text: string): { name: string; d: string }[] {
  if (new TextEncoder().encode(text).length > 262144 || /<!DOCTYPE|<!ENTITY/i.test(text))
    throw new Error('SVG demasiado grande o con entidades');
  const doc = new DOMParser().parseFromString(text, 'image/svg+xml');
  if (doc.querySelector('parsererror')) throw new Error('SVG mal formado');
  if (doc.querySelector('script,foreignObject,image,use,animate,animateTransform,set'))
    throw new Error('SVG contiene elementos no permitidos');
  for (const element of Array.from(doc.querySelectorAll('*')))
    for (const a of Array.from(element.attributes))
      if (
        /^on/i.test(a.name) ||
        /href/i.test(a.name) ||
        a.name === 'transform' ||
        /url\(/i.test(a.value)
      )
        throw new Error('Aplana transformaciones y elimina referencias externas antes de importar');
  const viewBox = doc.documentElement.getAttribute('viewBox')?.trim().split(/[ ,]+/).map(Number);
  if (
    !viewBox ||
    viewBox.length !== 4 ||
    viewBox.some((x) => !Number.isFinite(x)) ||
    viewBox[2] <= 0 ||
    viewBox[3] <= 0
  )
    throw new Error('SVG necesita un viewBox válido');
  const paths = Array.from(doc.querySelectorAll('path'));
  if (!paths.length || paths.length > 32) throw new Error('SVG necesita entre 1 y 32 paths');
  return paths.map((path, i) => {
    const d = path.getAttribute('d') ?? '',
      commands = d.match(/[a-z]/gi) ?? [];
    if (
      d.length > 100000 ||
      commands.length > 10000 ||
      commands.filter((c) => c.toLowerCase() === 'm').length !== 1 ||
      /[^MmLlHhVvCcSsQqTtAaZz0-9eE+.,\s-]/.test(d)
    )
      throw new Error('Path inválido: usa un solo subtrazo');
    const values = d.match(/[-+]?(?:\d*\.)?\d+(?:e[-+]?\d+)?/gi) ?? [];
    if (values.some((x) => !Number.isFinite(Number(x))))
      throw new Error('Coordenadas SVG inválidas');
    return { name: path.id || `Trayectoria ${i + 1}`, d };
  });
}
export function sampleSvg(d: string): readonly (readonly [number, number])[] {
  const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  path.setAttribute('d', d);
  const length = path.getTotalLength();
  if (!Number.isFinite(length) || length <= 1e-9) throw new Error('Trayectoria vacía');
  return Array.from({ length: 1024 }, (_, j) => {
    const p = path.getPointAtLength((length * j) / 1023);
    if (!Number.isFinite(p.x) || !Number.isFinite(p.y)) throw new Error('Geometría SVG inválida');
    return [p.x, -p.y] as const;
  });
}
