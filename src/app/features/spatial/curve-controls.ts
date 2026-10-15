import { CatmullRomCurve3, Vector3 } from 'three';
import { Vec3 } from '../../domain/model';
export function buildSpatialPolyline(
  points: readonly Vec3[],
  interpolation: 'polyline' | 'centripetal',
  closed: boolean,
): readonly Vec3[] {
  if (points.length < 4 || points.length > 256)
    throw new Error('Editor espacial: entre 4 y 256 controles');
  if (interpolation === 'polyline') return points;
  const curve = new CatmullRomCurve3(
    points.map((p) => new Vector3(...p)),
    closed,
    'centripetal',
  );
  return Array.from({ length: 2048 }, (_, i) => {
    const p = curve.getPoint(i / (closed ? 2048 : 2047));
    return [p.x, p.y, p.z] as const;
  });
}
