import { test, expect } from '@playwright/test';

async function demo(page) {
  await page.goto('/');
  await page.getByRole('button', { name: /Try demo/ }).click();
  await expect(page.getByRole('heading', { name: /Today, Alex/ })).toBeVisible();
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
  await expect(page.getByRole('heading', { name: /Today, Sam/ })).toBeVisible();
  await page.reload();
  await expect(page.getByRole('heading', { name: /Today, Sam/ })).toBeVisible();
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
  await expect(page.getByRole('heading', { name: /Today, Alex/ })).toBeVisible();
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
  await expect(page.getByRole('heading', { name: /Today, <Sam>/ })).toBeVisible();
});

test('race wizard saves pace zones and plan across reload', async ({ page }) => {
  await demo(page); await navigate(page, 'Train');
  await page.getByRole('button', { name: 'Set a race goal', exact: true }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Continue', exact: true }).click();
  await page.getByLabel('Actual finish time · minutes').fill('25');
  await page.getByRole('dialog').getByRole('button', { name: 'Continue', exact: true }).click();
  await page.getByText('Training details', { exact: true }).click();
  await expect(page.getByRole('dialog').getByText('Easy / recovery', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Save recommended plan', exact: true }).click();
  await expect(page.getByRole('heading', { name: '5K · 12-week plan' })).toBeVisible();
  await page.reload(); await navigate(page, 'Train');
  await page.getByRole('button', { name: 'View endurance plan', exact: true }).click();
  await page.getByText('Training details', { exact: true }).click();
  await expect(page.getByRole('dialog').getByText('Week 12', { exact: true })).toBeVisible();
});

test('race wizard rejects insufficient marathon base without losing existing data', async ({ page }) => {
  await demo(page); await navigate(page, 'Train');
  await page.getByRole('button', { name: 'Set a race goal', exact: true }).click();
  await page.getByLabel('Race distance').selectOption('42195');
  await page.getByLabel('Target finish time · minutes').fill('240');
  await page.getByRole('dialog').getByRole('button', { name: 'Continue', exact: true }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Continue', exact: true }).click();
  await expect(page.locator('#dialog-status')).toContainText('marathon template needs');
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('fitcraft.web.v1')).runningPlans)).toEqual([]);
});

test('recovery setup explains wearable limits and saves a manual measurement once per day', async ({ page }) => {
  await demo(page); await navigate(page, 'Train');
  await page.getByRole('button', { name: 'Recovery', exact: true }).click();
  await expect(page.getByRole('dialog').getByText(/Safari cannot access Apple Health/)).toBeVisible();
  await page.getByLabel('HRV · SDNN milliseconds').fill('50');
  await page.getByLabel('Sleep · hours').fill('8');
  await page.getByLabel('Device / source name').fill('My Watch');
  await page.getByRole('button', { name: 'Save check-in' }).click();
  await expect(page.getByRole('heading', { name: 'Building your baseline' })).toBeVisible();
  await page.getByLabel('HRV · SDNN milliseconds').fill('55');
  await page.getByLabel('Sleep · hours').fill('7');
  await page.getByRole('button', { name: 'Save check-in' }).click();
  const data = await page.evaluate(() => JSON.parse(localStorage.getItem('fitcraft.web.v1')).healthMetrics);
  expect(data).toHaveLength(1); expect(data[0].hrv).toBe(55); expect(data[0].manual).toBe(true);
});

async function kitchen(page) {
  await page.getByRole('button', { name: /Snap fridge/ }).click();
  await expect(page.getByRole('heading', { name: 'Your smart kitchen.' })).toBeVisible();
}
async function pantryItem(page, name, grams) {
  await page.getByRole('checkbox', { name, exact: true }).check();
  await page.getByLabel(`Available grams · ${name}`, { exact: true }).fill(String(grams));
}
test('Today opens workout in one tap and kitchen recipes persist and log macros', async ({ page }) => {
  await demo(page);
  await page.getByRole('button', { name: 'Start workout', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Strong foundations' })).toBeVisible();
  await navigate(page, 'Today'); await kitchen(page);
  await expect(page.getByText(/AI recognition isn’t connected yet/)).toBeVisible();
  await pantryItem(page, 'Firm tofu', 200); await pantryItem(page, 'Rice, dry', 75); await pantryItem(page, 'Broccoli', 150);
  await page.getByRole('button', { name: 'Confirm & find recipes' }).click();
  await expect(page.getByRole('heading', { name: 'Steamed tofu & broccoli rice bowl' })).toBeVisible();
  await page.getByText('Ingredients & step-by-step recipe', { exact: true }).click();
  await expect(page.getByText(/0.5 g Salt · missing/)).toBeVisible();
  await page.getByRole('button', { name: 'Log this meal' }).click();
  await page.getByRole('button', { name: 'Close dialog' }).click();
  await expect(page.getByRole('img', { name: 'Protein: 37 of 120 grams logged' })).toBeVisible();
  await page.reload(); await kitchen(page);
  await expect(page.getByLabel('Available grams · Firm tofu', { exact: true })).toHaveValue('200');
  await page.getByRole('button', { name: 'Confirm & find recipes' }).click();
  await page.getByRole('button', { name: 'Undo meal log' }).click();
  await page.getByRole('button', { name: 'Close dialog' }).click();
  await expect(page.getByRole('img', { name: 'Protein: 0 of 120 grams logged' })).toBeVisible();
});
test('incomplete pantry offers missing-ingredient shopping without inventing a recipe', async ({ page }) => {
  await demo(page); await kitchen(page); await pantryItem(page, 'Firm tofu', 100);
  await page.getByRole('button', { name: 'Confirm & find recipes' }).click();
  await expect(page.getByText(/No complete recipe matches/)).toBeVisible();
  await page.getByText('Shop for another recipe', { exact: true }).click();
  await page.getByRole('button', { name: 'Add missing ingredients', exact: true }).first().click();
  await page.getByRole('button', { name: 'Close dialog' }).click();
  await navigate(page, 'Fuel'); await page.getByRole('button', { name: 'Your weekly shopping list' }).click();
  await expect(page.getByRole('dialog').getByText('Firm tofu', { exact: true })).toBeVisible();
  const extras = await page.evaluate(() => JSON.parse(localStorage.getItem('fitcraft.web.v1')).extraShopping);
  expect(extras.find(i => i.name === 'Firm tofu').quantity).toBe(100);
});
test('fridge photos preview locally, cap at three and never enter saved data', async ({ page }) => {
  await demo(page); await kitchen(page);
  const image = { name: 'fridge.png', mimeType: 'image/png', buffer: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=', 'base64') };
  await page.getByLabel('Choose fridge photos').setInputFiles([image, {...image,name:'second.png'}, {...image,name:'third.png'}]);
  await expect(page.getByRole('img', { name: 'Fridge photo 3' })).toBeVisible();
  await expect(page.getByLabel('Choose fridge photos')).toBeDisabled();
  await page.getByRole('button', { name: 'Remove photo 2' }).click();
  await expect(page.getByLabel('Choose fridge photos')).toBeEnabled();
  const saved = await page.evaluate(() => localStorage.getItem('fitcraft.web.v1'));
  expect(saved).not.toContain('blob:'); expect(saved).not.toContain('base64');
  await page.screenshot({ path: 'test-results/FitCraft-Kitchen.png', fullPage: true });
});
test('ambitious marathon reviews a longer timeline before save', async ({ page }) => {
  await demo(page); await page.getByRole('button', { name: /Set an endurance goal/ }).click();
  await page.getByLabel('Race distance', { exact: true }).selectOption('42195');
  await page.getByLabel('Target finish time · minutes').fill('210');
  await page.getByLabel('Training days per week').fill('4'); await page.getByLabel('Plan length · weeks').fill('6');
  await page.getByRole('dialog').getByRole('button', { name: 'Continue', exact: true }).click();
  await page.getByLabel('Current weekly distance · km').fill('25');
  await page.getByRole('dialog').getByRole('button', { name: 'Continue', exact: true }).click();
  await expect(page.getByRole('dialog').getByText(/your target is substantially faster/)).toBeVisible();
  await expect(page.getByRole('heading', { name: '16 weeks · 4 days' })).toBeVisible();
  await page.getByRole('button', { name: 'Save recommended plan' }).click();
  const plan = await page.evaluate(() => JSON.parse(localStorage.getItem('fitcraft.web.v1')).runningPlans[0]);
  expect(plan.goal.weeks).toBe(16); expect(plan.requestedWeeks).toBe(6);
});
test('weekly check-in adjusts once and survives reload', async ({ page }) => {
  await demo(page); await page.getByRole('button', { name: /Set an endurance goal/ }).click();
  for (let i = 0; i < 2; i++) await page.getByRole('dialog').getByRole('button', { name: 'Continue', exact: true }).click();
  await page.getByRole('button', { name: 'Save recommended plan' }).click();
  await page.evaluate(() => {
    const data = JSON.parse(localStorage.getItem('fitcraft.web.v1'));
    const start = new Date(); start.setDate(start.getDate() - 14);
    data.runningPlans[0].startsOn = `${start.getFullYear()}-${String(start.getMonth()+1).padStart(2,'0')}-${String(start.getDate()).padStart(2,'0')}`;
    localStorage.setItem('fitcraft.web.v1', JSON.stringify(data));
  });
  await page.reload(); await page.getByRole('button', { name: /Review endurance plan/ }).click();
  await page.getByLabel('Completed distance · km').fill('8'); await page.getByRole('button', { name: 'Update my plan' }).click();
  await expect(page.getByText('This week has already been reviewed.', { exact: true })).toBeVisible();
  await page.reload();
  const plan = await page.evaluate(() => JSON.parse(localStorage.getItem('fitcraft.web.v1')).runningPlans[0]);
  expect(plan.weeks).toHaveLength(14); expect(plan.adjustments).toHaveLength(1);
});
