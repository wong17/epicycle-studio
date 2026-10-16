import { Vec2 } from '../../domain/model';

export interface SvgStroke {
  readonly id: string;
  readonly name: string;
  readonly points: readonly Vec2[];
}
const namespace = 'http://www.w3.org/2000/svg';
const numberPattern = /[-+]?(?:\d+\.?\d*|\.\d+)(?:[eE][-+]?\d+)?/y;
const arities: Readonly<Record<string, number>> = {
  M: 2,
  L: 2,
  H: 1,
  V: 1,
  C: 6,
  S: 4,
  Q: 4,
  T: 2,
  A: 7,
};

/** Split paths while preserving the cursor of relative moveto commands. */
export function splitSvgSubpaths(data: string): string[] {
  if (data.length > 100000) throw new Error('Path SVG demasiado grande');
  const tokens: (number | string)[] = [];
  for (let index = 0; index < data.length;) {
    const char = data[index];
    if (/\s/.test(char)) {
      index++;
      continue;
    }
    if (char === ',') {
      if (typeof tokens.at(-1) !== 'number' || !/^\s*[-+.\d]/.test(data.slice(index + 1)))
        throw new Error('Separador SVG inválido');
      index++;
      continue;
    }
    if (/[MmLlHhVvCcSsQqTtAaZz]/.test(char)) {
      tokens.push(char);
      index++;
    } else {
      numberPattern.lastIndex = index;
      const match = numberPattern.exec(data);
      if (!match || !Number.isFinite(Number(match[0])))
        throw new Error('Sintaxis de path SVG inválida');
      tokens.push(Number(match[0]));
      index = numberPattern.lastIndex;
    }
    if (tokens.length > 80000) throw new Error('Path SVG demasiado complejo');
  }
  const paths: string[] = [];
  let current = '',
    command = '',
    x = 0,
    y = 0,
    startX = 0,
    startY = 0,
    index = 0,
    count = 0;
  while (index < tokens.length) {
    if (typeof tokens[index] === 'string') command = String(tokens[index++]);
    const upper = command.toUpperCase();
    if (!current && upper !== 'M') throw new Error('El path SVG debe comenzar con M');
    if (upper === 'Z') {
      current += ' Z';
      x = startX;
      y = startY;
      command = '';
      continue;
    }
    const arity = arities[upper];
    if (!arity) throw new Error('Comando SVG inválido');
    const values: number[] = [];
    for (let j = 0; j < arity; j++) {
      const value = tokens[index++];
      if (typeof value !== 'number') throw new Error('Faltan coordenadas en el path SVG');
      values.push(value);
    }
    if (++count > 10000) throw new Error('Path SVG demasiado complejo');
    const relative = command !== upper;
    if (upper === 'M') {
      if (current) paths.push(current);
      x = values[0] + (relative ? x : 0);
      y = values[1] + (relative ? y : 0);
      startX = x;
      startY = y;
      current = `M ${x} ${y}`;
      command = relative ? 'l' : 'L';
    } else {
      if (
        upper === 'A' &&
        (values[0] < 0 ||
          values[1] < 0 ||
          ![0, 1].includes(values[3]) ||
          ![0, 1].includes(values[4]))
      )
        throw new Error('Arco SVG inválido');
      current += ` ${command} ${values.join(' ')}`;
      if (upper === 'H') x = values[0] + (relative ? x : 0);
      else if (upper === 'V') y = values[0] + (relative ? y : 0);
      else {
        x = values[arity - 2] + (relative ? x : 0);
        y = values[arity - 1] + (relative ? y : 0);
      }
    }
    if (!Number.isFinite(x) || !Number.isFinite(y)) throw new Error('Coordenadas SVG inválidas');
  }
  if (current) paths.push(current);
  return paths;
}
function numeric(element: Element, name: string, fallback = 0): number {
  const raw = element.getAttribute(name);
  if (raw === null) return fallback;
  if (!/^[-+]?(?:\d+\.?\d*|\.\d+)(?:e[-+]?\d+)?$/i.test(raw.trim()))
    throw new Error(`SVG: ${name} debe usar unidades numéricas`);
  const result = Number(raw);
  if (!Number.isFinite(result)) throw new Error('Coordenadas SVG inválidas');
  return result;
}
function shapeData(element: Element): string {
  const tag = element.localName;
  if (tag === 'path') return element.getAttribute('d') ?? '';
  if (tag === 'line')
    return `M ${numeric(element, 'x1')} ${numeric(element, 'y1')} L ${numeric(element, 'x2')} ${numeric(element, 'y2')}`;
  if (tag === 'polyline' || tag === 'polygon') {
    const points = element.getAttribute('points') ?? '';
    if (/[^0-9eE+.,\s-]/.test(points)) throw new Error('Coordenadas SVG inválidas');
    return points.trim() ? `M ${points}${tag === 'polygon' ? ' Z' : ''}` : '';
  }
  if (tag === 'rect') {
    const x = numeric(element, 'x'),
      y = numeric(element, 'y');
    const width = numeric(element, 'width'),
      height = numeric(element, 'height');
    const rx = numeric(element, 'rx', numeric(element, 'ry')),
      ry = numeric(element, 'ry', rx);
    if (width < 0 || height < 0 || rx < 0 || ry < 0) throw new Error('Rectángulo SVG inválido');
    if (!width || !height) return '';
    const a = Math.min(rx, width / 2),
      b = Math.min(ry, height / 2);
    if (!a || !b) return `M ${x} ${y} h ${width} v ${height} h ${-width} Z`;
    return `M ${x + a} ${y} h ${width - 2 * a} a ${a} ${b} 0 0 1 ${a} ${b} v ${height - 2 * b} a ${a} ${b} 0 0 1 ${-a} ${b} h ${2 * a - width} a ${a} ${b} 0 0 1 ${-a} ${-b} v ${2 * b - height} a ${a} ${b} 0 0 1 ${a} ${-b} Z`;
  }
  const x = numeric(element, 'cx'),
    y = numeric(element, 'cy');
  const rx = numeric(element, tag === 'circle' ? 'r' : 'rx'),
    ry = tag === 'circle' ? rx : numeric(element, 'ry');
  if (rx < 0 || ry < 0) throw new Error('Radio SVG inválido');
  return rx && ry
    ? `M ${x + rx} ${y} a ${rx} ${ry} 0 1 0 ${-2 * rx} 0 a ${rx} ${ry} 0 1 0 ${2 * rx} 0 Z`
    : '';
}
/** Uploads remain detached XML; only numeric path data reaches detached geometry nodes. */
export function readSvgDrawing(text: string): SvgStroke[] {
  if (
    new TextEncoder().encode(text).length > 262144 ||
    /<!DOCTYPE|<!ENTITY|<\?/i.test(text.replace(/^\s*<\?xml[^?]*\?>/, ''))
  )
    throw new Error('SVG demasiado grande o con entidades');
  const doc = new DOMParser().parseFromString(text, 'image/svg+xml');
  if (doc.querySelector('parsererror')) throw new Error('SVG mal formado');
  const root = doc.documentElement;
  if (root.localName !== 'svg' || root.namespaceURI !== namespace)
    throw new Error('Se necesita una raíz SVG con namespace SVG válido');
  const viewBox = root
    .getAttribute('viewBox')
    ?.trim()
    .split(/[\s,]+/)
    .map(Number);
  if (
    !viewBox ||
    viewBox.length !== 4 ||
    viewBox.some((value) => !Number.isFinite(value)) ||
    viewBox[2] <= 0 ||
    viewBox[3] <= 0
  )
    throw new Error('SVG necesita un viewBox válido');
  const allowed = new Set([
    'svg',
    'g',
    'title',
    'desc',
    'path',
    'rect',
    'circle',
    'ellipse',
    'polyline',
    'polygon',
    'line',
  ]);
  const geometry = new Set(['path', 'rect', 'circle', 'ellipse', 'polyline', 'polygon', 'line']);

  const elements = Array.from(doc.querySelectorAll('*'));
  for (const element of elements) {
    if (
      element.namespaceURI !== namespace ||
      !allowed.has(element.localName) ||
      (element.localName === 'svg' && element !== root)
    )
      throw new Error('SVG contiene elementos no permitidos; convierte el dibujo a paths');
    for (const attribute of Array.from(element.attributes)) {
      if (
        /^on|href|^style$|^transform$/i.test(attribute.localName) ||
        /url\s*\(/i.test(attribute.value) ||
        attribute.namespaceURI === 'http://www.w3.org/XML/1998/namespace'
      )
        throw new Error(
          'Aplana transformaciones y elimina estilos y referencias externas antes de importar',
        );
    }
  }
  const strokes: { name: string; path: SVGPathElement; length: number }[] = [];
  let candidates = 0;
  for (const element of elements) {
    if (!geometry.has(element.localName)) continue;
    if (element.closest('[data-epicycle-layer="grid"], [data-epicycle-layer="background"]'))
      continue;
    const parts = splitSvgSubpaths(shapeData(element));
    for (const [partIndex, data] of parts.entries()) {
      if (++candidates > 64) throw new Error('SVG admite un máximo de 64 trazos');
      const path = document.createElementNS(namespace, 'path');
      path.setAttribute('d', data);
      const length = path.getTotalLength();
      if (!Number.isFinite(length)) throw new Error('Geometría SVG inválida');
      if (length <= 1e-9) continue;
      const name = element.id || `Trazo ${candidates}`;
      strokes.push({ name: parts.length > 1 ? `${name} · ${partIndex + 1}` : name, path, length });
    }
  }
  if (!strokes.length) throw new Error('SVG no contiene trazos con longitud');
  const maximum = Math.max(...strokes.map((stroke) => stroke.length));
  const total = strokes.reduce((sum, stroke) => sum + stroke.length / maximum, 0);
  const remaining = 4096 - 8 * strokes.length;
  return strokes.map((stroke, index) => {
    const count = 8 + Math.floor((remaining * (stroke.length / maximum)) / total);
    const points = Array.from({ length: count }, (_, sample): Vec2 => {
      const point = stroke.path.getPointAtLength(stroke.length * (sample / (count - 1)));
      if (!Number.isFinite(point.x) || !Number.isFinite(point.y))
        throw new Error('Geometría SVG inválida');
      return [point.x, -point.y];
    });
    return { id: `svg-${index + 1}`, name: stroke.name, points };
  });
}
