import { test, expect, Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

async function openCreator(page: Page, dimension: 2 | 3 = 2) {
  await page.goto(`/studio/${dimension}d`);
  await expect(page.locator('canvas[data-ready]')).toHaveAttribute('data-ready', 'true');
  await page.getByRole('button', { name: 'Crear desde…', exact: true }).click();
  return page.getByRole('dialog', { name: 'Crear desde…', exact: true });
}

async function photoFixture(page: Page): Promise<Buffer> {
  const encoded = await page.evaluate(() => {
    const canvas = document.createElement('canvas');
    canvas.width = 160;
    canvas.height = 160;
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, 160, 160);
    ctx.strokeStyle = '#171717';
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.ellipse(80, 76, 47, 62, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = '#333';
    ctx.beginPath();
    ctx.ellipse(60, 65, 9, 4, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(100, 65, 9, 4, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(80, 70);
    ctx.lineTo(74, 94);
    ctx.lineTo(85, 94);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(80, 98, 21, 0.2, Math.PI - 0.2);
    ctx.stroke();
    return canvas.toDataURL('image/png').split(',')[1];
  });
  return Buffer.from(encoded, 'base64');
}

test('galleryPreviewSelectionAndCancelPreserveCurrentDrawing', async ({ page }) => {
  const dialog = await openCreator(page);
  await expect(dialog.getByRole('button', { name: 'Perfil de musa', exact: true })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await dialog.getByRole('button', { name: 'Colibrí en vuelo', exact: true }).click();
  await expect(
    dialog.getByRole('button', { name: 'Colibrí en vuelo', exact: true }),
  ).toHaveAttribute('aria-pressed', 'true');
  await expect(dialog.getByRole('button', { name: 'Perfil de musa', exact: true })).toHaveAttribute(
    'aria-pressed',
    'false',
  );
  await expect(dialog.getByRole('button', { name: 'Perfil de musa', exact: true })).not.toHaveClass(
    /active/,
  );
  const before = await dialog.locator('.drawing-preview polyline').getAttribute('points');
  await page.screenshot({ path: test.info().outputPath('creation-gallery.png') });
  await dialog.getByRole('button', { name: 'Otra variación' }).click();
  await expect(dialog.locator('.drawing-preview polyline')).not.toHaveAttribute('points', before!);
  await page.keyboard.press('Escape');
  await expect(dialog).toHaveCount(0);
  await expect(page.getByRole('textbox', { name: 'Nombre del proyecto' })).toHaveValue(
    'Corazón armónico',
  );
  await expect(page.getByRole('button', { name: 'Crear desde…', exact: true })).toBeFocused();
});

test('typedNameCreatesOwnAnimatedCurveAndValidatesUnsupportedText', async ({ page }) => {
  const dialog = await openCreator(page);
  await dialog.getByRole('button', { name: 'Texto', exact: true }).click();
  const text = dialog.getByRole('textbox', { name: 'Tu nombre o mensaje' });
  await text.fill('');
  await expect(dialog.getByRole('button', { name: 'Crear y animar' })).toBeDisabled();
  await text.fill('😊');
  await expect(dialog.getByRole('alert')).toBeVisible();
  await text.fill('Josué\nWong');
  await expect(dialog.getByRole('alert')).toHaveCount(0);
  await expect(dialog.locator('.drawing-preview polyline')).toBeVisible();
  await dialog.getByRole('button', { name: 'Crear y animar' }).click();
  await expect(dialog).toHaveCount(0);
  await expect(page.getByRole('textbox', { name: 'Nombre del proyecto' })).toHaveValue(
    'Texto: Josué Wong',
  );
  await expect(page.getByRole('button', { name: 'Pausar', exact: true })).toBeVisible();
  await expect(page.getByText('Sin guardar', { exact: true })).toBeVisible();
  await expect(page.locator('#components')).toHaveAttribute('max', '2047');
});

test('svgContoursCanBeSelectedAndUnsafeSvgDoesNotReplaceDocument', async ({ page }) => {
  const dialog = await openCreator(page);
  await dialog.getByRole('button', { name: 'SVG', exact: true }).click();
  const file = dialog.getByLabel('Cargar SVG para crear dibujo');
  await file.setInputFiles({
    name: 'unsafe.svg',
    mimeType: 'image/svg+xml',
    buffer: Buffer.from(
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><script>alert(1)</script><path d="M0 0L5 5"/></svg>',
    ),
  });
  await expect(dialog.getByRole('alert')).toBeVisible();
  await expect(dialog.getByRole('button', { name: 'Crear y animar' })).toBeDisabled();
  await file.setInputFiles({
    name: 'Contornos.svg',
    mimeType: 'image/svg+xml',
    buffer: Buffer.from(
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><path id="Montañas" d="M0 80L20 10L40 80m10 0l15-40 20 40"/><circle id="Sol" cx="70" cy="20" r="8"/></svg>',
    ),
  });
  await expect(dialog.getByRole('checkbox')).toHaveCount(3);
  const points = await dialog.locator('.drawing-preview polyline').getAttribute('points');
  await dialog.getByRole('checkbox').last().uncheck();
  await expect(dialog.locator('.drawing-preview polyline')).not.toHaveAttribute('points', points!);
  await dialog.getByRole('checkbox').nth(0).uncheck();
  await dialog.getByRole('checkbox').nth(1).uncheck();
  await expect(dialog.getByRole('button', { name: 'Crear y animar' })).toBeDisabled();
  await dialog.getByRole('checkbox').last().check();
  await dialog.getByRole('button', { name: 'Crear y animar' }).click();
  await expect(page.getByRole('textbox', { name: 'Nombre del proyecto' })).toHaveValue(
    'Ilustración SVG',
  );
  await expect(page.getByRole('button', { name: 'Pausar', exact: true })).toBeVisible();
});

test('photoConvertsLocallyInBothStylesAndCreatesAnimation', async ({ page }) => {
  const dialog = await openCreator(page);
  await dialog.getByRole('button', { name: 'Foto', exact: true }).click();
  await dialog.getByLabel('Cargar fotografía para crear dibujo').setInputFiles({
    name: 'Retrato.png',
    mimeType: 'image/png',
    buffer: await photoFixture(page),
  });
  await expect(dialog.locator('.drawing-preview')).toHaveAttribute('aria-busy', 'false');
  await expect(dialog.getByRole('alert')).toHaveCount(0);
  await expect(dialog.locator('.drawing-preview polyline')).toBeVisible();
  const tonal = await dialog.locator('.drawing-preview polyline').getAttribute('points');
  await dialog.getByRole('button', { name: 'Contornos Siluetas e ilustraciones' }).click();
  await expect(dialog.locator('.drawing-preview')).toHaveAttribute('aria-busy', 'false');
  await expect(dialog.locator('.drawing-preview polyline')).not.toHaveAttribute('points', tonal!);
  await expect(dialog.getByRole('alert')).toHaveCount(0);
  await page.screenshot({ path: test.info().outputPath('photo-contours.png') });
  await dialog.getByRole('button', { name: 'Crear y animar' }).click();
  await expect(page.getByRole('textbox', { name: 'Nombre del proyecto' })).toHaveValue('Retrato');
  await expect(page.getByRole('button', { name: 'Pausar', exact: true })).toBeVisible();
});

test('photoRejectsBlankAndCorruptFilesWithoutLosingCurrentCreation', async ({ page }) => {
  const dialog = await openCreator(page);
  await dialog.getByRole('button', { name: 'Foto', exact: true }).click();
  const input = dialog.getByLabel('Cargar fotografía para crear dibujo');
  await input.setInputFiles({
    name: 'bad.png',
    mimeType: 'image/png',
    buffer: Buffer.from('not an image'),
  });
  await expect(dialog.getByRole('alert')).toBeVisible();
  await expect(dialog.getByRole('button', { name: 'Crear y animar' })).toBeDisabled();
  const blank = await page.evaluate(() => {
    const canvas = document.createElement('canvas');
    canvas.width = 40;
    canvas.height = 40;
    const context = canvas.getContext('2d')!;
    context.fillStyle = '#fff';
    context.fillRect(0, 0, 40, 40);
    return canvas.toDataURL().split(',')[1];
  });
  await input.setInputFiles({
    name: 'blank.png',
    mimeType: 'image/png',
    buffer: Buffer.from(blank, 'base64'),
  });
  await expect(dialog.getByRole('alert')).toContainText('uniforme');
  await expect(dialog.getByRole('button', { name: 'Crear y animar' })).toBeDisabled();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('textbox', { name: 'Nombre del proyecto' })).toHaveValue(
    'Corazón armónico',
  );
});

test('creatorFitsMobileAndHasAccessibleControls', async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 740 });
  const dialog = await openCreator(page);
  const bounds = await dialog.boundingBox();
  expect(bounds!.x).toBeGreaterThanOrEqual(0);
  expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(360);
  expect(await dialog.evaluate((element) => element.scrollWidth <= element.clientWidth)).toBe(true);
  await dialog.getByRole('button', { name: 'Texto', exact: true }).click();
  await dialog.getByRole('textbox', { name: 'Tu nombre o mensaje' }).fill('WONG');
  const result = await new AxeBuilder({ page }).include('.creation-dialog').analyze();
  expect(result.violations).toEqual([]);
  await page.screenshot({ path: test.info().outputPath('creation-mobile.png'), fullPage: true });
  await dialog.getByRole('button', { name: 'Crear y animar' }).click();
  await expect(page.getByRole('textbox', { name: 'Nombre del proyecto' })).toHaveValue(
    'Texto: WONG',
  );
});

