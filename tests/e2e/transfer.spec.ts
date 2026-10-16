import { test, expect } from '@playwright/test';
import { readFile } from 'node:fs/promises';
test('exportedSvgImportsAndKeepsSourceOrientation', async ({ page }) => {
  await page.addInitScript(() =>
    Object.defineProperty(navigator, 'clipboard', {
      value: {
        writeText: async () => {
          throw new Error('Denied for fallback test');
        },
      },
    }),
  );
  await page.goto('/studio/2d');
  await expect(page.locator('canvas[data-ready]')).toHaveAttribute('data-ready', 'true');
  const pending = page.waitForEvent('download');
  if (
    !(
      (await page
        .getByRole('button', { name: 'Exportar y compartir', exact: true })
        .getAttribute('aria-expanded')) === 'true'
    )
  )
    await page.getByRole('button', { name: 'Exportar y compartir', exact: true }).click();
  await page.getByText('Opciones de imagen PNG / SVG', { exact: true }).click();
  await page.getByRole('checkbox', { name: 'Incluir cuadrícula', exact: true }).check();
  await page.getByRole('button', { name: 'Vector SVG', exact: true }).click();
  const file = await pending;
  await page.locator('input[type=file]').setInputFiles({
    name: file.suggestedFilename(),
    mimeType: file.suggestedFilename().endsWith('.svg') ? 'image/svg+xml' : 'application/json',
    buffer: await readFile((await file.path())!),
  });
  await page.getByRole('button', { name: 'Trayectoria 1', exact: true }).click();
  await expect(
    page.getByRole('img', { name: 'Vista previa de la geometría, proyección XY' }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Abrir como copia', exact: true }).click();
  await expect(page.getByRole('heading', { name: /Trayectoria 1/ })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Reproducir', exact: true })).toBeEnabled();
  const output = page.waitForEvent('download');
  if (
    !(
      (await page
        .getByRole('button', { name: 'Exportar y compartir', exact: true })
        .getAttribute('aria-expanded')) === 'true'
    )
  )
    await page.getByRole('button', { name: 'Exportar y compartir', exact: true }).click();
  await page.getByRole('button', { name: 'Proyecto JSON', exact: true }).click();
  const exported = await output,
    p = JSON.parse(await readFile((await exported.path())!, 'utf8'));
  expect(p.source.points.length).toBe(1024);
  expect(Math.max(...p.source.points.map((point: number[]) => point[1]))).toBeGreaterThan(0.5);
  expect(Math.min(...p.source.points.map((point: number[]) => point[1]))).toBeLessThan(-0.8);
});
test('shareLinkPreviewAndV1RoundTrip', async ({ page, browser }) => {
  await page.addInitScript(() =>
    Object.defineProperty(navigator, 'clipboard', {
      value: {
        writeText: async () => {
          throw new Error('Denied for fallback test');
        },
      },
    }),
  );
  await page.goto('/studio/2d');
  await expect(page.locator('canvas[data-ready]')).toHaveAttribute('data-ready', 'true');
  await page.getByRole('button', { name: 'Componer', exact: true }).click();
  if (
    !(
      (await page
        .getByRole('button', { name: 'Exportar y compartir', exact: true })
        .getAttribute('aria-expanded')) === 'true'
    )
  )
    await page.getByRole('button', { name: 'Exportar y compartir', exact: true }).click();
  await page.getByRole('button', { name: 'Copiar enlace', exact: true }).click();
  await expect(page.getByLabel('Copia este enlace')).toBeVisible();
  const url = await page.getByLabel('Copia este enlace').inputValue();
  await page.getByRole('button', { name: 'Cerrar diálogo' }).click();
  const other = await browser.newPage();
  await other.goto(url);
  await expect(other.getByRole('button', { name: 'Abrir como copia', exact: true })).toBeVisible();
  await other.getByRole('button', { name: 'Abrir como copia', exact: true }).click();
  await expect(other.locator('fieldset')).toHaveCount(2);
  await expect(other.getByRole('button', { name: 'Reproducir', exact: true })).toBeVisible();
  expect(new URL(other.url()).hash).toBe('');
  await other.close();
  await page.getByText('Más opciones del proyecto', { exact: true }).click();
  await page.getByText('Compatibilidad del proyecto', { exact: true }).click();
  const pending = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Descargar JSON V1 · sólo 2D' }).click();
  const file = await pending,
    p = JSON.parse(await readFile((await file.path())!, 'utf8'));
  expect(p.schemaVersion).toBe(1);
  expect(p.view.center).toHaveLength(2);
  expect(p.appearance.sculpture).toBeUndefined();
  await page.locator('input[type=file]').setInputFiles({
    name: file.suggestedFilename(),
    mimeType: file.suggestedFilename().endsWith('.svg') ? 'image/svg+xml' : 'application/json',
    buffer: await readFile((await file.path())!),
  });
  await page.getByRole('button', { name: 'Abrir como copia', exact: true }).click();
  await expect(page.locator('fieldset')).toHaveCount(2);
});

test('projectionCreatesCopyAndPreservesSpatialSource', async ({ page }) => {
  await page.goto('/studio/3d');
  await expect(page.locator('canvas[data-ready]')).toHaveAttribute('data-ready', 'true');
  await page.getByRole('button', { name: 'Componer', exact: true }).click();
  await page.getByRole('button', { name: 'Exportar y compartir', exact: true }).click();
  await page.getByText('Más opciones del proyecto', { exact: true }).click();
  await page.getByRole('button', { name: 'Guardar proyección como proyecto 2D →' }).click();
  await page.getByRole('button', { name: 'Abrir como copia', exact: true }).click();
  await expect(page).toHaveURL(/studio\/2d/);
  await expect(page.locator('canvas[data-ready]')).toHaveAttribute('data-ready', 'true');
  await page.getByRole('button', { name: 'Espacio 3D', exact: true }).click();
  await expect(page.locator('canvas[data-ready]')).toHaveAttribute('data-ready', 'true');
  await expect(page.locator('fieldset')).toHaveCount(2);
});

test('savedViewAndTransparentPngOptions', async ({ page }) => {
  await page.goto('/studio/2d');
  await expect(page.locator('canvas[data-ready]')).toHaveAttribute('data-ready', 'true');
  await page.getByRole('button', { name: 'Acercar', exact: true }).click();
  await page.getByRole('button', { name: 'Acercar', exact: true }).click();
  await page.getByRole('button', { name: 'Guardar ↗', exact: true }).click();
  await expect(page.getByText('Proyecto guardado en este navegador')).toBeVisible();
  await page.reload();
  await expect(page.locator('canvas[data-ready]')).toHaveAttribute('data-ready', 'true');
  await page.getByRole('button', { name: 'Biblioteca', exact: true }).click();
  await page.getByRole('button', { name: 'Abrir', exact: true }).click();
  const json = page.waitForEvent('download');
  if (
    !(
      (await page
        .getByRole('button', { name: 'Exportar y compartir', exact: true })
        .getAttribute('aria-expanded')) === 'true'
    )
  )
    await page.getByRole('button', { name: 'Exportar y compartir', exact: true }).click();
  await page.getByRole('button', { name: 'Proyecto JSON', exact: true }).click();
  const document = JSON.parse(await readFile((await (await json).path())!, 'utf8'));
  expect(document.view.zoom).toBeCloseTo(1.5625, 8);
  if (
    !(
      (await page
        .getByRole('button', { name: 'Exportar y compartir', exact: true })
        .getAttribute('aria-expanded')) === 'true'
    )
  )
    await page.getByRole('button', { name: 'Exportar y compartir', exact: true }).click();
  await page.getByText('Opciones de imagen PNG / SVG', { exact: true }).click();
  await page
    .getByRole('group', { name: 'Resolución', exact: true })
    .getByRole('button', { name: '2× · máximo 4096 px', exact: true })
    .click();
  await page
    .getByRole('group', { name: 'Fondo de exportación', exact: true })
    .getByRole('button', { name: 'Transparente', exact: true })
    .click();
  const pending = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Imagen PNG', exact: true }).click();
  const bytes = await readFile((await (await pending).path())!);
  expect(bytes.readUInt32BE(16)).toBeLessThanOrEqual(4096);
  const transparent = await page.evaluate(async (encoded: number[]) => {
    const image = await createImageBitmap(
        new Blob([new Uint8Array(encoded)], { type: 'image/png' }),
      ),
      canvas = document.createElement('canvas');
    canvas.width = 32;
    canvas.height = 32;
    const c = canvas.getContext('2d')!;
    c.drawImage(image, 0, 0);
    image.close();
    const pixels = c.getImageData(0, 0, 32, 32).data;
    return Array.from({ length: 1024 }, (_, i) => pixels[4 * i + 3]).some((alpha) => alpha === 0);
  }, Array.from(bytes));
  expect(transparent).toBe(true);
});
