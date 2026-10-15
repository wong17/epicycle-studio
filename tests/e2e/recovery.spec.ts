import { test, expect } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { Box3, Vector3 } from 'three';
test('dimensionRoundTripAndTwentyMountsKeepResourcesBounded', async ({ page }) => {
  // WebKit needs about 60 seconds for all 40 navigations with the full viewport canvas.
  test.setTimeout(90000);
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/studio/2d');
  await expect(page.locator('canvas[data-ready]')).toHaveAttribute('data-ready', 'true');
  await page.getByRole('button', { name: 'Componer', exact: true }).click();
  await page.getByRole('button', { name: '+ Añadir círculo' }).click();
  for (let i = 0; i < 20; i++) {
    await page.getByRole('button', { name: 'Espacio 3D', exact: true }).click();
    await expect(page.locator('canvas[data-ready]')).toHaveAttribute('data-ready', 'true');
    await expect
      .poll(async () =>
        Number(await page.locator('canvas[data-ready]').getAttribute('data-geometries')),
      )
      .toBeLessThan(170);
    await expect
      .poll(async () =>
        Number(await page.locator('canvas[data-ready]').getAttribute('data-live-renderers')),
      )
      .toBe(1);
    await page.getByRole('button', { name: 'Plano 2D', exact: true }).click();
    await expect(page.locator('canvas[data-ready]')).toHaveAttribute('data-ready', 'true');
    await expect(page.locator('fieldset')).toHaveCount(3);
  }
  expect(errors).toEqual([]);
});
test('translatedGlbReimportsInSourceFrame', async ({ page }) => {
  await page.goto('/studio/3d');
  await expect(page.locator('canvas[data-ready]')).toHaveAttribute('data-ready', 'true');
  const p = {
    format: 'epicycle-studio',
    schemaVersion: 2,
    id: crypto.randomUUID(),
    name: 'Translated sculpture',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    dimension: 3,
    source: {
      kind: 'manual3d',
      offset: [10, 20, 30],
      circles: [
        {
          id: crypto.randomUUID(),
          frequency: 1,
          radius: 1,
          phase: 0,
          axisU: [1, 0, 0],
          axisV: [0, 1, 0],
        },
      ],
    },
    analysis: { sampleCount: 512, count: 32, order: 'amplitude' },
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
      sculpture: true,
      tubeRadius: 0.015,
      representation: 'ellipses',
    },
    playback: { speed: 1, phase: 0 },
    view: { zoom: 1, center: [0, 0, 0], camera: 'perspective', plane: 'xy' },
  };
  await page.locator('input[type=file]').setInputFiles({
    name: 'translated.json',
    mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify(p)),
  });
  await page.getByRole('button', { name: 'Abrir como copia', exact: true }).click();
  await expect(page.getByRole('heading', { name: /Translated sculpture/ })).toBeVisible();
  const pending = page.waitForEvent('download');
  if (
    !(
      (await page
        .getByRole('button', { name: 'Exportar y compartir', exact: true })
        .getAttribute('aria-expanded')) === 'true'
    )
  )
    await page.getByRole('button', { name: 'Exportar y compartir', exact: true }).click();
  await page.getByRole('button', { name: 'Escultura GLB', exact: true }).click();
  const file = await pending,
    bytes = await readFile((await file.path())!),
    buffer = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength),
    gltf = await new GLTFLoader().parseAsync(buffer as ArrayBuffer, '');
  const box = new Box3().setFromObject(gltf.scene),
    center = box.getCenter(new Vector3());
  expect(center.x).toBeCloseTo(10, 4);
  expect(center.y).toBeCloseTo(20, 4);
  expect(center.z).toBeCloseTo(30, 4);
  expect(box.getSize(new Vector3()).x).toBeGreaterThan(2);
  expect(box.getSize(new Vector3()).x).toBeLessThan(2.04);
});
test('videoCycleOrExplicitUnsupportedState', async ({ page }) => {
  await page.goto('/studio/3d');
  await expect(page.locator('canvas[data-ready]')).toHaveAttribute('data-ready', 'true');
  await page.getByRole('button', { name: 'Exportar y compartir', exact: true }).click();
  const button = page.getByRole('button', { name: 'Grabar un ciclo · 8 s', exact: true });
  if (!(await button.isEnabled())) {
    await expect(
      page.getByText('Este navegador no admite grabación. Puedes exportar PNG o JSON.'),
    ).toBeVisible();
    return;
  }
  const pending = page.waitForEvent('download');
  await button.click();
  await expect(page.getByRole('button', { name: 'Cancelar grabación' })).toBeVisible();
  const file = await pending,
    bytes = await readFile((await file.path())!);
  expect(bytes.length).toBeGreaterThan(1000);
  await expect(button).toBeEnabled();
});
test('webglUnavailableKeepsEditingAndJson', async ({ page }) => {
  await page.addInitScript(() => {
    const get = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (type: string, ...args: unknown[]) {
      if (type.startsWith('webgl')) return null;
      return get.apply(this, [type, ...args] as Parameters<typeof get>);
    } as typeof get;
  });
  await page.goto('/studio/3d');
  await expect(page.locator('canvas[data-ready]')).toHaveAttribute('data-ready', 'true');
  await expect(page.getByText(/WebGL no disponible/)).toBeVisible();
  const pending = page.waitForEvent('download');
  if (
    !(
      (await page
        .getByRole('button', { name: 'Exportar y compartir', exact: true })
        .getAttribute('aria-expanded')) === 'true'
    )
  )
    await page.getByRole('button', { name: 'Exportar y compartir', exact: true }).click();
  await page.getByRole('button', { name: 'Proyecto JSON', exact: true }).click();
  const file = await pending,
    p = JSON.parse(await readFile((await file.path())!, 'utf8'));
  expect(p.dimension).toBe(3);
  expect(p.source.points.some((point: number[]) => Math.abs(point[2]) > 0.1)).toBe(true);
});

test('contextLossUsesProjectionAndRestoresPaused', async ({ page }) => {
  await page.goto('/studio/3d');
  await expect(page.locator('canvas[data-ready]')).toHaveAttribute('data-ready', 'true');
  const supported = await page.evaluate(() => {
    const c = document.querySelector('canvas[data-ready]') as HTMLCanvasElement,
      g = c.getContext('webgl2');
    return !!g?.getExtension('WEBGL_lose_context');
  });
  test.skip(!supported, 'Context-loss extension unavailable');
  await page.evaluate(() => {
    const c = document.querySelector('canvas[data-ready]') as HTMLCanvasElement;
    const extension = c.getContext('webgl2')!.getExtension('WEBGL_lose_context')!;
    (c as HTMLCanvasElement & { restoreForTest?: () => void }).restoreForTest = () =>
      extension.restoreContext();
    extension.loseContext();
  });
  await expect(page.getByText(/Se perdió el contexto gráfico/)).toBeVisible();
  await expect(page.getByLabel('Proyección de recuperación de la curva espacial')).toBeVisible();
  await page.evaluate(() => {
    const c = document.querySelector('canvas[data-ready]') as HTMLCanvasElement;
    (c as HTMLCanvasElement & { restoreForTest?: () => void }).restoreForTest?.();
  });
  await expect(page.getByText('Contexto gráfico recuperado. Reproducción pausada.')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Reproducir', exact: true })).toBeVisible();
});