test('creationFromSpatialOpensNew2dCopyAndPreserves3dSession', async ({ page }) => {
  const dialog = await openCreator(page, 3);
  const name = await page.getByRole('textbox', { name: 'Nombre del proyecto' }).inputValue();
  await dialog.getByRole('button', { name: 'Crear y animar' }).click();
  await expect(page).toHaveURL(/studio\/2d/);
  await expect(page.getByRole('textbox', { name: 'Nombre del proyecto' })).toHaveValue(
    'Perfil de musa',
  );
  await page.getByRole('button', { name: 'Espacio 3D', exact: true }).click();
  await expect(page).toHaveURL(/studio\/3d/);
  await expect(page.getByRole('textbox', { name: 'Nombre del proyecto' })).toHaveValue(name);
});

test('failedCreationKeepsPreviousGeometryAndShowsErrorInsideDialog', async ({ page }) => {
  const dialog = await openCreator(page);
  await page.evaluate(() => {
    window.Worker = class extends Worker {
      constructor(url: string | URL, options?: WorkerOptions) {
        if (String(url).includes('worker-')) throw new Error('Prueba de fallo de cálculo');
        super(url, options);
      }
    };
  });
  await dialog.getByRole('button', { name: 'Crear y animar' }).click();
  await expect(dialog.getByRole('alert')).toContainText('Prueba de fallo de cálculo');
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole('button', { name: 'Crear y animar' })).toBeEnabled();
  await dialog.getByRole('button', { name: 'Cerrar creador' }).click();
  await expect(page.getByRole('textbox', { name: 'Nombre del proyecto' })).toHaveValue(
    'Corazón armónico',
  );
  await expect(page.getByRole('button', { name: 'Reproducir', exact: true })).toBeVisible();
});

test('draftPreservationFailureIsVisibleAndDoesNotReplaceDirtyDocument', async ({ page }) => {
  await page.goto('/studio/2d');
  await expect(page.locator('canvas[data-ready]')).toHaveAttribute('data-ready', 'true');
  const name = page.getByRole('textbox', { name: 'Nombre del proyecto' });
  await name.fill('Mi borrador');
  await name.blur();
  await page.evaluate(() => {
    IDBObjectStore.prototype.put = function (): IDBRequest<IDBValidKey> {
      throw new DOMException('Prueba de cuota', 'QuotaExceededError');
    };
  });
  await page.getByRole('button', { name: 'Crear desde…', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Crear desde…', exact: true });
  await dialog.getByRole('button', { name: 'Crear y animar' }).click();
  await expect(dialog.getByRole('alert')).toContainText('no se pudo conservar el borrador');
  await expect(dialog.getByRole('button', { name: 'Crear y animar' })).toBeEnabled();
  await dialog.getByRole('button', { name: 'Cerrar creador' }).click();
  await expect(name).toHaveValue('Mi borrador');
  await expect(page.getByText('Sin guardar', { exact: true })).toBeVisible();
});
