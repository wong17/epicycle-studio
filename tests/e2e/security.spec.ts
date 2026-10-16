import { test, expect } from '@playwright/test';
import { readFile } from 'node:fs/promises';

test('productionValidationRespectsCsp', async ({ page }) => {
  const headers = await readFile('public/_headers', 'utf8');
  const policy = headers.match(/Content-Security-Policy: (.+)/)?.[1].trim();
  expect(policy).toBeTruthy();
  expect(policy).not.toContain('unsafe-eval');
  const violations: string[] = [];
  const diagnostics: string[] = [];
  await page.exposeFunction('recordCspViolation', (directive: string, source: string) => {
    violations.push(`${directive}: ${source}`);
  });
  await page.addInitScript(() => {
    document.addEventListener('securitypolicyviolation', (event) => {
      const reporter = window as Window & {
        recordCspViolation: (directive: string, source: string) => Promise<void>;
      };
      void reporter.recordCspViolation(event.effectiveDirective, event.blockedURI);
    });
  });
  page.on('console', (message) => {
    if (message.type() === 'warning' || message.type() === 'error')
      diagnostics.push(message.text());
  });
  page.on('pageerror', (error) => diagnostics.push(error.message));
  const response = await page.goto('/studio/2d');
  expect(response?.headers()['content-security-policy']).toBe(policy);
  await expect(page.locator('script:not([src])')).toHaveCount(0);
  await expect(page.locator('canvas[data-ready]')).toHaveAttribute('data-ready', 'true');
  expect(violations).toEqual([]);
  expect(diagnostics).toEqual([]);
  await page.getByRole('button', { name: 'Exportar y compartir', exact: true }).click();
  const pending = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Proyecto JSON', exact: true }).click();
  const download = await pending;
  await page.locator('input[type=file]').setInputFiles((await download.path())!);
  await expect(page.locator('canvas[data-ready]')).toHaveAttribute('data-ready', 'true');
  await page.getByRole('button', { name: 'Abrir como copia', exact: true }).click();
  await page.getByRole('button', { name: 'Guardar ↗', exact: true }).click();
  await page.getByRole('button', { name: 'Espacio 3D', exact: true }).click();
  await expect(page.locator('canvas[data-ready]')).toHaveAttribute('data-ready', 'true');
  await page.reload();
  await expect(page.locator('canvas[data-ready]')).toHaveAttribute('data-ready', 'true');
  await page.goto('/learn');
  await expect(page.getByRole('main')).toBeVisible();
  expect(violations).toEqual([]);
  expect(diagnostics).toEqual([]);
});
