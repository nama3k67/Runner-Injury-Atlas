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

test('the page says which 3D parts are illustrations, even before the scene loads', async ({
  request,
}) => {
  const html = await (await request.get('/itbs')).text();
  expect(html).toContain('Lớp mỡ, sợi Kaplan và mũi tên là phần minh họa thêm');
});

test.describe('picking a structure in the 3D scene', () => {
  // The camera frames the whole leg from the lateral side, so the centre of the canvas is on the thigh.
  test.beforeEach(async ({ page }) => {
    await page.goto('/itbs');
    await expect(page.getByTestId('sim-stage')).toHaveAttribute('data-state', 'ready', {
      timeout: 20_000,
    });
  });

  const centre = async (page: import('@playwright/test').Page) => {
    const box = await page.getByTestId('sim-stage').locator('canvas').boundingBox();
    if (!box) throw new Error('canvas has no box');
    return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
  };

  const tab = (page: import('@playwright/test').Page, name: string) =>
    page.getByRole('tablist', { name: 'Bảng mô phỏng' }).getByRole('tab', { name });

  test('a click opens the term in the side panel, related terms open from it, and it can be cleared', async ({
    page,
  }, info) => {
    await expect(tab(page, 'Điều khiển')).toHaveAttribute('aria-selected', 'true');
    const { x, y } = await centre(page);
    await page.mouse.click(x, y);

    const panel = page.getByTestId('term-panel');
    await expect(tab(page, 'Mục từ')).toHaveAttribute('aria-selected', 'true');
    await expect(panel).toBeVisible();
    // Side by side on desktop: the reader sees the term without scrolling (v0.3 stacks on phones).
    if (info.project.name === 'desktop') await expect(panel.getByRole('heading')).toBeInViewport();
    const first = await panel.getByRole('heading').textContent();
    await expect(panel.getByText(/^Vai trò trong /)).toBeVisible();

    const related = panel
      .getByRole('navigation', { name: 'Thuật ngữ liên quan' })
      .getByRole('button');
    const target = await related.first().textContent();
    await related.first().click();
    await expect(panel.getByRole('heading')).toHaveText(target ?? '');
    expect(target).not.toBe(first);

    await panel.getByRole('button', { name: 'Bỏ chọn' }).click();
    await expect(panel).toHaveCount(0);
    await expect(page.getByTestId('term-hint')).toBeVisible();

    await tab(page, 'Điều khiển').click();
    await expect(page.getByLabel('Góc gập gối')).toBeVisible();
  });

  test('hovering names the structure where the pointer stops, with a pointer cursor', async ({
    page,
  }) => {
    const canvas = page.getByTestId('sim-stage').locator('canvas');
    const tip = page.getByTestId('sim-tip');
    const { x, y } = await centre(page);
    await page.mouse.click(x, y);
    const name = await page.getByTestId('term-panel').getByRole('heading').textContent();
    await expect(tip).toBeHidden();

    // Let the click's own hover window (90 ms) close, then make two moves inside a fresh one:
    // the tooltip must follow the second, where the pointer stops.
    await page.waitForTimeout(200);
    await page.mouse.move(x - 5, y);
    await page.mouse.move(x, y);
    await expect(tip).toHaveText(name ?? '');
    await expect(canvas).toHaveCSS('cursor', 'pointer');
  });

  test('an orbit drag does not open a term', async ({ page }) => {
    const { x, y } = await centre(page);
    await page.mouse.move(x, y);
    await page.mouse.down();
    await page.mouse.move(x + 40, y + 10, { steps: 5 });
    await page.mouse.up();
    await expect(tab(page, 'Điều khiển')).toHaveAttribute('aria-selected', 'true');
    await expect(page.getByTestId('term-panel')).toHaveCount(0);
  });

  test('structures in hidden layers cannot be picked', async ({ page }) => {
    const layers = page.getByRole('group', { name: 'Lớp hiển thị' });
    for (const name of ['Xương', 'Cơ', 'Dải chậu chày', 'Lớp mỡ']) {
      await layers.getByRole('button', { name, exact: true }).click();
    }
    const { x, y } = await centre(page);
    await page.mouse.click(x, y);
    await expect(tab(page, 'Điều khiển')).toHaveAttribute('aria-selected', 'true');
    await expect(page.getByTestId('term-panel')).toHaveCount(0);
  });
});
