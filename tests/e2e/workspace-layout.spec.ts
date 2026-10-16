import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { readFile } from 'node:fs/promises';

test('touchWorkspaceKeepsPanelsAndCameraUsable', async ({ browser }, info) => {
  test.skip(info.project.name !== 'chromium', 'Touch device emulation uses Chromium');
  const context = await browser.newContext({
    viewport: { width: 360, height: 800 },
    isMobile: true,
    hasTouch: true,
  });
  try {
    const page = await context.newPage();
    await page.goto('http://127.0.0.1:4200/studio/2d');
    await expect(page.locator('canvas[data-ready]')).toHaveAttribute('data-ready', 'true');
    expect(await page.evaluate(() => navigator.maxTouchPoints)).toBeGreaterThan(0);
    const inspector = page.getByRole('button', { name: 'Mostrar u ocultar inspector' });
    await inspector.tap();
    await expect(page.locator('.inspector-section[open]')).toHaveCount(1);
    await page.getByRole('button', { name: 'Espacio 3D', exact: true }).tap();
    await expect(page.locator('canvas[data-ready]')).toHaveAttribute('data-ready', 'true');
    await expect(inspector).toHaveAttribute('aria-expanded', 'true');
    await page.getByRole('button', { name: 'Vista superior', exact: true }).tap();
    await expect(page.getByRole('button', { name: 'Vista superior', exact: true })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    await inspector.tap();
    await page.getByRole('button', { name: 'Acercar', exact: true }).tap();
    await page.getByRole('button', { name: 'Plano 2D', exact: true }).tap();
    await expect(inspector).toHaveAttribute('aria-expanded', 'false');
    await expect(page.getByRole('button', { name: '✎ Dibujar', exact: true })).toBeVisible();
  } finally {
    await context.close();
  }
});

test('alignedChromeAndResponsiveInspectorKeepModePreference', async ({ page }, info) => {
  test.setTimeout(90000);
  for (const viewport of [
    { width: 1440, height: 900 },
    { width: 360, height: 800 },
    { width: 320, height: 640 },
    { width: 844, height: 390 },
  ]) {
    await page.setViewportSize(viewport);
    await page.goto('/studio/2d');
    await expect(page.locator('canvas[data-ready]')).toHaveAttribute('data-ready', 'true');
    if (await page.getByRole('button', { name: 'Descartar', exact: true }).isVisible())
      await page.getByRole('button', { name: 'Descartar', exact: true }).click();
    const toggle = page.getByRole('button', { name: 'Mostrar u ocultar inspector' });
    if ((await toggle.getAttribute('aria-expanded')) !== 'true') await toggle.click();
    const header = (await page.locator('.topbar').boundingBox())!;
    expect(header.x).toBe(0);
    expect(header.y).toBe(0);
    expect(header.width).toBe(viewport.width);
    const panel = (await page.locator('.inspector').boundingBox())!;
    const zoom = (await page.locator('.zoom-tools').boundingBox())!;
    expect(panel.y).toBe(zoom.y);
    expect(panel.y).toBe(header.height + 12);
    expect(zoom.x + zoom.width).toBeLessThanOrEqual(panel.x);
    expect(zoom.x).toBeGreaterThanOrEqual(8);
    expect(panel.x + panel.width).toBe(viewport.width - (viewport.width <= 700 ? 8 : 14));
    expect(panel.y + panel.height).toBeLessThan(
      (await page.locator('.transport').boundingBox())!.y,
    );
    const expected = viewport.width >= 1200 && viewport.height >= 850 ? 3 : 1;
    await expect(page.locator('.inspector-section[open]')).toHaveCount(expected);
    await toggle.click();
    await expect(toggle).toHaveAttribute('aria-expanded', 'false');
    await expect(page.locator('.studio')).toHaveClass(/inspector-closed/);
    const collapsedZoom = (await page.locator('.zoom-tools').boundingBox())!;
    expect(collapsedZoom.x + collapsedZoom.width).toBe(
      viewport.width - (viewport.width <= 700 ? 8 : 14),
    );
    expect(collapsedZoom.x).toBeGreaterThan(zoom.x);
    const tools = (await page.locator('.canvas-toolbar').boundingBox())!;
    expect(tools.y).toBe(zoom.y);
    await page.getByRole('button', { name: 'Espacio 3D', exact: true }).click();
    await expect(page.locator('canvas[data-ready]')).toHaveAttribute('data-ready', 'true');
    await expect(toggle).toHaveAttribute('aria-expanded', 'false');
    await expect(page.getByLabel('Nombre del proyecto')).toHaveValue('Nudo de cinco lóbulos');
    const exportMenu = page.getByRole('button', { name: 'Exportar y compartir', exact: true });
    await exportMenu.click();
    const download = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Proyecto JSON', exact: true }).click();
    const exported = await download;
    const project = JSON.parse(await readFile((await exported.path())!, 'utf8'));
    expect(project.appearance.circles).toBe(true);
    expect(project.appearance.vectors).toBe(true);
    await exportMenu.click();
    if (viewport.width === 1440)
      await page.screenshot({
        path: test.info().outputPath(`${info.project.name}-initial-knot.png`),
      });
    const buttons = await page.locator('.zoom-tools button').all();
    for (let i = 1; i < buttons.length; i++) {
      const previous = (await buttons[i - 1].boundingBox())!,
        current = (await buttons[i].boundingBox())!;
      expect(current.x).toBe(previous.x);
      expect(current.y).toBeGreaterThanOrEqual(previous.y + previous.height);
    }
    await page.getByRole('button', { name: 'Vista frontal', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Vista frontal', exact: true })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    await toggle.click();
    await page.getByRole('button', { name: 'Plano 2D', exact: true }).click();
    await expect(page.locator('canvas[data-ready]')).toHaveAttribute('data-ready', 'true');
    await expect(toggle).toHaveAttribute('aria-expanded', 'true');
    if (viewport.width === 360)
      expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    await page.screenshot({
      path: test.info().outputPath(`${info.project.name}-aligned-${viewport.width}.png`),
    });
  }
});

test('inlineNameCommitsAfterTypingAndBlurAndSurvivesModeSwitch', async ({ page }) => {
  await page.goto('/studio/2d');
  await expect(page.locator('canvas[data-ready]')).toHaveAttribute('data-ready', 'true');
  const name = page.getByLabel('Nombre del proyecto');
  await name.fill('  Mi curva  ');
  await expect(page.getByRole('heading', { name: 'Mi curva', exact: true })).toBeVisible();
  await name.fill('   ');
  await name.press('Tab');
  await expect(name).toHaveValue('Sin nombre');
  await name.fill('A'.repeat(80));
  await name.press('Enter');
  await page.getByRole('button', { name: 'Espacio 3D', exact: true }).click();
  await expect(page.locator('canvas[data-ready]')).toHaveAttribute('data-ready', 'true');
  await page.getByRole('button', { name: 'Plano 2D', exact: true }).click();
  await expect(name).toHaveValue('A'.repeat(80));
  await page.getByRole('button', { name: 'Guardar ↗', exact: true }).click();
  await expect(page.locator('.project-state')).toContainText('Guardado');
});

test('flatAnimationVideoCanCancelAndExportsMovingFramesWithoutChangingPhase', async ({ page }) => {
  await page.goto('/studio/2d');
  await expect(page.locator('canvas[data-ready]')).toHaveAttribute('data-ready', 'true');
  await page.getByRole('button', { name: 'Velocidad', exact: true }).click();
  await page.getByRole('button', { name: '4×', exact: true }).click();
  const slider = page.getByRole('slider', { name: 'Posición en el ciclo' });
  const phase = await slider.inputValue();
  await page.getByRole('button', { name: 'Exportar y compartir', exact: true }).click();
  const record = page.getByRole('button', { name: 'Grabar un ciclo · 2 s', exact: true });
  if (!(await record.isEnabled())) {
    await expect(
      page.getByText('Este navegador no admite grabación. Puedes exportar PNG o JSON.'),
    ).toBeVisible();
    return;
  }
  await page.getByText('Opciones de video', { exact: true }).click();
  await page.getByRole('button', { name: 'Negro', exact: true }).click();
  await page.getByRole('checkbox', { name: 'Incluir cuadrícula', exact: true }).check();
  await page.getByRole('button', { name: 'Vertical 9:16', exact: true }).click();
  await page.getByRole('slider', { name: 'Zoom de exportación' }).fill('1.25');
  await page.getByRole('slider', { name: 'Zoom de exportación' }).dispatchEvent('change');
  await record.click();
  await page.getByRole('button', { name: 'Cancelar grabación', exact: true }).click();
  await expect(record).toBeEnabled();
  const pending = page.waitForEvent('download');
  await record.click();
  const file = await pending;
  const bytes = await readFile((await file.path())!);
  const frames = await page.evaluate(
    async ({ data, mime }) => {
      const video = document.createElement('video');
      video.muted = true;
      const url = URL.createObjectURL(new Blob([new Uint8Array(data)], { type: mime }));
      try {
        await new Promise<void>((resolve, reject) => {
          video.onloadedmetadata = () => resolve();
          video.onerror = () => reject(new Error('Video inválido'));
          video.src = url;
        });
        const canvas = document.createElement('canvas');
        canvas.width = 64;
        canvas.height = 36;
        const context = canvas.getContext('2d')!;
        const hashes = [];
        await video.play();
        for (const time of [0.3, 1.3]) {
          await new Promise<void>((resolve) => {
            const nextFrame = () => {
              if (video.currentTime >= time && video.readyState >= 2) resolve();
              else requestAnimationFrame(nextFrame);
            };
            requestAnimationFrame(nextFrame);
          });
          context.drawImage(video, 0, 0, 64, 36);
          hashes.push(
            Array.from(context.getImageData(0, 0, 64, 36).data).reduce(
              (sum, x, i) => (sum + x * (i + 1)) % 1000000007,
              0,
            ),
          );
        }
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        context.drawImage(video, 0, 0);
        const background = Array.from(context.getImageData(10, 10, 1, 1).data).slice(0, 3);
        return { width: video.videoWidth, height: video.videoHeight, hashes, background };
      } finally {
        video.pause();
        video.removeAttribute('src');
        video.load();
        URL.revokeObjectURL(url);
      }
    },
    {
      data: Array.from(bytes),
      mime: file.suggestedFilename().endsWith('.mp4') ? 'video/mp4' : 'video/webm',
    },
  );
  expect(frames.width).toBe(720);
  expect(frames.height).toBe(1280);
  expect(frames.background.every((channel) => channel < 8)).toBe(true);
  expect(frames.hashes[0]).not.toBe(frames.hashes[1]);
  await expect(slider).toHaveValue(phase);
  await expect(page.getByRole('button', { name: 'Reproducir', exact: true })).toBeVisible();
});
