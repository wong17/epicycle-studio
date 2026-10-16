import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { readFile } from 'node:fs/promises';
test.beforeEach(async ({ page }) => {
  await page.goto('/studio/2d');
  await expect(page.locator('canvas[data-ready]')).toHaveAttribute('data-ready', 'true');
});
test('freehandPlaybackUsesDrawing', async ({ page }) => {
  await page.getByRole('button', { name: '✎ Dibujar', exact: true }).click();
  const b = (await page.locator('canvas[data-ready]').boundingBox())!;
  await page.mouse.move(b.x + b.width * 0.3, b.y + b.height * 0.4);
  await page.mouse.down();
  await page.mouse.move(b.x + b.width * 0.65, b.y + b.height * 0.4, { steps: 15 });
  await page.mouse.move(b.x + b.width * 0.55, b.y + b.height * 0.7, { steps: 15 });
  await page.mouse.up();
  await expect(page.getByText('Dibujo libre · 1 trazo')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Reproducir', exact: true })).toBeEnabled();
  await page.getByRole('button', { name: 'Reproducir', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Pausar', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Pausar', exact: true }).click();
});
test('freehandMultipleStrokesClearAndPresetSelection', async ({ page }) => {
  const examples = page.getByRole('group', { name: 'Explora un ejemplo' });
  await expect(examples.getByRole('button', { name: 'Corazón' })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await page.getByRole('button', { name: 'Limpiar lienzo', exact: true }).click();
  await expect(page.getByText('Dibujo libre · 0 trazos')).toBeVisible();
  await expect
    .poll(() =>
      page.locator('canvas[data-ready]').evaluate((canvas: HTMLCanvasElement) => {
        const pixels = canvas
          .getContext('2d')!
          .getImageData(0, 0, canvas.width, canvas.height).data;
        for (let i = 0; i < pixels.length; i += 4)
          if (pixels[i] > 120 || pixels[i + 1] > 120 || pixels[i + 2] > 120) return true;
        return false;
      }),
    )
    .toBe(false);
  const b = (await page.locator('canvas[data-ready]').boundingBox())!;
  const stroke = async (x: number, y: number) => {
    await page.mouse.move(b.x + b.width * x, b.y + b.height * y);
    await page.mouse.down();
    await page.mouse.move(b.x + b.width * (x + 0.12), b.y + b.height * (y + 0.1), { steps: 12 });
    await page.mouse.move(b.x + b.width * (x + 0.18), b.y + b.height * y, { steps: 12 });
    await page.mouse.up();
  };
  await stroke(0.22, 0.3);
  await page.getByRole('button', { name: 'Limpiar y empezar de nuevo', exact: true }).click();
  await expect(page.getByText('Dibujo libre · 0 trazos')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Reproducir', exact: true })).toBeDisabled();
  await stroke(0.28, 0.32);
  await stroke(0.42, 0.46);
  await expect(page.getByText('Dibujo libre · 2 trazos')).toBeVisible();
  await page.screenshot({ path: test.info().outputPath('freehand-desktop.png') });
  await page.getByRole('button', { name: 'Reproducir', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Pausar', exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Dibujo libre', exact: true })).toBeVisible();
  await expect(examples.locator('[aria-pressed="true"]')).toHaveCount(0);
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Exportar y compartir', exact: true }).click();
  await page.getByRole('button', { name: 'Proyecto JSON', exact: true }).click();
  const file = await download;
  const project = JSON.parse(await readFile((await file.path())!, 'utf8'));
  expect(project.source.kind).toBe('curve2d');
  expect(project.source.closure).toBe('return');
  expect(project.source.points.length).toBeGreaterThan(30);
  expect(project.source.points.length).toBeLessThan(100);
  await page.keyboard.press('Escape');
  await examples.getByRole('button', { name: 'Estrella', exact: true }).click();
  await expect(examples.getByRole('button', { name: 'Estrella', exact: true })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await expect(examples.getByRole('button', { name: 'Corazón' })).toHaveAttribute(
    'aria-pressed',
    'false',
  );
});

test('freehandControlsFitMobileAndEmptyDrawingDoesNotTrapNavigation', async ({ page }) => {
  for (const viewport of [
    { width: 320, height: 640 },
    { width: 360, height: 800 },
  ]) {
    await page.setViewportSize(viewport);
    const toggle = page.getByRole('button', { name: 'Mostrar u ocultar inspector' });
    if ((await toggle.getAttribute('aria-expanded')) === 'true') await toggle.click();
    await page.getByRole('button', { name: 'Limpiar lienzo', exact: true }).click();
    const panel = page.locator('.closure');
    const box = (await panel.boundingBox())!;
    const transport = (await page.locator('.transport').boundingBox())!;
    expect(box.x).toBeGreaterThanOrEqual(0);
    expect(box.x + box.width).toBeLessThanOrEqual(viewport.width);
    expect(box.y + box.height).toBeLessThanOrEqual(transport.y);
    const tools = (await page.locator('.canvas-toolbar').boundingBox())!;
    const fit = (await page
      .getByRole('button', { name: 'Ajustar vista ⛶', exact: true })
      .boundingBox())!;
    expect(fit.y + fit.height).toBeLessThanOrEqual(tools.y + tools.height);
    expect(tools.y + tools.height).toBeLessThan(transport.y);
    await expect(
      page.getByRole('button', { name: 'Limpiar y empezar de nuevo', exact: true }),
    ).toBeVisible();
    await page.mouse.move(90, 235);
    await page.mouse.down();
    await page.mouse.move(135, 195, { steps: 8 });
    await page.mouse.move(175, 240, { steps: 8 });
    await page.mouse.up();
    await expect(page.getByText('Dibujo libre · 1 trazo')).toBeVisible();
    await page.screenshot({ path: test.info().outputPath(`freehand-${viewport.width}.png`) });
    await toggle.click();
    await expect(panel).toBeHidden();
    await toggle.click();
    await expect(panel).toBeVisible();
    await page.getByRole('button', { name: 'Cancelar dibujo', exact: true }).click();
  }
  await page.getByRole('button', { name: '✎ Dibujar', exact: true }).click();
  await page.getByRole('button', { name: 'Espacio 3D', exact: true }).click();
  await expect(page).toHaveURL(/studio\/3d/);
});

test('manualSaveReloadAndJsonExport', async ({ page }) => {
  await page.getByRole('button', { name: 'Componer', exact: true }).click();
  await page.getByRole('button', { name: '+ Añadir círculo' }).click();
  await expect(page.locator('fieldset')).toHaveCount(3);
  await page.getByRole('button', { name: 'Guardar ↗', exact: true }).click();
  await expect(page.getByText('Proyecto guardado en este navegador')).toBeVisible();
  await page.reload();
  await expect(page.locator('canvas[data-ready]')).toHaveAttribute('data-ready', 'true');
  await page.getByRole('button', { name: 'Biblioteca', exact: true }).click();
  await page.getByRole('button', { name: 'Abrir', exact: true }).click();
  await expect(page.locator('fieldset')).toHaveCount(3);
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
  expect(p.source.kind).toBe('manual2d');
  expect(p.source.circles).toHaveLength(3);
});
test('pngSvgAndImportSafety', async ({ page }) => {
  for (const name of ['Imagen PNG', 'Vector SVG']) {
    const download = page.waitForEvent('download');
    if (
      !(
        (await page
          .getByRole('button', { name: 'Exportar y compartir', exact: true })
          .getAttribute('aria-expanded')) === 'true'
      )
    )
      await page.getByRole('button', { name: 'Exportar y compartir', exact: true }).click();
    await page.getByRole('button', { name, exact: true }).click();
    const file = await download,
      bytes = await readFile((await file.path())!);
    if (name === 'Imagen PNG') {
      expect(bytes.subarray(1, 4).toString()).toBe('PNG');
      expect(bytes.readUInt32BE(16)).toBeGreaterThan(200);
    } else expect(bytes.toString()).toContain('<path');
  }
  await page.locator('input[type=file]').setInputFiles({
    name: 'bad.json',
    mimeType: 'application/json',
    buffer: Buffer.from('{"schemaVersion":99}'),
  });
  await expect(page.getByRole('heading', { name: 'Corazón armónico' })).toBeVisible();
});
test('desktopMobileKeyboardAndAxe', async ({ page }, info) => {
  for (const viewport of [
    { width: 1440, height: 900 },
    { width: 360, height: 800 },
  ]) {
    await page.setViewportSize(viewport);
    const inspectorToggle = page.getByRole('button', { name: 'Mostrar u ocultar inspector' });
    if (viewport.width <= 700 && (await inspectorToggle.getAttribute('aria-expanded')) === 'true')
      await inspectorToggle.click();
    await expect(page.getByRole('button', { name: 'Reproducir', exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Expandir o colapsar herramientas' }).click();
    await expect(page.getByRole('button', { name: 'Deshacer', exact: true })).toBeHidden();
    await page.getByRole('button', { name: 'Expandir o colapsar herramientas' }).click();
    await expect(page.getByRole('button', { name: 'Deshacer', exact: true })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    await page.screenshot({
      path: test.info().outputPath(`${info.project.name}-${viewport.width}-2d.png`),
      fullPage: true,
    });
  }
  await page.getByRole('button', { name: 'Mostrar u ocultar inspector' }).click();
  await page.getByRole('button', { name: 'Componer', exact: true }).focus();
  await page.keyboard.press('Enter');
  await expect(page.locator('fieldset')).toHaveCount(2);
  const results = await new AxeBuilder({ page }).analyze();
  expect(results.violations).toEqual([]);
});
test('spatialEditingAndGlbExport', async ({ page }) => {
  await page.getByRole('button', { name: 'Espacio 3D', exact: true }).click();
  await expect(page).toHaveURL(/studio\/3d/);
  await expect(page.locator('canvas[data-ready]')).toHaveAttribute('data-ready', 'true');
  await expect(page.getByRole('heading', { name: 'Nudo de cinco lóbulos' })).toBeVisible();
  await page.screenshot({ path: test.info().outputPath('spatial.png'), fullPage: true });
  await page.getByRole('button', { name: '⊕ Crear curva espacial' }).click();
  await page.getByText('Explorar el espacio', { exact: true }).click();
  await page.getByText('Editar 4 puntos de control', { exact: true }).click();
  await page.getByLabel('Punto 3 Z', { exact: true }).fill('0.8');
  await page.getByLabel('Punto 3 Z', { exact: true }).press('Tab');
  await expect(page.getByLabel('Punto 3 Z', { exact: true })).toHaveValue('0.8');
  await page.getByRole('button', { name: 'Componer', exact: true }).click();
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
    bytes = await readFile((await file.path())!);
  expect(bytes.subarray(0, 4).toString()).toBe('glTF');
  expect(bytes.readUInt32LE(4)).toBe(2);
});

test('fullViewportWorkspaceAndCollapsibleChrome', async ({ page }) => {
  for (const dimension of ['2d', '3d']) {
    await page.goto(`/studio/${dimension}`);
    await expect(page.locator('canvas[data-ready]')).toHaveAttribute('data-ready', 'true');
    const inspectorToggle = page.getByRole('button', { name: 'Mostrar u ocultar inspector' });
    if ((await inspectorToggle.getAttribute('aria-expanded')) !== 'true')
      await inspectorToggle.click();
    const canvas = page.locator('canvas[data-ready]');
    const size = page.viewportSize()!;
    const bounds = (await canvas.boundingBox())!;
    expect(bounds.x).toBe(0);
    expect(bounds.y).toBe(0);
    expect(bounds.width).toBe(size.width);
    expect(bounds.height).toBe(size.height);
    const zoomBounds = (await page
      .getByRole('button', { name: 'Acercar', exact: true })
      .boundingBox())!;
    expect(zoomBounds.x).toBeGreaterThanOrEqual(0);
    expect(zoomBounds.y + zoomBounds.height).toBeLessThanOrEqual(size.height);
    const toggle = page.getByRole('button', { name: 'Mostrar u ocultar inspector' });
    await expect(toggle).toHaveAttribute('aria-expanded', 'true');
    await page.getByRole('button', { name: 'Colapsar inspector' }).click();
    await expect(page.getByRole('complementary', { name: 'Controles de la curva' })).toBeHidden();
    await expect(toggle).toBeFocused();
    await expect(page.locator('.studio')).toHaveCSS('color-scheme', 'dark');
    await toggle.click();
    await page.getByText('El punto de partida', { exact: false }).click();
    await expect(page.getByRole('button', { name: 'Componer', exact: true })).toBeHidden();
    await page.getByText('El punto de partida', { exact: false }).click();
    const exports = page.getByRole('button', { name: 'Exportar y compartir', exact: true });
    await page.keyboard.press('Tab');
    await exports.focus();
    await expect(exports).not.toHaveAttribute('title');
    await expect(page.getByRole('tooltip')).toHaveText('Exportar y compartir');
    await page.keyboard.press('Enter');
    const png = page.getByRole('button', { name: 'Imagen PNG', exact: true });
    await png.hover();
    await expect(png).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.getByRole('button', { name: 'Imagen PNG' })).toBeHidden();
    await expect(exports).toBeFocused();
    await page.getByRole('button', { name: 'Expandir o colapsar reproducción' }).click();
    await expect(page.getByRole('slider', { name: 'Posición en el ciclo' })).toBeHidden();
    await expect(page.getByRole('button', { name: 'Reproducir', exact: true })).toBeVisible();
  }
  await page.setViewportSize({ width: 360, height: 800 });
  await page.reload();
  await expect(page.locator('canvas[data-ready]')).toHaveAttribute('data-ready', 'true');
  const mobileZoom = (await page
    .getByRole('button', { name: 'Acercar', exact: true })
    .boundingBox())!;
  expect(mobileZoom.y + mobileZoom.height).toBeLessThan(800);
  await expect(page.getByRole('button', { name: 'Mostrar u ocultar inspector' })).toHaveAttribute(
    'aria-expanded',
    'false',
  );
  await page.getByRole('button', { name: 'Mostrar u ocultar inspector' }).click();
  const panel = (await page.getByRole('complementary').boundingBox())!;
  expect(panel.y).toBe((await page.locator('.zoom-tools').boundingBox())!.y);
  expect(panel.y + panel.height).toBeLessThan((await page.locator('.transport').boundingBox())!.y);
  expect(await page.evaluate(() => document.documentElement.scrollHeight <= innerHeight)).toBe(
    true,
  );
});

test('mathReadoutTracksPhaseAndInspectorStaysCollapsedAcrossModes', async ({ page }) => {
  const inspectorToggle = page.getByRole('button', { name: 'Mostrar u ocultar inspector' });
  await inspectorToggle.click();
  const mathToggle = page.getByRole('button', { name: 'Datos matemáticos', exact: true });
  await expect(mathToggle).toHaveAttribute('aria-expanded', 'false');
  await mathToggle.click();
  const panel = page.getByRole('region', { name: 'Matemática en movimiento' });
  await expect(panel).toBeVisible();
  await page
    .getByRole('slider', { name: 'Posición en el ciclo', exact: true })
    .evaluate((element: HTMLInputElement) => {
      element.value = '0.25';
      element.dispatchEvent(new Event('input', { bubbles: true }));
    });
  await expect(page.getByTestId('math-phase')).toHaveText('0.250');
  await expect(page.getByTestId('math-angle')).toHaveText('90.0°');
  await page.getByRole('button', { name: 'Velocidad', exact: true }).click();
  await page
    .getByRole('group', { name: 'Velocidad', exact: true })
    .getByRole('button', { name: '2×', exact: true })
    .click();
  await expect(page.getByTestId('math-period')).toHaveText('4.00 s');
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  await panel.focus();
  await page.keyboard.press('End');
  await expect.poll(async () => panel.evaluate((element) => element.scrollTop)).toBeGreaterThan(0);
  await page.keyboard.press('Home');
  await page.getByRole('button', { name: 'Reproducir', exact: true }).click();
  await expect
    .poll(async () => Number(await page.getByTestId('math-phase').textContent()))
    .toBeGreaterThan(0.25);
  await page.getByRole('button', { name: 'Pausar', exact: true }).click();
  for (const name of ['Espacio 3D', 'Plano 2D']) {
    await page.getByRole('button', { name, exact: true }).click();
    await expect(page.locator('canvas[data-ready]')).toHaveAttribute('data-ready', 'true');
    await expect(inspectorToggle).toHaveAttribute('aria-expanded', 'false');
    await expect(page.getByRole('complementary', { name: 'Controles de la curva' })).toBeHidden();
    await expect(panel).toBeVisible();
  }
  await mathToggle.click();
  await expect(panel).toBeHidden();
  await inspectorToggle.click();
  await expect(page.getByRole('complementary', { name: 'Controles de la curva' })).toBeVisible();
  await page.getByRole('button', { name: 'Espacio 3D', exact: true }).click();
  await expect(inspectorToggle).toHaveAttribute('aria-expanded', 'true');
  await page.getByRole('button', { name: 'Componer', exact: true }).click();
  await mathToggle.click();
  await expect(panel.getByText(/Composición manual/)).toBeVisible();
  await expect(panel.getByText('z', { exact: true })).toBeVisible();
  await page.setViewportSize({ width: 360, height: 800 });
  const bounds = (await panel.boundingBox())!;
  expect(bounds.x).toBeGreaterThanOrEqual(0);
  expect(bounds.x + bounds.width).toBeLessThanOrEqual(360);
  expect(bounds.y).toBeGreaterThanOrEqual(0);
  expect(bounds.y + bounds.height).toBeLessThan(700);
  await mathToggle.click();
  await expect(panel).toBeHidden();
});

test('visualChoicesAndCompactDockStayUsableOnMobile', async ({ page }, info) => {
  test.setTimeout(90000);
  for (const viewport of [
    { width: 360, height: 800 },
    { width: 320, height: 640 },
    { width: 844, height: 390 },
  ]) {
    await page.setViewportSize(viewport);
    await page.goto('/studio/3d');
    await expect(page.locator('canvas[data-ready]')).toHaveAttribute('data-ready', 'true');
    expect(await page.locator('select').count()).toBe(0);
    const inspector = page.getByRole('button', { name: 'Mostrar u ocultar inspector' });
    if ((await inspector.getAttribute('aria-expanded')) !== 'true') await inspector.click();
    const spatialSection = page
      .locator('.inspector-section')
      .filter({ has: page.getByText('Explorar el espacio', { exact: true }) });
    if (!(await spatialSection.evaluate((el) => (el as HTMLDetailsElement).open)))
      await spatialSection.locator('summary').first().click();
    const views = page.getByRole('group', { name: 'Vista', exact: true });
    const front = views.getByRole('button', { name: 'Frontal · XY', exact: true });
    await front.click();
    await expect(front).toHaveAttribute('aria-pressed', 'true');
    await page.mouse.move(0, 0);
    await front.hover();
    const tooltip = page.getByRole('tooltip').filter({ hasText: 'Frontal · XY' });
    await expect(tooltip).toBeVisible();
    const tipBounds = (await tooltip.boundingBox())!;
    expect(tipBounds.x).toBeGreaterThanOrEqual(0);
    expect(tipBounds.x + tipBounds.width).toBeLessThanOrEqual(viewport.width);
    for (const button of await views.getByRole('button').all()) {
      const bounds = (await button.boundingBox())!;
      expect(bounds.width).toBeGreaterThanOrEqual(44);
      expect(bounds.height).toBeGreaterThanOrEqual(44);
    }
    await page.getByRole('button', { name: 'Velocidad', exact: true }).click();
    const speed = page.getByRole('dialog', { name: 'Velocidad', exact: true });
    await expect(speed.getByRole('button', { name: '4×', exact: true })).toBeVisible();
    if (viewport.width === 360)
      expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
    await speed.getByRole('button', { name: '4×', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Velocidad', exact: true })).toContainText('4×');
    const dock = (await page.locator('.transport').boundingBox())!;
    const legend = (await page.locator('.canvas-footer').boundingBox())!;
    expect(dock.height).toBeLessThanOrEqual(58);
    expect(dock.y + dock.height).toBeLessThanOrEqual(legend.y);
    expect(
      await page
        .locator('.canvas-footer')
        .evaluate((el) => parseFloat(getComputedStyle(el).fontSize)),
    ).toBeGreaterThanOrEqual(10);
    await page.getByRole('button', { name: 'Datos matemáticos', exact: true }).click();
    const math = page.getByRole('region', { name: 'Matemática en movimiento' });
    await expect(math).toBeVisible();
    if (viewport.width <= 700) {
      await expect(inspector).toHaveAttribute('aria-expanded', 'false');
      await inspector.click();
      await expect(math).toBeHidden();
      const panel = (await page.getByRole('complementary').boundingBox())!;
      const mathButton = (await page
        .getByRole('button', { name: 'Datos matemáticos' })
        .boundingBox())!;
      expect(panel.y + panel.height).toBeLessThanOrEqual(mathButton.y);
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    await page.screenshot({
      path: test.info().outputPath(`${info.project.name}-visual-${viewport.width}.png`),
    });
  }
});
