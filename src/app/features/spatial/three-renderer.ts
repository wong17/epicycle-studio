import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { TransformControls } from 'three/addons/controls/TransformControls.js';
import { StudioStore } from '../studio/studio-store';
import { harmonicToCircles, evaluateCircle3, norm, TAU } from '../../domain/fourier/math';
import { Vec3, Point, Circle3, CurveSamples } from '../../domain/model';
import { planTessellation } from '../../domain/curves/tessellation';
import { createManualCurve3, createFourierCurve3 } from '../../domain/curves/curve-evaluator';
type RenderModel = Pick<
  StudioStore,
  | 'project'
  | 'reconstruction'
  | 'reference'
  | 'terms'
  | 'circles3'
  | 'harmonics'
  | 'offset'
  | 'evaluate'
  | 'pause'
  | 'notice'
>;
export class ThreeRenderer {
  static liveCount = 0;
  private disposed = false;
  private cachedCircles: Circle3[] | null = null;
  private vectors: THREE.LineSegments | null = null;
  private lastSamples: CurveSamples | null = null;
  private appearanceKey = '';
  readonly renderer: THREE.WebGLRenderer;
  readonly scene = new THREE.Scene();
  camera: THREE.PerspectiveCamera | THREE.OrthographicCamera;
  controls: OrbitControls;
  private transform: TransformControls;
  private content = new THREE.Group();
  private chain: THREE.Line[] = [];
  private points: THREE.Mesh[] = [];
  private tip: THREE.Mesh;
  private trace: THREE.Line | null = null;
  private width = 1;
  private height = 1;
  private radius = 1;
  private center = new THREE.Vector3();
  private geometryVersion = 0;
  private dragStart: Point[] | null = null;
  sculpture: THREE.Mesh | null = null;
  tubeError = '';
  edit = false;
  depth = 0;
  constructor(
    readonly canvas: HTMLCanvasElement,
    private store: RenderModel,
    private onPoint: (index: number, p: Vec3) => void,
  ) {
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
    ThreeRenderer.liveCount++;
    this.renderer.setClearColor('#151515');
    this.camera = new THREE.PerspectiveCamera(42, 1, 0.01, 1000);
    this.camera.position.set(3, 2, 4);
    this.controls = new OrbitControls(this.camera, canvas);
    this.controls.enableDamping = false;
    this.scene.add(this.content);
    this.scene.add(new THREE.HemisphereLight(0xffffff, 0x222222, 2.5));
    const light = new THREE.DirectionalLight(0xffffff, 3);
    light.position.set(3, 5, 4);
    this.scene.add(light);
    this.tip = new THREE.Mesh(
      new THREE.SphereGeometry(0.012, 12, 8),
      new THREE.MeshBasicMaterial({ color: 0xd4f477 }),
    );
    this.scene.add(this.tip);
    this.transform = new TransformControls(this.camera, canvas);
    this.transform.setSize(0.7);
    this.scene.add(this.transform.getHelper());
    this.transform.addEventListener('dragging-changed', (event) => {
      this.controls.enabled = !event.value;
      if (event.value) {
        this.store.pause();
        const source = this.store.project().source;
        this.dragStart = source.kind === 'curve3d' ? structuredClone(source.points) : null;
      } else if (this.transform.object && this.dragStart) {
        const index = this.points.indexOf(this.transform.object as THREE.Mesh),
          p = this.transform.object.position;
        this.onPoint(index, [p.x, p.y, p.z]);
        this.dragStart = null;
      }
    });
    canvas.addEventListener('click', this.click);
  }
  private click = (event: MouseEvent): void => {
    if (!this.edit || this.transform.dragging) return;
    const rect = this.canvas.getBoundingClientRect(),
      mouse = new THREE.Vector2(
        ((event.clientX - rect.left) / rect.width) * 2 - 1,
        (-(event.clientY - rect.top) / rect.height) * 2 + 1,
      ),
      ray = new THREE.Raycaster();
    ray.setFromCamera(mouse, this.camera);
    const hit = ray.intersectObjects(this.points, false)[0];
    if (hit) {
      this.transform.attach(hit.object);
      return;
    }
    const plane = this.store.project().view.plane,
      normal =
        plane === 'xy'
          ? new THREE.Vector3(0, 0, 1)
          : plane === 'xz'
            ? new THREE.Vector3(0, 1, 0)
            : new THREE.Vector3(1, 0, 0),
      p = new THREE.Vector3();
    if (!ray.ray.intersectPlane(new THREE.Plane(normal, -this.depth), p)) {
      this.store.notice.set('El rayo es paralelo al plano. Cambia la vista.');
      return;
    }
    this.onPoint(-1, [p.x, p.y, p.z]);
  };
  resize(w: number, h: number, dpr: number): void {
    this.width = w;
    this.height = h;
    this.renderer.setPixelRatio(Math.min(dpr, w < 600 ? 1.5 : 2));
    this.renderer.setSize(w, h, false);
    if (this.camera instanceof THREE.PerspectiveCamera) this.camera.aspect = w / h;
    else {
      this.camera.left = ((-this.radius * w) / h) * 1.35;
      this.camera.right = ((this.radius * w) / h) * 1.35;
      this.camera.top = this.radius * 1.35;
      this.camera.bottom = -this.radius * 1.35;
    }
    this.camera.updateProjectionMatrix();
  }
  fit(): void {
    const s = this.store.reconstruction;
    if (!s) return;
    const box = new THREE.Box3();
    for (let i = 0; i < s.count; i++)
      box.expandByPoint(
        new THREE.Vector3(s.coordinates[i * 3], s.coordinates[i * 3 + 1], s.coordinates[i * 3 + 2]),
      );
    box.getCenter(this.center);
    this.radius = Math.max(0.1, box.getSize(new THREE.Vector3()).length() / 2);
    this.setCamera(this.store.project().view.camera);
  }
  setCamera(view: string): void {
    this.controls.dispose();
    const aspect = this.width / this.height,
      r = this.radius;
    if (view === 'perspective') {
      this.camera = new THREE.PerspectiveCamera(42, aspect, r / 100, r * 100);
      this.camera.position
        .copy(this.center)
        .add(new THREE.Vector3(1.2, 0.85, 2.1).multiplyScalar(r));
    } else {
      this.camera = new THREE.OrthographicCamera(
        -r * aspect * 1.35,
        r * aspect * 1.35,
        r * 1.35,
        -r * 1.35,
        r / 100,
        r * 100,
      );
      const direction =
        view === 'xy'
          ? new THREE.Vector3(0, 0, 3)
          : view === 'xz'
            ? new THREE.Vector3(0, 3, 0)
            : new THREE.Vector3(3, 0, 0);
      this.camera.position.copy(this.center).addScaledVector(direction, r);
      this.camera.up.set(0, view === 'xz' ? 0 : 1, view === 'xz' ? -1 : 0);
    }
    this.camera.lookAt(this.center);
    this.controls = new OrbitControls(this.camera, this.canvas);
    this.controls.target.copy(this.center);
    this.controls.enableRotate = view === 'perspective';
    this.controls.update();
    this.transform.camera = this.camera;
  }
  zoom(factor: number): void {
    this.camera.position.sub(this.controls.target).multiplyScalar(factor).add(this.controls.target);
    if (this.camera instanceof THREE.OrthographicCamera) {
      this.camera.zoom /= factor;
      this.camera.updateProjectionMatrix();
    }
    this.controls.update();
  }
  rotate(): void {
    const offset = this.camera.position.clone().sub(this.controls.target);
    offset.applyAxisAngle(new THREE.Vector3(0, 1, 0), Math.PI / 8);
    this.camera.position.copy(this.controls.target).add(offset);
    this.controls.update();
  }
  private releaseContent(): void {
    this.transform.detach();
    this.content.traverse((object) => {
      if (object instanceof THREE.Mesh || object instanceof THREE.Line) {
        object.geometry.dispose();
        const materials = Array.isArray(object.material) ? object.material : [object.material];
        materials.forEach((m) => m.dispose());
      }
    });
    this.content.clear();
    this.chain = [];
    this.points = [];
    this.sculpture = null;
    this.trace = null;
    this.vectors = null;
  }
  private line(coordinates: Float64Array, color: string, closed = true): THREE.Line {
    const geometry = new THREE.BufferGeometry(),
      points = new Float32Array(coordinates.length + (closed ? 3 : 0));
    points.set(coordinates);
    if (closed) points.set(coordinates.slice(0, 3), coordinates.length);
    geometry.setAttribute('position', new THREE.BufferAttribute(points, 3));
    const line = new THREE.Line(
      geometry,
      new THREE.LineBasicMaterial({ color, depthWrite: false }),
    );
    this.content.add(line);
    return line;
  }
  rebuild(): void {
    const p = this.store.project(),
      s = this.store.reconstruction;
    if (!s) return;
    this.releaseContent();
    this.lastSamples = s;
    this.appearanceKey = JSON.stringify(p.appearance);
    this.renderer.setClearColor('#151515');
    const color = p.appearance.color;
    (this.tip.material as THREE.MeshBasicMaterial).color.set(color);
    if (p.appearance.original && this.store.reference)
      this.line(this.store.reference.coordinates, '#909090').renderOrder = 10;
    if (p.appearance.reconstruction) this.line(s.coordinates, color).renderOrder = 20;
    this.trace = this.line(s.coordinates, color, false);
    this.trace.renderOrder = 30;
    this.trace.visible = p.appearance.trace;
    const limit = this.width < 600 ? 48 : 64,
      manual = p.source.kind === 'manual3d',
      circles = manual
        ? this.store.circles3
        : p.appearance.representation === 'circles'
          ? this.store.harmonics.flatMap(harmonicToCircles)
          : null;
    const count = circles?.length ?? this.store.harmonics.length;
    this.cachedCircles = circles;
    const vectorGeometry = new THREE.BufferGeometry();
    vectorGeometry.setAttribute(
      'position',
      new THREE.BufferAttribute(new Float32Array(Math.min(count, limit) * 6), 3),
    );
    this.vectors = new THREE.LineSegments(
      vectorGeometry,
      new THREE.LineBasicMaterial({ color: '#b7b7b7', depthWrite: false }),
    );
    this.vectors.visible = p.appearance.vectors;
    this.content.add(this.vectors);
    if (p.appearance.grid) {
      const grid = new THREE.GridHelper(this.radius * 4, 16, 0x3b3b3b, 0x292929);
      grid.rotation.x = Math.PI / 2;
      grid.position.copy(this.center);
      const gridMaterials = Array.isArray(grid.material) ? grid.material : [grid.material];
      gridMaterials.forEach((material) => {
        material.depthWrite = false;
      });
      grid.renderOrder = -1;
      this.content.add(grid);
    }
    for (let i = 0; i < Math.min(count, limit); i++) {
      const coords = new Float64Array(65 * 3);
      for (let j = 0; j <= 64; j++) {
        const t = j / 64;
        const v = circles
          ? evaluateCircle3({ ...circles[i], frequency: 1 }, t)
          : (this.store.harmonics[i].a.map(
              (x, d) => x * Math.cos(TAU * t) + this.store.harmonics[i].b[d] * Math.sin(TAU * t),
            ) as unknown as Vec3);
        coords.set(v, j * 3);
      }
      const orbit = this.line(coords, '#6b6b6b', false);
      orbit.visible = p.appearance.circles;
      this.chain.push(orbit);
    }
    const source = p.source;
    if (source.kind === 'curve3d') {
      const markerRadius = this.radius * 0.012;
      for (const point of source.points) {
        const mesh = new THREE.Mesh(
          new THREE.SphereGeometry(markerRadius, 6, 4),
          new THREE.MeshBasicMaterial({ color: 0xffa68b }),
        );
        mesh.position.set(...point);
        mesh.visible = this.edit;
        this.content.add(mesh);
        this.points.push(mesh);
      }
    }
    this.tubeError = '';
    if (p.appearance.sculpture) {
      try {
        this.sculpture = this.buildTube();
        this.content.add(this.sculpture);
      } catch (error) {
        this.tubeError = error instanceof Error ? error.message : 'Tubo no disponible';
        this.store.notice.set(this.tubeError);
      }
    }
    this.geometryVersion++;
  }
  buildTube(): THREE.Mesh {
    const store = this.store,
      s = store.reconstruction!;
    const box = new THREE.Box3();
    for (let i = 0; i < s.count; i++)
      box.expandByPoint(
        new THREE.Vector3(s.coordinates[i * 3], s.coordinates[i * 3 + 1], s.coordinates[i * 3 + 2]),
      );
    const size = box.getSize(new THREE.Vector3()),
      D = Math.max(size.x, size.y, size.z);
    if (D < 1e-9) throw new Error('Curva puntual: no se puede crear un tubo');
    const evaluator =
      store.project().source.kind === 'manual3d'
        ? createManualCurve3(store.offset as Vec3, store.circles3)
        : createFourierCurve3(store.offset as Vec3, store.harmonics);
    const plan = planTessellation(
      evaluator.secondDerivativeBound,
      (store.project().appearance.tolerance ?? 0.005) * D,
    );
    if (!plan.withinBudget)
      throw new Error(
        'Esta curva supera 2048 segmentos. Reduce frecuencias o componentes antes de exportar.',
      );
    const evaluate = (t: number) => new THREE.Vector3(...evaluator.pointAt(t));
    class AnalyticCurve extends THREE.Curve<THREE.Vector3> {
      constructor() {
        super();
      }
      override getPoint(t: number, target = new THREE.Vector3()): THREE.Vector3 {
        return target.copy(evaluate(t));
      }
      override getPointAt(t: number, target = new THREE.Vector3()): THREE.Vector3 {
        return this.getPoint(t, target);
      }
      override getTangent(t: number, target = new THREE.Vector3()): THREE.Vector3 {
        return target.set(...evaluator.tangentAt(t)).normalize();
      }
      override getTangentAt(t: number, target = new THREE.Vector3()): THREE.Vector3 {
        return this.getTangent(t, target);
      }
    }
    const curve = new AnalyticCurve();
    for (let j = 0; j < plan.segments; j++)
      if (norm(evaluator.tangentAt(j / plan.segments)) < D * 1e-9)
        throw new Error('Tangente degenerada: conserva la línea para esta curva');
    const geometry = new THREE.TubeGeometry(
      curve,
      plan.segments,
      (store.project().appearance.tubeRadius * D) / 2,
      8,
      true,
    );
    if (Array.from(geometry.attributes['position'].array).some((x) => !Number.isFinite(x))) {
      geometry.dispose();
      throw new Error('El tubo tiene una singularidad');
    }
    const mesh = new THREE.Mesh(
      geometry,
      new THREE.MeshStandardMaterial({
        color: store.project().appearance.color,
        roughness: 0.38,
        metalness: 0.12,
      }),
    );
    mesh.userData = {
      tolerance: store.project().appearance.tolerance ?? 0.005,
      segments: plan.segments,
      units: 'project',
      sourceDiameter: D,
    };
    return mesh;
  }
  render(phase: number): void {
    if (
      this.lastSamples !== this.store.reconstruction ||
      this.appearanceKey !== JSON.stringify(this.store.project().appearance)
    )
      this.rebuild();
    const p = this.store.project(),
      circles = this.cachedCircles;
    void p;
    const start = [...this.store.offset] as [number, number, number];
    const count = circles?.length ?? this.store.harmonics.length;
    for (let i = 0; i < count; i++) {
      const position = this.vectors?.geometry.getAttribute('position');
      if (position && i * 2 < position.count) position.setXYZ(i * 2, ...start);
      if (i < this.chain.length) this.chain[i].position.set(...start);
      const h = this.store.harmonics[i],
        v = circles
          ? evaluateCircle3(circles[i], phase)
          : h.a.map(
              (x, d) =>
                x * Math.cos(TAU * h.frequency * phase) +
                h.b[d] * Math.sin(TAU * h.frequency * phase),
            );
      for (let d = 0; d < 3; d++) start[d] += v[d];
      if (position && i * 2 < position.count) position.setXYZ(i * 2 + 1, ...start);
    }
    const attribute = this.vectors?.geometry.getAttribute('position');
    if (attribute) attribute.needsUpdate = true;
    this.tip.position.set(...start);
    this.tip.scale.setScalar(this.radius);
    this.trace?.geometry.setDrawRange(
      0,
      Math.floor(phase * (this.store.reconstruction?.count ?? 0)) + 1,
    );
    for (const m of this.points) m.visible = this.edit;
    this.controls.update();
    this.renderer.render(this.scene, this.camera);
  }
  async exportGlb(): Promise<Blob> {
    const mesh = this.buildTube();
    try {
      const { GLTFExporter } = await import('three/addons/exporters/GLTFExporter.js');
      const buffer = await new GLTFExporter().parseAsync(mesh, { binary: true });
      if (!(buffer instanceof ArrayBuffer)) throw new Error('GLB inválido');
      return new Blob([buffer], { type: 'model/gltf-binary' });
    } finally {
      mesh.geometry.dispose();
      (mesh.material as THREE.Material).dispose();
    }
  }
  get stats(): { drawCalls: number; geometries: number; rebuilds: number; live: number } {
    return {
      drawCalls: this.renderer.info.render.calls,
      geometries: this.renderer.info.memory.geometries,
      rebuilds: this.geometryVersion,
      live: ThreeRenderer.liveCount,
    };
  }
  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    ThreeRenderer.liveCount--;
    this.canvas.removeEventListener('click', this.click);
    this.controls.dispose();
    this.transform.dispose();
    this.releaseContent();
    this.tip.geometry.dispose();
    (this.tip.material as THREE.Material).dispose();
    this.renderer.dispose();
  }
}
