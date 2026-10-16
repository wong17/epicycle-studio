import { z } from 'zod';
import { prepareCurve } from '../curves/prepare-curve';
const number = z.number().finite(),
  coordinate = number.min(-1e6).max(1e6),
  vec2 = z.tuple([coordinate, coordinate]),
  vec3 = z.tuple([coordinate, coordinate, coordinate]);
const circle = z.strictObject({
  id: z.string().uuid(),
  frequency: z
    .number()
    .int()
    .min(-128)
    .max(128)
    .refine((x) => x !== 0),
  radius: number.min(0).max(2),
  phase: number.min(0).max(Math.PI * 2),
});
const axis = z.tuple([number, number, number]);
const spatialCircle = circle
  .extend({ axisU: axis, axisV: axis })
  .refine(
    (c) =>
      Math.abs(Math.hypot(...c.axisU) - 1) <= 1e-6 &&
      Math.abs(Math.hypot(...c.axisV) - 1) <= 1e-6 &&
      Math.abs(c.axisU.reduce((s, x, i) => s + x * c.axisV[i], 0)) <= 1e-6,
    'La base del círculo debe ser ortonormal',
  );
const source = z.discriminatedUnion('kind', [
  z.strictObject({
    kind: z.literal('curve2d'),
    strokeStarts: z.array(z.number().int().min(0).max(9999)).max(10000).optional(),
    points: z.array(vec2).min(3).max(10000),
    closure: z.enum(['segment', 'return']),
  }),
  z.strictObject({
    kind: z.literal('curve3d'),
    points: z.array(vec3).min(4).max(256),
    closure: z.enum(['segment', 'return']),
    interpolation: z.enum(['polyline', 'centripetal']),
    closed: z.boolean().optional(),
    provenance: z
      .strictObject({
        sourceId: z.string().uuid(),
        operation: z.literal('lift2d'),
        reductionRms: number.min(0),
        reductionMax: number.min(0),
        amplitude: number.min(0).max(2),
        frequency: z.number().int().min(1).max(32),
        phase: number.min(0).max(Math.PI * 2),
      })
      .optional(),
  }),
  z.strictObject({
    kind: z.literal('manual2d'),
    offset: vec2,
    circles: z.array(circle).min(1).max(32),
  }),
  z.strictObject({
    kind: z.literal('manual3d'),
    offset: vec3,
    circles: z.array(spatialCircle).min(1).max(32),
  }),
]);
export const projectSchema = z
  .strictObject({
    format: z.literal('epicycle-studio'),
    schemaVersion: z.literal(2),
    id: z.string().uuid(),
    name: z.string().trim().min(1).max(80),
    createdAt: z.iso.datetime(),
    updatedAt: z.iso.datetime(),
    dimension: z.union([z.literal(2), z.literal(3)]),
    source,
    analysis: z.strictObject({
      sampleCount: z.union([z.literal(256), z.literal(512), z.literal(1024), z.literal(2048)]),
      count: z.number().int().min(1).max(2047),
      order: z.enum(['amplitude', 'frequency']),
    }),
    appearance: z.strictObject({
      theme: z.enum(['dark', 'light']),
      color: z.enum(['#d4f477', '#ffa68b', '#89dce6']),
      colorMode: z.enum(['solid', 'spectrum']).optional(),
      width: number.min(1).max(6),
      original: z.boolean(),
      reconstruction: z.boolean(),
      trace: z.boolean(),
      circles: z.boolean(),
      vectors: z.boolean(),
      grid: z.boolean(),
      sculpture: z.boolean(),
      tubeRadius: number.min(0.002).max(0.1),
      tolerance: z.union([z.literal(0.005), z.literal(0.01), z.literal(0.02)]).optional(),
      representation: z.enum(['ellipses', 'circles']),
    }),
    playback: z.strictObject({ speed: number.min(0.25).max(4), phase: number.min(0).max(1) }),
    view: z.strictObject({
      zoom: number.min(0.1).max(10),
      center: vec3,
      camera: z.enum(['perspective', 'xy', 'xz', 'yz']),
      plane: z.enum(['xy', 'xz', 'yz']),
      scale: number.min(1e-9).max(1e9).optional(),
      position: vec3.optional(),
      target: vec3.optional(),
    }),
  })
  .superRefine((p, ctx) => {
    if (p.source.kind === 'curve2d' && p.source.strokeStarts) {
      const starts = p.source.strokeStarts;
      const length = p.source.points.length;
      if (
        !starts.length ||
        starts[0] !== 0 ||
        starts.some((value, index) => value >= length || (index > 0 && value <= starts[index - 1]))
      )
        ctx.addIssue({ code: 'custom', message: 'Índices de trazos inválidos' });
    }
    if (p.source.kind === 'curve2d' || p.source.kind === 'curve3d') {
      try {
        prepareCurve(
          p.source.points,
          p.source.kind === 'curve2d' ? 2 : 3,
          p.source.closure,
          p.analysis.sampleCount,
        );
      } catch (error) {
        ctx.addIssue({
          code: 'custom',
          message: error instanceof Error ? error.message : 'Curva inválida',
          path: ['source', 'points'],
        });
      }
    }
    if ((p.dimension === 2) !== p.source.kind.endsWith('2d'))
      ctx.addIssue({ code: 'custom', message: 'Dimensión y fuente incompatibles' });
    if (
      p.analysis.count >
      (p.dimension === 2 ? p.analysis.sampleCount - 1 : p.analysis.sampleCount / 2)
    )
      ctx.addIssue({ code: 'custom', message: 'Cantidad de componentes fuera de rango' });
  });
