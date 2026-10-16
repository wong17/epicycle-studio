import { test, expect, Page } from '@playwright/test';

async function createDraft(page: Page): Promise<void> {
  await page.goto('/studio/2d');
  await expect(page.locator('canvas[data-ready]')).toHaveAttribute('data-ready', 'true');
  const name = page.getByRole('textbox', { name: 'Nombre del proyecto' });
  await name.fill('Borrador pendiente');
  await name.blur();
  await expect
    .poll(() =>
      page.evaluate(async () => {
        const db = await new Promise<IDBDatabase>((resolve, reject) => {
          const request = indexedDB.open('epicycle-studio', 1);
          request.onsuccess = () => resolve(request.result);
          request.onerror = () => reject(request.error);
        });
        try {
          return await new Promise<number>((resolve, reject) => {
            const request = db.transaction('drafts').objectStore('drafts').count();
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
          });
        } finally {
          db.close();
        }
      }),
    )
    .toBeGreaterThan(0);
  await page.reload();
  await expect(page.getByRole('region', { name: 'Recuperar borrador' })).toBeVisible();
}

test('recoverSaveAndReloadDoesNotRepeatDraftNotice', async ({ page }) => {
  await createDraft(page);
  await page.getByRole('button', { name: 'Recuperar', exact: true }).click();
  await expect(page.getByRole('textbox', { name: 'Nombre del proyecto' })).toHaveValue(
    'Borrador pendiente',
  );
  await expect(page.getByText('Sin guardar', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Guardar ↗', exact: true }).click();
  await expect(
    page.getByText('Proyecto guardado en este navegador', { exact: true }),
  ).toBeVisible();
  await page.reload();
  await expect(page.locator('canvas[data-ready]')).toHaveAttribute('data-ready', 'true');
  await expect(page.getByRole('region', { name: 'Recuperar borrador' })).toHaveCount(0);
});

test('discardAndReloadDoesNotRepeatDraftNotice', async ({ page }) => {
  await createDraft(page);
  await page.getByRole('button', { name: 'Descartar', exact: true }).click();
  await expect(page.getByRole('region', { name: 'Recuperar borrador' })).toHaveCount(0);
  await page.reload();
  await expect(page.locator('canvas[data-ready]')).toHaveAttribute('data-ready', 'true');
  await expect(page.getByRole('region', { name: 'Recuperar borrador' })).toHaveCount(0);
});
