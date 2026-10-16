import { StudioStore } from './studio-store';
import { CanvasRenderer } from '../drawing-2d/canvas-renderer';
import type { ThreeRenderer } from '../spatial/three-renderer';

export interface CaptureSettings {
  lineWeight: number;
  background: 'dark' | 'black' | 'transparent';
  grid: boolean;
  zoom: number;
  framing: 'fit' | 'current';
  aspect: 'landscape' | 'square' | 'portrait';
}
export const defaultCapture = (): CaptureSettings => ({
  background: 'dark',
  lineWeight: 1.5,
  grid: false,
  zoom: 1,
  framing: 'fit',
  aspect: 'landscape',
});
export function captureSize(settings: CaptureSettings): [number, number] {
  return settings.aspect === 'square'
    ? [1080, 1080]
    : settings.aspect === 'portrait'
      ? [720, 1280]
      : [1280, 720];
}
export async function createCaptureScene(
  source: StudioStore,
  flat: CanvasRenderer | null,
  spatial: ThreeRenderer | null,
  settings: CaptureSettings,
  scale = 1,
) {
  if (!source.reconstruction)
    throw new Error('No hay una curva calculada para exportar. Reintenta el cálculo.');
  const snapshot = new StudioStore();
  const p = structuredClone(source.snapshot());
  p.appearance.grid = settings.grid;
  p.appearance.width = Math.min(6, p.appearance.width * settings.lineWeight);
  snapshot.project.set(p);
  snapshot.offset = structuredClone(source.offset);
  snapshot.terms = structuredClone(source.terms);
  snapshot.circles3 = structuredClone(source.circles3);
  snapshot.harmonics = structuredClone(source.harmonics);
  snapshot.reconstruction = structuredClone(source.reconstruction);
  snapshot.reference = structuredClone(source.reference);
  const canvas = document.createElement('canvas');
  const [w, h] = captureSize(settings);
  let renderer: CanvasRenderer | ThreeRenderer | null = null;
  try {
    if (spatial) {
      const { ThreeRenderer } = await import('../spatial/three-renderer');
      const next = new ThreeRenderer(canvas, snapshot, () => undefined);
      renderer = next;
      next.resize(w, h, scale);
      next.fit();
      next.exportStyle = true;
      next.lineWeight = settings.lineWeight;
      if (settings.framing === 'fit' && w < h) {
        next.camera.zoom *= w / h;
      }
      if (settings.framing === 'current') {
        next.camera.position.copy(spatial.camera.position);
        next.camera.zoom = spatial.camera.zoom;
        next.controls.target.copy(spatial.controls.target);
      }
      next.camera.zoom *= settings.zoom;
      next.camera.updateProjectionMatrix();
      next.controls.update();
      next.background = settings.background === 'black' ? '#000000' : '#151515';
      next.transparent = settings.background === 'transparent';
    } else {
      const next = new CanvasRenderer(canvas, snapshot);
      renderer = next;
      next.resize(w, h, scale);
      next.fit();
      if (settings.framing === 'current' && flat) {
        next.viewport.center = [...flat.viewport.center];
        next.viewport.scale =
          flat.viewport.scale * Math.min(w / flat.viewport.width, h / flat.viewport.height);
        next.viewport.zoom = flat.viewport.zoom;
      }
      next.viewport.zoom *= settings.zoom;
      next.orbitWidth = 1.25 * settings.lineWeight;
      next.orbitColor = '#969ca8';
      next.vectorColor = '#d0d4dd';
      next.transparent = settings.background === 'transparent';
      next.background = settings.background === 'black' ? '#000000' : '#151515';
    }
    const active = renderer;
    return {
      canvas,
      renderer: active,
      render: (phase: number) => active.render(phase),
      dispose: () => {
        active.dispose();
        snapshot.dispose();
      },
    };
  } catch (error) {
    renderer?.dispose();
    snapshot.dispose();
    throw error;
  }
}
