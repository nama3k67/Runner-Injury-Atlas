import { expect, test } from '@playwright/test';

test('prerendered HTML ships a placeholder, not the 3D scene', async ({ request }) => {
  const html = await (await request.get('/itbs')).text();
  expect(html).toContain('data-testid="sim-placeholder"');
  expect(html).not.toContain('<canvas');
  expect(html).not.toContain('<iframe');
});

test('ITBS page renders the R3F scene instead of the legacy iframe', async ({ page }) => {
  await page.goto('/itbs');
  const stage = page.getByTestId('sim-stage');
  // The first scene in a fresh browser blocks the main thread for seconds (cold shader compile,
  // >5 s on CI's software GL), so wait for readiness before querying the DOM.
  await expect(stage).toHaveAttribute('data-state', 'ready', { timeout: 20_000 });
  await expect(stage.locator('canvas')).toBeVisible();
  await expect(page.locator('#sim ~ iframe, section iframe')).toHaveCount(0);
  await expect(page.getByRole('link', { name: 'Xem bản v0.3' })).toHaveAttribute(
    'href',
    '/legacy/v0.3/index.html',
  );
});

test('knee angle drives the impingement readout', async ({ page }) => {
  await page.goto('/itbs');
  // The stage only exists after hydration, so slider events reach React from here on.
  await expect(page.getByTestId('sim-stage')).toBeVisible();
  const knee = page.getByLabel('Góc gập gối');
  const zone = page.getByTestId('sim-zone');
  const pressure = page.getByTestId('sim-compression');

  await expect(zone).toHaveText('Ngoài vùng ép');
  await knee.fill('25');
  await expect(page.getByTestId('sim-knee')).toHaveText('25°');
  await expect(zone).toHaveText('TRONG VÙNG ÉP');
  await expect(pressure).not.toHaveText('0%');

  await knee.fill('0');
  await expect(zone).toHaveText('Ngoài vùng ép');
  await expect(pressure).toHaveText('0%');
});

test('layer buttons toggle and report their state', async ({ page }) => {
  await page.goto('/itbs');
  await expect(page.getByTestId('sim-stage')).toBeVisible();
  const layers = page.getByRole('group', { name: 'Lớp hiển thị' });
  for (const name of ['Xương', 'Cơ', 'Dải chậu chày', 'Lớp mỡ']) {
    await expect(layers.getByRole('button', { name, exact: true })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
  }

  const muscle = layers.getByRole('button', { name: 'Cơ', exact: true });
  await muscle.click();
  await expect(muscle).toHaveAttribute('aria-pressed', 'false');
  await muscle.click();
  await expect(muscle).toHaveAttribute('aria-pressed', 'true');
});
