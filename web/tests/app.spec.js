import { test, expect } from '@playwright/test';

async function demo(page) {
  await page.goto('/');
  await page.getByRole('button', { name: /Try demo/ }).click();
  await expect(page.getByRole('heading', { name: /Let’s go, Alex/ })).toBeVisible();
}
async function navigate(page, name) { await page.getByRole('navigation', { name: 'Main navigation' }).getByRole('button', { name, exact: true }).click(); }
test.beforeEach(async ({ page }) => {
  await page.route('https://tile.openstreetmap.org/**', route => route.fulfill({ status: 200, contentType: 'image/png', body: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=', 'base64') }));
});

test('onboarding validates and persists a real profile', async ({ page }) => {
  await page.goto('/');
  await page.getByLabel('What should we call you?').fill('Sam');
  await page.getByRole('button', { name: 'Continue', exact: true }).click();
  await page.getByRole('checkbox', { name: 'Dumbbells', exact: true }).check();
  await page.getByRole('button', { name: 'Continue', exact: true }).click();
  await page.getByRole('checkbox', { name: 'Vegan', exact: true }).check();
  await page.getByRole('button', { name: 'Build my day' }).click();
  await expect(page.getByRole('heading', { name: /Let’s go, Sam/ })).toBeVisible();
  await page.reload();
  await expect(page.getByRole('heading', { name: /Let’s go, Sam/ })).toBeVisible();
  await navigate(page, 'Fuel');
  await expect(page.getByRole('heading', { name: 'Golden tofu power bowl' })).toBeVisible();
});

test('all tabs render at iPhone width with no overflow or JS exceptions', async ({ page }) => {
  const errors = []; page.on('pageerror', error => errors.push(error.message));
  await demo(page);
  await page.screenshot({ path: 'test-results/FitCraft-Today.png', fullPage: true });
  for (const tab of ['Train', 'Fuel', 'Explore', 'Records', 'Today']) {
    await navigate(page, tab);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  }
  expect(errors).toEqual([]);
});

test('exercise completion enables finish and persists exactly one daily workout', async ({ page }) => {
  await demo(page); await navigate(page, 'Train');
  await expect(page.getByRole('button', { name: 'Finish your workout' })).toBeDisabled();
  for (let index = 0; index < 6; index++) await page.getByRole('button', { name: /^Complete / }).first().click();
  await page.getByRole('button', { name: 'Finish your workout' }).click();
  await expect(page.getByRole('button', { name: 'Today’s workout completed' })).toBeDisabled();
  await page.reload(); await navigate(page, 'Train');
  await expect(page.getByRole('button', { name: 'Today’s workout completed' })).toBeDisabled();
  const logs = await page.evaluate(() => JSON.parse(localStorage.getItem('fitcraft.web.v1')).logs);
  expect(Object.values(logs).filter(log => log.workout)).toHaveLength(1);
});

test('meal logging updates macros, survives reload and can be undone', async ({ page }) => {
  await demo(page); await navigate(page, 'Fuel');
  await page.getByRole('button', { name: 'Log meal', exact: true }).first().click();
  await navigate(page, 'Today');
  await expect(page.getByRole('img', { name: 'Protein: 38 of 120 grams logged' })).toBeVisible();
  await page.reload(); await navigate(page, 'Fuel');
  await page.getByRole('button', { name: 'Logged', exact: true }).click();
  await navigate(page, 'Today');
  await expect(page.getByRole('img', { name: 'Protein: 0 of 120 grams logged' })).toBeVisible();
});

test('shopping items persist, and recipe dialog opens and closes', async ({ page }) => {
  await demo(page); await navigate(page, 'Fuel');
  await page.getByRole('button', { name: 'Recipe', exact: true }).first().click();
  await expect(page.getByRole('dialog').getByText('Keep it simple')).toBeVisible();
  await page.getByRole('button', { name: 'Close dialog' }).click();
  await page.getByRole('button', { name: 'Your weekly shopping list' }).click();
  await page.getByRole('dialog').getByRole('checkbox').first().check();
  await page.getByRole('button', { name: 'Close dialog' }).click();
  await page.reload(); await navigate(page, 'Fuel');
  await page.getByRole('button', { name: 'Your weekly shopping list' }).click();
  await expect(page.getByRole('dialog').getByRole('checkbox').first()).toBeChecked();
});

test('sample segment creation works and is clearly not a real navigation route', async ({ page }) => {
  await demo(page); await navigate(page, 'Explore');
  await page.getByRole('button', { name: 'Make a segment' }).click();
  await page.getByLabel('Segment name').fill('Practice loop');
  await page.getByRole('button', { name: 'Save segment' }).click();
  await navigate(page, 'Records');
  await expect(page.getByRole('heading', { name: 'Practice loop' })).toBeVisible();
  await page.getByRole('button', { name: 'Attempt this segment' }).click();
  await expect(page.getByRole('heading', { name: 'This is a sample course.' })).toBeVisible();
});

test('route generation saves service geometry; failed requests create no fake routes', async ({ page, context }) => {
  await context.grantPermissions(['geolocation']);
  await context.setGeolocation({ latitude: 59.3385, longitude: 18.026, accuracy: 5 });
  await page.route('https://routing.openstreetmap.de/**', route => route.fulfill({ json: { code: 'Ok', routes: [{ distance: 4500, geometry: { coordinates: [[18.026, 59.3385], [18.03, 59.35], [18.04, 59.34], [18.026, 59.3385]] }, legs: [{ steps: [{ distance: 200, name: 'Park path', maneuver: { type: 'turn', modifier: 'left' } }] }] }] } }));
  await demo(page); await navigate(page, 'Explore');
  await page.getByRole('button', { name: 'Find a discovery loop' }).click();
  await expect(page.getByRole('heading', { name: '4.5 km discovery loop' })).toBeVisible();
  await page.route('https://routing.openstreetmap.de/**', route => route.fulfill({ status: 503, body: 'Unavailable' }));
  await page.getByRole('button', { name: 'Find a discovery loop' }).click();
  await expect(page.locator('#toast')).toContainText('temporarily unavailable');
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('fitcraft.web.v1')).routes.length)).toBe(2);
});

