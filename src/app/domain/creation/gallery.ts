import type { Vec2 } from '../model';
import { normalizeDrawing } from './continuous-route';
import type { DrawingDraft } from './types';

export type GalleryCategory = 'all' | 'nature' | 'portraits' | 'geometry';
export interface GalleryItem {
  readonly id: string;
  readonly name: string;
  readonly category: Exclude<GalleryCategory, 'all'>;
  readonly description: string;
}
export const GALLERY: readonly GalleryItem[] = [
  {
    id: 'profile',
    name: 'Perfil de musa',
    category: 'portraits',
    description: 'Retrato de perfil, cabello ondulado y ojo almendrado.',
  },
  {
    id: 'bird',
    name: 'Colibrí en vuelo',
    category: 'nature',
    description: 'Alas desplegadas, pico fino y plumas en abanico.',
  },
  {
    id: 'landscape',
    name: 'Valle al amanecer',
    category: 'nature',
    description: 'Cumbres, sendero sinuoso y sol sobre el horizonte.',
  },
  {
    id: 'flower',
    name: 'Flor de ocho pétalos',
    category: 'nature',
    description: 'Corola radial, tallo curvo y dos hojas.',
  },
  {
    id: 'spiral',
    name: 'Nautilo',
    category: 'geometry',
    description: 'Espiral logarítmica con cámaras radiales.',
  },
  {
    id: 'butterfly',
    name: 'Mariposa de jardín',
    category: 'nature',
    description: 'Cuatro alas simétricas con nervaduras y antenas.',
  },
  {
    id: 'skyline',
    name: 'Ciudad nocturna',
    category: 'geometry',
    description: 'Torres escalonadas, ventanas y luna creciente.',
  },
  {
    id: 'fish',
    name: 'Pez de arrecife',
    category: 'nature',
    description: 'Silueta de pez, branquias y aletas plegadas.',
  },
];

