import { test, expect } from '@playwright/test';
import { writeFile } from 'node:fs/promises';
test('recordsDesktopFrameBudgetAndLazyLoading', async ({ page }, info) => {
  test.skip(info.project.name !== 'chromium', 'Reference desktop measurement uses Chromium');
  const urls: string[] = [];
  page.on('request', (r) => urls.push(r.url()));
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/studio/2d');
  await expect(page.locator('canvas[data-ready]')).toHaveAttribute('data-ready', 'true');
  const loaded2d = [...urls];
  await page.getByRole('button', { name: 'Reproducir', exact: true }).click();
  const measure = async () =>
    page.evaluate(async () => {
      const intervals: number[] = [],
        start = performance.now();
      let last = start;
      await new Promise<void>((resolve) => {
        const frame = (now: number) => {
          intervals.push(now - last);
          last = now;
          if (now - start >= 2500) resolve();
          else requestAnimationFrame(frame);
        };
        requestAnimationFrame(frame);
      });
      intervals.sort((a, b) => a - b);
      return {
        count: intervals.length,
        p50: intervals[Math.floor(intervals.length * 0.5)],
        p95: intervals[Math.floor(intervals.length * 0.95)],
        p99: intervals[Math.floor(intervals.length * 0.99)],
        userAgent: navigator.userAgent,
        dpr: devicePixelRatio,
      };
    });
  const flat = await measure();
  await page.getByRole('button', { name: 'Espacio 3D', exact: true }).click();
  await expect(page.locator('canvas[data-ready]')).toHaveAttribute('data-ready', 'true');
  await page.getByRole('button', { name: 'Reproducir', exact: true }).click();
  const spatial = await measure(),
    calls = Number(await page.locator('canvas[data-ready]').getAttribute('data-draw-calls'));
  expect(calls).toBeLessThanOrEqual(100);
  const report = {
    viewport: { width: 1440, height: 900 },
    flat,
    spatial,
    drawCalls: calls,
    loaded2d,
    additional3d: urls.filter((url) => !loaded2d.includes(url)),
  };
  await writeFile('docs/performance-measured.json', JSON.stringify(report, null, 2));
});
