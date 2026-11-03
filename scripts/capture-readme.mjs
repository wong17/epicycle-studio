import { chromium } from 'playwright';
import { mkdir } from 'node:fs/promises';

// Run npm run build and npm run preview before capturing the current interface.
// Usage: node scripts/run.mjs scripts/capture-readme.mjs
const baseURL = process.env.EPICYCLE_CAPTURE_URL ?? 'http://127.0.0.1:4200';
const screenshots = 'docs/screenshots';
await mkdir(screenshots, { recursive: true });
await mkdir('.work/readme-video', { recursive: true });
const browser = await chromium.launch({ channel: 'chromium' });
const errors = [];
try {
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 1,
    recordVideo: { dir: '.work/readme-video', size: { width: 1440, height: 900 } },
  });
  const page = await context.newPage();
  page.on('pageerror', (error) => errors.push(error.message));
  const button = (name) => page.getByRole('button', { name, exact: true });
  const ready = () => page.locator('canvas[data-ready="true"]').waitFor();
  const rest = async (ms) => {
    await page.mouse.move(720, 700);
    await page.waitForTimeout(ms);
  };
  await page.goto(`${baseURL}/studio/2d`);
  await ready();
  await button('Reproducir').click();
  await rest(4500);
  await button('Pausar').click();
  await rest(400);
  await page.screenshot({ path: `${screenshots}/studio-desktop.png` });
  await button('Crear desde…').click();
  const dialog = page.getByRole('dialog', { name: 'Crear desde…', exact: true });
  await dialog.getByRole('button', { name: 'Colibrí en vuelo', exact: true }).click();
  await rest(2000);
  await dialog.getByRole('button', { name: 'Crear y animar', exact: true }).click();
  await dialog.waitFor({ state: 'hidden' });
  await rest(5500);
  await button('Pausar').click();
  await rest(400);
  await page.screenshot({ path: `${screenshots}/hero.png` });
  const components = page.locator('#components');
  const recommended = await components.inputValue();
  await components.fill('24');
  await rest(2000);
  await components.fill(recommended);
  await rest(2000);
  await button('Reproducir').click();
  await rest(3500);
  await button('Espacio 3D').click();
  await ready();
  await rest(1200);
  await button('Reproducir').click();
  await rest(4000);
  await button('Pausar').click();
  await rest(400);
  await page.screenshot({ path: `${screenshots}/studio-3d.png` });
  await rest(1000);
  const video = page.video();
  await context.close();
  await video.saveAs('docs/demo.webm');
  await video.delete();

  // This is a mobile viewport capture, not validation on a physical phone.
  const mobile = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 1,
    isMobile: true,
    hasTouch: true,
  });
  const mobilePage = await mobile.newPage();
  mobilePage.on('pageerror', (error) => errors.push(error.message));
  await mobilePage.goto(`${baseURL}/studio/2d`);
  await mobilePage.locator('canvas[data-ready="true"]').waitFor();
  await mobilePage.getByRole('button', { name: 'Reproducir', exact: true }).click();
  await mobilePage.waitForTimeout(2000);
  await mobilePage.getByRole('button', { name: 'Pausar', exact: true }).click();
  await mobilePage.waitForTimeout(300);
  await mobilePage.screenshot({ path: `${screenshots}/studio-mobile.png`, fullPage: true });
  await mobile.close();
  if (errors.length) throw new Error(errors.join('\n'));
  console.log('Captured 4 screenshots and docs/demo.webm; no page errors.');
} finally {
  await browser.close();
}