function parametric(count: number, point: (t: number) => Vec2): Vec2[] {
  return Array.from({ length: count + 1 }, (_, i) => point(i / count));
}
function ellipse(cx: number, cy: number, rx: number, ry: number): Vec2[] {
  return parametric(80, (t) => [
    cx + rx * Math.cos(t * Math.PI * 2),
    cy + ry * Math.sin(t * Math.PI * 2),
  ]);
}
function illustration(id: string, variation: number): Vec2[][] {
  const v = (variation % 7) / 7;
  switch (id) {
    case 'profile':
      return [
        [
          [-0.8, -1],
          [-0.3, -0.83],
          [-0.25, -0.5],
          [-0.47, -0.2],
          [-0.5, 0.3],
          [-0.38, 0.75],
          [-0.08, 1],
          [0.3, 1.02],
          [0.6, 0.8],
          [0.63, 0.52],
          [0.58, 0.35],
          [0.82, 0.08],
          [0.96, 0],
          [0.75, -0.07],
          [0.72, -0.2],
          [0.83, -0.25],
          [0.72, -0.31],
          [0.68, -0.48],
          [0.45, -0.57],
          [0.24, -0.53],
          [0.25, -0.83],
          [0.8, -1],
        ],
        [
          [0.32, 0.34],
          [0.48, 0.41],
          [0.63, 0.33],
          [0.48, 0.29],
          [0.32, 0.34],
        ],
        ellipse(0.5, 0.34, 0.025, 0.045),
        parametric(160, (t) => [-0.45 - 0.13 * Math.sin(t * Math.PI * (8 + v)), 0.8 - t * 1.5]),
        [
          [-0.23, 0.26],
          [-0.1, 0.35],
          [0.02, 0.25],
          [0, -0.03],
          [-0.1, -0.14],
          [-0.2, -0.02],
        ],
        [
          [-0.3, -0.81],
          [0.01, -0.97],
          [0.25, -0.83],
        ],
      ];
    case 'bird':
      return [
        [
          [-1, 0.8],
          [-0.68, 0.66],
          [-0.3, 0.58],
          [0.03, 0.34],
          [0.2, 0.14],
          [0.42, 0.2],
          [0.53, 0.37],
          [0.72, 0.45],
          [1.14, 0.38],
          [0.76, 0.31],
          [0.66, 0.1],
          [0.48, -0.1],
          [0.12, -0.25],
          [-0.1, -0.55],
          [-0.55, -0.86],
          [-0.38, -0.49],
          [-0.72, -0.62],
          [-0.37, -0.23],
          [-0.25, 0.02],
          [-0.57, 0.23],
          [-1, 0.8],
        ],
        [
          [-0.22, 0.42],
          [-0.27, 0.91],
          [0.02, 0.73],
          [0.18, 0.37],
          [0.2, 0.14],
        ],
        ...Array.from({ length: 6 }, (_, i): Vec2[] => [
          [0.02, 0.08],
          [-0.77 + i * 0.09, 0.65 - i * 0.065],
        ]),
        ellipse(0.64, 0.32, 0.025, 0.025),
      ];
    case 'landscape':
      return [
        [
          [-1, -0.5],
          [-1, 0.05],
          [-0.78, 0.37],
          [-0.58, 0.12],
          [-0.2, 0.9],
          [0.15, 0.32],
          [0.42, 0.65],
          [0.9, 0.1],
          [1, 0.04],
          [1, -0.5],
        ],
        [
          [-0.4, 0.48],
          [-0.2, 0.4],
          [-0.08, 0.52],
          [0.02, 0.45],
        ],
        parametric(100, (t) => [(0.42 - 0.7 * t) * Math.sin(t * 5 + v), 0.07 - t * 0.9]),
        parametric(60, (t) => [
          0.52 + 0.16 * Math.cos(Math.PI * t),
          0.49 + 0.16 * Math.sin(Math.PI * t),
        ]),
        [
          [-1, -0.5],
          [-0.5, -0.32],
          [-0.12, -0.4],
          [0.28, -0.25],
          [0.7, -0.3],
          [1, -0.22],
        ],
      ];
    case 'flower':
      return [
        parametric(480, (t) => {
          const a = t * Math.PI * 2;
          const r = 0.43 + 0.25 * Math.cos(8 * a);
          return [r * Math.cos(a), 0.4 + r * Math.sin(a)];
        }),
        ellipse(0, 0.4, 0.15, 0.15),
        parametric(100, (t) => [0.09 * Math.sin(t * 3), 0.24 - t * 1.4]),
        [
          [0.08, -0.5],
          [0.5, -0.3],
          [0.37, -0.66],
          [0.08, -0.5],
          [-0.34, -0.63],
          [-0.5, -0.37],
          [0.08, -0.5],
        ],
      ];
    case 'spiral': {
      const point = (t: number): Vec2 => {
        const a = t * Math.PI * (8 + v);
        const r = 0.05 * Math.exp(3 * t);
        return [r * Math.cos(a), r * Math.sin(a)];
      };
      return [
        parametric(700, point),
        ...Array.from({ length: 24 }, (_, i): Vec2[] => {
          const t = (i + 1) / 24;
          return [point(t), point(Math.max(0, t - 0.25))];
        }),
      ];
    }
    case 'butterfly': {
      const wings: Vec2[][] = [];
      for (const side of [-1, 1]) {
        wings.push([
          [0, 0.2],
          [side * 0.4, 0.88],
          [side * 0.83, 1],
          [side, 0.72],
          [side * 0.93, 0.3],
          [side * 0.56, 0.06],
          [side * 0.86, -0.2],
          [side * 0.79, -0.58],
          [side * 0.47, -0.72],
          [side * 0.19, -0.47],
          [0, -0.12],
        ]);
        wings.push([
          [0, 0.14],
          [side * 0.56, 0.68],
          [side * 0.74, 0.67],
          [side * 0.64, 0.39],
          [0, 0.14],
          [side * 0.5, -0.25],
          [side * 0.57, -0.5],
          [side * 0.31, -0.36],
          [0, 0.14],
        ]);
        wings.push([
          [0, 0.25],
          [side * 0.09, 0.54],
          [side * 0.22, 0.64],
        ]);
      }
      return [ellipse(0, -0.04, 0.055, 0.38), ...wings];
    }
    case 'skyline':
      return [
        [
          [-1, -0.6],
          [-1, 0.04],
          [-0.8, 0.04],
          [-0.8, 0.42],
          [-0.53, 0.42],
          [-0.53, 0.13],
          [-0.35, 0.13],
          [-0.35, 0.8],
          [-0.21, 0.8],
          [-0.21, 1],
          [-0.16, 0.8],
          [-0.02, 0.8],
          [-0.02, -0.02],
          [0.16, -0.02],
          [0.16, 0.47],
          [0.38, 0.47],
          [0.38, 0.64],
          [0.58, 0.64],
          [0.58, 0.25],
          [0.82, 0.25],
          [0.82, 0.05],
          [1, 0.05],
          [1, -0.6],
          [-1, -0.6],
        ],
        ...[-0.68, -0.22, 0.26, 0.48, 0.7].flatMap((x) =>
          Array.from({ length: 3 }, (_, i): Vec2[] => [
            [x, -0.39 + i * 0.17],
            [x + 0.06, -0.39 + i * 0.17],
          ]),
        ),
        parametric(60, (t) => [
          0.75 + 0.13 * Math.cos(t * Math.PI * 1.7 + 0.6),
          0.86 + 0.13 * Math.sin(t * Math.PI * 1.7 + 0.6),
        ]),
      ];
    case 'fish':
      return [
        [
          [-0.8, 0],
          [-0.55, 0.28],
          [-0.15, 0.45],
          [0.28, 0.39],
          [0.65, 0.17],
          [1, 0.48],
          [0.89, 0],
          [1, -0.45],
          [0.65, -0.16],
          [0.22, -0.37],
          [-0.21, -0.38],
          [-0.58, -0.21],
          [-0.8, 0],
        ],
        [
          [-0.14, 0.43],
          [0.06, 0.76],
          [0.41, 0.57],
          [0.29, 0.39],
        ],
        [
          [-0.02, -0.38],
          [0.21, -0.64],
          [0.4, -0.48],
          [0.32, -0.33],
        ],
        [
          [-0.39, 0.29],
          [-0.25, 0.12],
          [-0.24, -0.12],
          [-0.4, -0.29],
        ],
        ellipse(-0.54, 0.09, 0.045, 0.045),
        [
          [-0.12, 0],
          [0.25, 0.16],
          [0.1, -0.14],
          [-0.12, 0],
        ],
        ...[0, 1, 2, 3].map((i): Vec2[] => [
          [0.05 + i * 0.1, 0.7 - i * 0.04],
          [0.12 + i * 0.07, 0.42],
        ]),
      ];
    default:
      throw new Error(`Unknown gallery drawing: ${id}`);
  }
}

export function getGalleryDrawing(id: string, variation = 0): DrawingDraft {
  const item = GALLERY.find((entry) => entry.id === id);
  if (!item) throw new Error(`Unknown gallery drawing: ${id}`);
  if (!Number.isSafeInteger(variation) || variation < 0)
    throw new Error('Variation must be a nonnegative integer.');
  const strokes = illustration(id, variation);
  const lean = (variation % 7) * 0.025;
  const normalized = normalizeDrawing(strokes.flat().map(([x, y]): Vec2 => [x + lean * y, y]));
  let offset = 0;
  return {
    name: item.name,
    closure: 'return',
    strokes: strokes.map((stroke) => {
      const result = normalized.slice(offset, offset + stroke.length);
      offset += stroke.length;
      return result;
    }),
  };
}