test('outdoor recording saves GPS movement and an activity journal entry', async ({ page, context }) => {
  await context.grantPermissions(['geolocation']);
  await context.setGeolocation({ latitude: 59.3385, longitude: 18.026, accuracy: 5 });
  await demo(page); await navigate(page, 'Explore');
  await page.getByRole('button', { name: 'Start an outdoor workout' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Walk', exact: true }).click();
  await expect(page.getByText('RECORDING', { exact: true })).toBeVisible();
  await context.setGeolocation({ latitude: 59.3385, longitude: 18.026, accuracy: 5 });
  await expect(page.locator('#live-accuracy')).toContainText('±5m');
  await page.waitForTimeout(1200);
  await context.setGeolocation({ latitude: 59.33855, longitude: 18.026, accuracy: 5 });
  await page.waitForTimeout(1200);
  await context.setGeolocation({ latitude: 59.33860, longitude: 18.026, accuracy: 5 });
  await expect.poll(async () => Number(await page.locator('#live-distance').textContent())).toBeGreaterThan(0);
  await page.getByRole('button', { name: 'Finish workout' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Finish workout' }).click();
  await page.getByRole('button', { name: 'Save my workout' }).click();
  await expect(page.getByText('Outdoor walk', { exact: true })).toBeVisible();
  const sessions = await page.evaluate(() => JSON.parse(localStorage.getItem('fitcraft.web.v1')).sessions);
  expect(sessions).toHaveLength(1); expect(sessions[0].points).toBeGreaterThan(1); expect(sessions[0].distance).toBeGreaterThan(0);
});

test('offline service worker restores the app and saved data', async ({ page, context }) => {
  await demo(page);
  await page.evaluate(() => navigator.serviceWorker.ready);
  await expect.poll(() => page.evaluate(() => Boolean(navigator.serviceWorker.controller))).toBe(true);
  await context.setOffline(true);
  await page.reload();
  await expect(page.getByRole('heading', { name: /Let’s go, Alex/ })).toBeVisible();
  await navigate(page, 'Train');
  await expect(page.getByRole('heading', { name: 'Strong foundations' })).toBeVisible();
});

test('Home Screen instructions and edited profile are usable on mobile', async ({ page }) => {
  await demo(page);
  await page.getByRole('button', { name: /Add FitCraft to your Home Screen/ }).click();
  await expect(page.getByRole('dialog').getByText('Add to Home Screen', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Close dialog' }).click();
  await page.getByRole('button', { name: 'Edit profile' }).click();
  await page.getByLabel('What should we call you?').fill('<Sam>');
  await page.getByRole('button', { name: 'Save my profile' }).click();
  await expect(page.getByRole('heading', { name: /Let’s go, <Sam>/ })).toBeVisible();
});