export type Project = z.infer<typeof projectSchema>;
export type Source = Project['source'];
export function exportProjectV1(p: Project): unknown {
  if (p.dimension !== 2) throw new Error('V1 sólo admite proyectos 2D');
  const { sculpture, tubeRadius, representation, tolerance, colorMode, ...appearance } =
    p.appearance;
  void sculpture;
  void tubeRadius;
  void representation;
  void tolerance;
  void colorMode;
  return {
    ...p,
    schemaVersion: 1,
    source:
      p.source.kind === 'curve2d'
        ? { kind: 'curve2d', points: p.source.points, closure: p.source.closure }
        : p.source,
    appearance,
    view: { zoom: p.view.zoom, center: [p.view.center[0], p.view.center[1]] },
  };
}
export function migrateProject(input: unknown): Project {
  if (
    typeof input === 'object' &&
    input !== null &&
    'schemaVersion' in input &&
    input.schemaVersion === 1
  ) {
    if ('dimension' in input && input.dimension !== 2)
      throw new Error('V1 sólo admite proyectos 2D');
    const old = z
      .strictObject({
        format: z.literal('epicycle-studio'),
        schemaVersion: z.literal(1),
        id: z.string().uuid(),
        name: z.string().min(1).max(80),
        createdAt: z.iso.datetime(),
        updatedAt: z.iso.datetime(),
        dimension: z.literal(2),
        source,
        analysis: projectSchema.shape.analysis,
        appearance: projectSchema.shape.appearance
          .omit({ sculpture: true, tubeRadius: true, representation: true })
          .extend({
            sculpture: z.boolean().optional(),
            tubeRadius: number.min(0.002).max(0.1).optional(),
            representation: z.enum(['ellipses', 'circles']).optional(),
          }),
        view: z.strictObject({
          zoom: number.min(0.1).max(10),
          center: z.union([vec2, vec3]),
          camera: z.enum(['perspective', 'xy', 'xz', 'yz']).optional(),
          plane: z.enum(['xy', 'xz', 'yz']).optional(),
        }),
        playback: projectSchema.shape.playback,
      })
      .parse(input);
    return projectSchema.parse({
      ...old,
      schemaVersion: 2,
      appearance: {
        sculpture: false,
        tubeRadius: 0.015,
        representation: 'ellipses',
        ...old.appearance,
      },
      view: {
        ...old.view,
        center: [old.view.center[0], old.view.center[1], old.view.center[2] ?? 0],
        camera: old.view.camera ?? 'perspective',
        plane: old.view.plane ?? 'xy',
      },
    });
  }
  return projectSchema.parse(input);
}
export function parseProject(text: string): Project {
  if (new TextEncoder().encode(text).length > 1048576)
    throw new Error('Proyecto demasiado grande: máximo 1 MiB');
  return migrateProject(JSON.parse(text));
}
export function createProject(dimension: 2 | 3, source: Source, name = 'Sin título'): Project {
  const now = new Date().toISOString();
  return projectSchema.parse({
    format: 'epicycle-studio',
    schemaVersion: 2,
    id: crypto.randomUUID(),
    name,
    createdAt: now,
    updatedAt: now,
    dimension,
    source,
    analysis: { sampleCount: 512, count: dimension === 2 ? 64 : 32, order: 'amplitude' },
    appearance: {
      theme: 'dark',
      color: '#d4f477',
      width: 2,
      original: false,
      reconstruction: true,
      trace: true,
      circles: true,
      vectors: true,
      grid: true,
      sculpture: false,
      tubeRadius: 0.015,
      representation: 'ellipses',
    },
    playback: { speed: 1, phase: 0 },
    view: { zoom: 1, center: [0, 0, 0], camera: 'perspective', plane: 'xy' },
  });
}
