import { test, expect } from '@playwright/test';

test('toolbarUsesOneAccessibleTooltipWithoutNativeDuplicate', async ({ page }) => {
  await page.goto('/studio/2d');
  await expect(page.locator('canvas[data-ready]')).toHaveAttribute('data-ready', 'true');
  const clear = page.getByRole('button', { name: 'Limpiar lienzo', exact: true });
  await expect(clear).not.toHaveAttribute('title');
  await clear.hover();
  const hint = page.getByRole('tooltip');
  await expect(hint).toHaveCount(1);
  await expect(hint).toHaveText('Limpiar lienzo y dibujar desde cero');
  await expect(clear).toHaveAttribute('aria-describedby', /studio-hint-/);
  await page.getByRole('button', { name: 'Crear desde…', exact: true }).hover();
  await expect(hint).toHaveCount(1);
  await expect(hint).toHaveText('Crear desde…');
  await page.mouse.move(500, 300);
  await expect(hint).toHaveCount(0);
  await page.keyboard.press('Tab');
  await clear.focus();
  await expect(hint).toHaveCount(1);
  await page.keyboard.press('Escape');
  await expect(hint).toHaveCount(0);
  await page.getByRole('button', { name: 'Crear desde…', exact: true }).click();
  const close = page.getByRole('button', { name: 'Cerrar creador', exact: true });
  await close.hover();
  await expect(hint).toHaveText('Cerrar creador');
  await expect(close).not.toHaveAttribute('title');
  await close.click();
  await expect(hint).toHaveCount(0);
});

test('inspectorWrapsAllControlsWithoutHorizontalScroll', async ({ page }) => {
  for (const width of [1440, 800, 360, 320]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto('/studio/2d');
    await expect(page.locator('canvas[data-ready]')).toHaveAttribute('data-ready', 'true');
    const toggle = page.getByRole('button', { name: 'Mostrar u ocultar inspector', exact: true });
    if ((await toggle.getAttribute('aria-expanded')) !== 'true') await toggle.click();
    const inspector = page.locator('.inspector');
    await inspector.locator('details').evaluateAll((details) =>
      details.forEach((detail) => {
        detail.open = true;
      }),
    );
    const check = async () => {
      expect(await inspector.evaluate((el) => el.scrollWidth <= el.clientWidth)).toBe(true);
      expect(await inspector.evaluate((el) => el.scrollLeft)).toBe(0);
      const bounds = await inspector.boundingBox();
      for (const control of await inspector.locator('input, button').all()) {
        if (!(await control.isVisible())) continue;
        const box = await control.boundingBox();
        expect(box!.x).toBeGreaterThanOrEqual(bounds!.x);
        expect(box!.x + box!.width).toBeLessThanOrEqual(bounds!.x + bounds!.width);
      }
    };
    await check();
    if (width <= 700) {
      const examples = inspector.getByRole('group', { name: 'Explora un ejemplo' });
      const buttons = await examples.getByRole('button').all();
      expect((await buttons.at(-1)!.boundingBox())!.y).toBeGreaterThan(
        (await buttons[0].boundingBox())!.y,
      );
    }
    await inspector.getByRole('button', { name: '✎ Dibujar mi curva', exact: true }).hover();
    await expect(page.getByRole('tooltip')).toHaveCount(1);
    await check();
    await page.getByRole('button', { name: 'Espacio 3D', exact: true }).click();
    await expect(page.locator('canvas[data-ready]')).toHaveAttribute('data-ready', 'true');
    await inspector.getByRole('button', { name: 'Componer', exact: true }).click();
    await inspector.locator('details').evaluateAll((details) =>
      details.forEach((detail) => {
        detail.open = true;
      }),
    );
    await check();
    if (width === 320)
      await page.screenshot({ path: test.info().outputPath('inspector-wrapped-320.png') });
  }
});

test('keyboardPlaybackDoesNotKeepAnOutdatedTooltip', async ({ page }) => {
  await page.goto('/studio/2d');
  await expect(page.locator('canvas[data-ready]')).toHaveAttribute('data-ready', 'true');
  await page.keyboard.press('Tab');
  const play = page.getByRole('button', { name: 'Reproducir', exact: true });
  await play.focus();
  await expect(page.getByRole('tooltip')).toHaveText('Reproducir');
  await page.keyboard.press('Space');
  await expect(page.getByRole('button', { name: 'Pausar', exact: true })).toBeFocused();
  await expect(page.getByRole('tooltip')).toHaveCount(0);
});
