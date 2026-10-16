import { test, expect } from '@playwright/test';
import { readFile } from 'node:fs/promises';

test('captureBackgroundGridZoomAndIndependentVideoSettings', async ({ page }) => {
  await page.goto('/studio/2d');
  await expect(page.locator('canvas[data-ready]')).toHaveAttribute('data-ready', 'true');
  await page.getByRole('button', { name: 'Exportar y compartir', exact: true }).click();
  const preview = page.getByLabel('Vista previa del encuadre de exportación', { exact: true });
  await expect(preview).toHaveAttribute('aria-busy', 'false');
  const png = async () => {
    const pending = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Imagen PNG', exact: true }).click();
    return Array.from(await readFile((await (await pending).path())!));
  };
  const pixel = async (bytes: number[], x: number, y: number) =>
    page.evaluate(
      async ({ bytes, x, y }) => {
        const image = await createImageBitmap(
          new Blob([new Uint8Array(bytes)], { type: 'image/png' }),
        );
        const canvas = document.createElement('canvas');
        canvas.width = image.width;
        canvas.height = image.height;
        const ctx = canvas.getContext('2d')!;
        ctx.drawImage(image, 0, 0);
        image.close();
        return Array.from(ctx.getImageData(x, y, 1, 1).data);
      },
      { bytes, x, y },
    );
  const dark = await png();
  expect(await pixel(dark, 32, 48)).toEqual([21, 21, 21, 255]);
  await page.getByText('Opciones de imagen PNG / SVG', { exact: true }).click();
  await page.getByRole('checkbox', { name: 'Incluir cuadrícula', exact: true }).check();
  const grid = await png();
  expect((await pixel(grid, 32, 48))[0]).toBeGreaterThan(21);
  await page.getByRole('checkbox', { name: 'Incluir cuadrícula', exact: true }).uncheck();
  const coloredWidth = () =>
    preview.evaluate((node: HTMLCanvasElement) => {
      const ctx = node.getContext('2d')!;
      const pixels = ctx.getImageData(0, 0, node.width, node.height).data;
      let min = node.width,
        max = 0;
      for (let y = 0; y < node.height; y++)
        for (let x = 0; x < node.width; x++) {
          const i = (y * node.width + x) * 4;
          if (pixels[i + 1] > 150 && pixels[i] > 100) {
            min = Math.min(min, x);
            max = Math.max(max, x);
          }
        }
      return max - min;
    });
  await expect(preview).toHaveAttribute('aria-busy', 'false');
  const before = await coloredWidth();
  await page.getByRole('slider', { name: 'Zoom de exportación' }).fill('1.5');
  await page.getByRole('slider', { name: 'Zoom de exportación' }).dispatchEvent('change');
  await expect(preview).toHaveAttribute('aria-busy', 'false');
  expect(await coloredWidth()).toBeGreaterThan(before);
  await page
    .getByRole('group', { name: 'Fondo de exportación', exact: true })
    .getByRole('button', { name: 'Transparente', exact: true })
    .click();
  expect((await pixel(await png(), 0, 0))[3]).toBe(0);
  await page
    .getByRole('group', { name: 'Fondo de exportación', exact: true })
    .getByRole('button', { name: 'Gris oscuro', exact: true })
    .click();
  const svgDownload = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Vector SVG', exact: true }).click();
  expect(await readFile((await (await svgDownload).path())!, 'utf8')).toContain('fill="#151515"');
  await page.getByText('Opciones de imagen PNG / SVG', { exact: true }).click();
  await page.getByText('Opciones de video', { exact: true }).click();
  await expect(page.getByRole('button', { name: 'Gris oscuro', exact: true })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await expect(
    page.getByRole('checkbox', { name: 'Incluir cuadrícula', exact: true }),
  ).not.toBeChecked();
  await expect(page.getByRole('slider', { name: 'Zoom de exportación' })).toHaveValue('1');
  await page.getByRole('checkbox', { name: 'Incluir cuadrícula', exact: true }).check();
  await page.getByRole('button', { name: 'Negro', exact: true }).click();
  await page.getByRole('button', { name: 'Vertical 9:16', exact: true }).click();
  await expect(preview).toHaveAttribute('aria-busy', 'false');
  expect(await preview.evaluate((node: HTMLCanvasElement) => node.height > node.width)).toBe(true);
  await page.getByText('Opciones de video', { exact: true }).click();
  await page.getByText('Opciones de imagen PNG / SVG', { exact: true }).click();
  await expect(
    page.getByRole('checkbox', { name: 'Incluir cuadrícula', exact: true }),
  ).not.toBeChecked();
  await expect(page.getByRole('slider', { name: 'Zoom de exportación' })).toHaveValue('1.5');
});

test('capturePanelFitsMobileAndSpatialPngKeepsDarkBackground', async ({ page }, info) => {
  await page.setViewportSize({ width: 360, height: 800 });
  await page.goto('/studio/3d');
  await expect(page.locator('canvas[data-ready]')).toHaveAttribute('data-ready', 'true');
  await page.getByRole('button', { name: 'Exportar y compartir', exact: true }).click();
  const preview = page.getByLabel('Vista previa del encuadre de exportación', { exact: true });
  await expect(preview).toHaveAttribute('aria-busy', 'false');
  const panel = (await page.locator('#export-popover').boundingBox())!;
  expect(panel.x).toBeGreaterThanOrEqual(0);
  expect(panel.x + panel.width).toBeLessThanOrEqual(360);
  expect(panel.y + panel.height).toBeLessThanOrEqual(800);
  await page.screenshot({ path: info.outputPath('capture-mobile.png') });
  const pending = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Imagen PNG', exact: true }).click();
  const bytes = await readFile((await (await pending).path())!);
  expect(bytes.readUInt32BE(16)).toBe(1280);
  await page.getByText('Opciones de imagen PNG / SVG', { exact: true }).click();
  for (const background of ['Negro', 'Transparente']) {
    await page.getByRole('button', { name: background, exact: true }).click();
    const file = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Imagen PNG', exact: true }).click();
    const data = Array.from(await readFile((await (await file).path())!));
    const corner = await page.evaluate(async (data: number[]) => {
      const image = await createImageBitmap(
        new Blob([new Uint8Array(data)], { type: 'image/png' }),
      );
      const c = document.createElement('canvas');
      c.width = image.width;
      c.height = image.height;
      const ctx = c.getContext('2d')!;
      ctx.drawImage(image, 0, 0);
      image.close();
      return Array.from(ctx.getImageData(0, 0, 1, 1).data);
    }, data);
    expect(corner).toEqual(background === 'Negro' ? [0, 0, 0, 255] : [0, 0, 0, 0]);
  }
  await page.getByText('Opciones de imagen PNG / SVG', { exact: true }).click();
  await page.getByText('Opciones de video', { exact: true }).click();
  await expect(page.getByRole('button', { name: 'Transparente', exact: true })).toBeHidden();
  await page.getByRole('button', { name: 'Previsualizar imagen', exact: true }).click();
  await expect(preview).toHaveAttribute('aria-busy', 'false');
  await page.getByRole('button', { name: 'Exportar y compartir', exact: true }).click();
  await expect(page.locator('canvas[data-ready]')).toHaveAttribute('data-live-renderers', '1');
});

test('exportHoverOnlyShowsNonEmptyHintsAndDoesNotLeaveMouseFocusHints', async ({ page }) => {
  await page.goto('/studio/2d');
  await expect(page.locator('canvas[data-ready]')).toHaveAttribute('data-ready', 'true');
  await page.getByRole('button', { name: 'Exportar y compartir', exact: true }).click();
  const image = page.getByRole('button', { name: 'Previsualizar imagen', exact: true });
  const video = page.getByRole('button', { name: 'Previsualizar video', exact: true });
  const hints = () =>
    page.locator('.icon-button').evaluateAll((buttons) =>
      buttons.flatMap((button) => {
        const style = getComputedStyle(button, '::after');
        if (
          style.visibility !== 'visible' ||
          style.opacity === '0' ||
          style.content === 'none' ||
          style.content === 'normal'
        )
          return [];
        return [style.content.replace(/^["']|["']$/g, '')];
      }),
    );
  await image.click();
  await video.hover();
  await expect.poll(hints).toEqual(['Previsualizar video']);
  await page.getByRole('heading', { name: 'Exportar creación', exact: true }).hover();
  await expect.poll(hints).toEqual([]);
  await page.keyboard.press('Tab');
  await expect(video).toBeFocused();
  await expect.poll(hints).toEqual(['Previsualizar video']);
  await page.keyboard.press('Tab');
  const refresh = page.getByRole('button', { name: 'Actualizar vista previa', exact: true });
  await expect(refresh).toBeFocused();
  await expect.poll(hints).toEqual(['Actualizar vista previa']);
  const hintBounds = await refresh.evaluate((button) => {
    const style = getComputedStyle(button, '::after');
    const right = button.getBoundingClientRect().right - parseFloat(style.right);
    return { left: right - parseFloat(style.width), right, viewport: innerWidth };
  });
  expect(hintBounds.left).toBeGreaterThanOrEqual(0);
  expect(hintBounds.right).toBeLessThanOrEqual(hintBounds.viewport);
  await page.screenshot({ path: test.info().outputPath('export-hover-hint.png') });
});
