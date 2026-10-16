import { test, expect } from '@playwright/test';
import { readFile } from 'node:fs/promises';

test('termSliderKeepsAccentControlsStableAndPlaybackRunning', async ({ page }) => {
  await page.goto('/studio/2d');
  await expect(page.locator('canvas[data-ready]')).toHaveAttribute('data-ready', 'true');
  await page.getByText('De simple a preciso', { exact: true }).click();
  await page.getByRole('button', { name: 'Reproducir', exact: true }).click();
  const samples = await page.evaluate(async () => {
    const input = document.querySelector<HTMLInputElement>('#components')!;
    const save = document.querySelector<HTMLButtonElement>('[aria-label="Guardar ↗"]')!;
    const readings: { disabled: boolean; opacity: string; playing: boolean }[] = [];
    for (let count = 72; count <= 160; count += 8) {
      input.value = String(count);
      input.dispatchEvent(new Event('input', { bubbles: true }));
      await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
      readings.push({
        disabled: save.disabled,
        opacity: getComputedStyle(save).opacity,
        playing: !!document.querySelector('[aria-label="Pausar"]'),
      });
    }
    return readings;
  });
  expect(samples.every((s) => !s.disabled && s.opacity === '1' && s.playing)).toBe(true);
  await expect(page.locator('#components')).toHaveValue('160');
  await expect(page.locator('#components')).toHaveAttribute('aria-busy', 'false');
  await expect(page.getByRole('button', { name: 'Pausar', exact: true })).toBeVisible();
});

test('complexFreehandGetsAdaptiveDetailAndCanBeEditedAndColored', async ({ page }, info) => {
  await page.goto('/studio/2d');
  await expect(page.locator('canvas[data-ready]')).toHaveAttribute('data-ready', 'true');
  await page.getByRole('button', { name: 'Limpiar lienzo', exact: true }).click();
  const center = [380, 270];
  await page.mouse.move(495, 270);
  await page.mouse.down();
  for (let i = 1; i <= 220; i++) {
    const angle = (i * Math.PI * 2) / 220;
    const radius = 95 + 20 * Math.cos(angle * 19);
    await page.mouse.move(
      center[0] + radius * Math.cos(angle),
      center[1] + radius * Math.sin(angle),
    );
  }
  await page.mouse.up();
  await page.getByRole('button', { name: 'Editar trazo', exact: true }).click();
  await expect(page.getByText('Dibujo libre · 1 trazo')).toBeVisible();
  await page.getByRole('button', { name: '✎ Dibujar', exact: true }).click();

  await page.getByRole('button', { name: 'Reproducir', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Pausar', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Pausar', exact: true }).click();
  const exportJson = async () => {
    const toggle = page.getByRole('button', { name: 'Exportar y compartir', exact: true });
    if ((await toggle.getAttribute('aria-expanded')) !== 'true') await toggle.click();
    const pending = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Proyecto JSON', exact: true }).click();
    const document = JSON.parse(await readFile((await (await pending).path())!, 'utf8'));
    await page.keyboard.press('Escape');
    return document;
  };
  const original = await exportJson();
  expect(original.analysis.count).toBeGreaterThan(64);
  expect(original.source.strokeStarts).toEqual([0]);
  await page.getByRole('button', { name: 'Editar trazo', exact: true }).click();
  await page.mouse.move(495, 270);
  await page.mouse.down();
  await page.mouse.move(525, 245, { steps: 8 });
  await page.mouse.up();
  await page.getByRole('button', { name: 'Reproducir', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Pausar', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Pausar', exact: true }).click();
  const edited = await exportJson();
  expect(edited.source.points).not.toEqual(original.source.points);
  expect(edited.source.points).toHaveLength(original.source.points.length);
  expect(edited.source.points[0][0]).toBeGreaterThan(original.source.points[0][0]);
  await page.getByText('Lo que ves', { exact: true }).click();
  await page.getByRole('button', { name: 'RGB animado', exact: true }).click();
  await expect(page.getByRole('button', { name: 'RGB animado', exact: true })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  const canvas = page.locator('canvas[data-ready]');
  const colorCount = () =>
    canvas.evaluate((node: HTMLCanvasElement) => {
      const data = node.getContext('2d')!.getImageData(0, 0, node.width, node.height).data;
      const colors = new Set();
      for (let i = 0; i < data.length; i += 4)
        if (
          Math.max(data[i], data[i + 1], data[i + 2]) -
            Math.min(data[i], data[i + 1], data[i + 2]) >
          80
        )
          colors.add(
            Math.floor(data[i] / 32) +
              ',' +
              Math.floor(data[i + 1] / 32) +
              ',' +
              Math.floor(data[i + 2] / 32),
          );
      return colors.size;
    });
  await expect.poll(colorCount).toBeGreaterThan(8);
  await page.screenshot({ path: info.outputPath('detail-rgb-edit.png') });
  const colored = await exportJson();
  expect(colored.appearance.colorMode).toBe('spectrum');
});
