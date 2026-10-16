import type { Vec2 } from '../model';
import { normalizeDrawing } from './continuous-route';
import type { DrawingDraft } from './types';

// Original single-width pen paths on a four by six grid; | means pen lift.
// Lowercase and accented Latin letters are deliberately rendered as capitals.
const GLYPHS: Readonly<Record<string, string>> = {
  A: '0,0 2,6 4,0|1,2 3,2',
  B: '0,0 0,6 2.5,6 4,5 4,4 2.5,3 0,3|2.5,3 4,2 4,1 2.5,0 0,0',
  C: '4,5 3,6 1,6 0,5 0,1 1,0 3,0 4,1',
  D: '0,0 0,6 2,6 4,4.5 4,1.5 2,0 0,0',
  E: '4,6 0,6 0,0 4,0|0,3 3,3',
  F: '0,0 0,6 4,6|0,3 3,3',
  G: '4,5 3,6 1,6 0,5 0,1 1,0 4,0 4,3 2,3',
  H: '0,0 0,6|4,0 4,6|0,3 4,3',
  I: '0,6 4,6|2,6 2,0|0,0 4,0',
  J: '0,1 1,0 3,0 4,1 4,6|2,6 4,6',
  K: '0,0 0,6|4,6 0,2 4,0',
  L: '0,6 0,0 4,0',
  M: '0,0 0,6 2,3 4,6 4,0',
  N: '0,0 0,6 4,0 4,6',
  O: '1,0 0,1 0,5 1,6 3,6 4,5 4,1 3,0 1,0',
  P: '0,0 0,6 3,6 4,5 4,4 3,3 0,3',
  Q: '1,0 0,1 0,5 1,6 3,6 4,5 4,1 3,0 1,0|2,2 4,-1',
  R: '0,0 0,6 3,6 4,5 4,4 3,3 0,3|2,3 4,0',
  S: '4,5 3,6 1,6 0,5 0,4 1,3 3,3 4,2 4,1 3,0 1,0 0,1',
  T: '0,6 4,6|2,6 2,0',
  U: '0,6 0,1 1,0 3,0 4,1 4,6',
  V: '0,6 2,0 4,6',
  W: '0,6 1,0 2,3 3,0 4,6',
  X: '0,6 4,0|0,0 4,6',
  Y: '0,6 2,3 4,6|2,3 2,0',
  Z: '0,6 4,6 0,0 4,0',
  '0': '1,0 0,1 0,5 1,6 3,6 4,5 4,1 3,0 1,0|0.5,0.5 3.5,5.5',
  '1': '0,4 2,6 2,0|0,0 4,0',
  '2': '0,5 1,6 3,6 4,5 4,4 0,0 4,0',
  '3': '0,6 3,6 4,5 4,4 3,3 1,3|3,3 4,2 4,1 3,0 0,0',
  '4': '3,0 3,6 0,2 4,2',
  '5': '4,6 0,6 0,3 3,3 4,2 4,1 3,0 0,0',
  '6': '4,5 3,6 1,6 0,4 0,1 1,0 3,0 4,1 4,2 3,3 0,3',
  '7': '0,6 4,6 1,0',
  '8': '1,3 0,4 0,5 1,6 3,6 4,5 4,4 3,3 1,3 0,2 0,1 1,0 3,0 4,1 4,2 3,3',
  '9': '4,3 1,3 0,4 0,5 1,6 3,6 4,5 4,1 3,0 1,0',
  '.': '1.8,0 2.2,0',
  ',': '2,0.5 1.5,-1',
  ':': '1.8,4 2.2,4|1.8,1 2.2,1',
  ';': '1.8,4 2.2,4|2,1 1.5,-0.5',
  '!': '2,6 2,2|1.8,0 2.2,0',
  '?': '0,5 1,6 3,6 4,5 4,4 2,3 2,2|1.8,0 2.2,0',
  '¿': '0,1 1,0 3,0 4,1 4,2 2,3 2,4|1.8,6 2.2,6',
  '¡': '2,0 2,4|1.8,6 2.2,6',
  "'": '2,6 1.5,4.5',
  '"': '1,6 1,4.5|3,6 3,4.5',
  '-': '0,3 4,3',
  _: '0,0 4,0',
  '+': '0,3 4,3|2,5 2,1',
  '=': '0,4 4,4|0,2 4,2',
  '/': '0,0 4,6',
  '\\': '0,6 4,0',
  '(': '3,6 1,4 1,2 3,0',
  ')': '1,6 3,4 3,2 1,0',
  '[': '3,6 1,6 1,0 3,0',
  ']': '1,6 3,6 3,0 1,0',
  '<': '4,5 0,3 4,1',
  '>': '0,5 4,3 0,1',
  '&': '4,0 1,4 1,5 2,6 3,5 3,4 0,2 0,1 1,0 2,0 4,3',
  '#': '1,0 2,6|2.5,0 3.5,6|0,2 4,2|0,4 4,4',
  '%': '0,0 4,6|0,5 0,6 1,6 1,5 0,5|3,0 3,1 4,1 4,0 3,0',
  '@': '3,1 3,4 1,4 1,2 3,2 4,2 4,5 3,6 1,6 0,5 0,1 1,0 4,0',
  '*': '2,5 2,1|0,4 4,2|0,2 4,4',
};

export function createTextDrawing(text: string): DrawingDraft {
  const original = text.replace(/\r\n?/g, '\n');
  if (Array.from(original).length > 80) throw new Error('Text must contain at most 80 characters.');
  if (!original.trim()) throw new Error('Enter text to draw.');
  const rendered = original
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase();
  const strokes: Vec2[][] = [];
  let column = 0,
    line = 0;
  for (const character of rendered) {
    if (character === '\n') {
      column = 0;
      line++;
      continue;
    }
    if (character === ' ') {
      column++;
      continue;
    }
    const glyph = GLYPHS[character];
    if (!glyph) throw new Error(`Unsupported character: ${character}`);
    for (const pen of glyph.split('|')) {
      strokes.push(
        pen.split(' ').map((coordinate): Vec2 => {
          const [x, y] = coordinate.split(',').map(Number);
          return [x + column * 6, y - line * 10];
        }),
      );
    }
    column++;
  }
  // A segment still needs three editable samples for the curve project schema.
  if (strokes.length === 1 && strokes[0].length === 2) {
    const [start, end] = strokes[0];
    strokes[0].splice(1, 0, [(start[0] + end[0]) / 2, (start[1] + end[1]) / 2]);
  }
  const normalized = normalizeDrawing(strokes.flat());
  let offset = 0;
  return {
    name: `Texto: ${original.trim().replace(/\s+/g, ' ')}`.slice(0, 80),
    closure: 'return',
    strokes: strokes.map((stroke) => {
      const result = normalized.slice(offset, offset + stroke.length);
      offset += stroke.length;
      return result;
    }),
  };
}
