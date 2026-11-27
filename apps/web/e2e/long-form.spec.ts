import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { expect, test } from '@playwright/test';

interface SectionsFile {
  mechanism: { title: string };
  causes: { title: string };
  symptoms: { title: string };
  tests: { title: string; items: { name: string; scene?: { term: string; kneeAngle: number } }[] };
}
// Expected headings come from the content, so the test follows content edits.
const sections = JSON.parse(
  readFileSync(join(process.cwd(), '../../content/injuries/itbs/sections.json'), 'utf8'),
) as SectionsFile;
const titles = [sections.mechanism, sections.causes, sections.symptoms, sections.tests].map(
  (s) => s.title,
);

test('the long-form sections are in the prerendered HTML', async ({ request }) => {
  const html = await (await request.get('/itbs')).text();
  // React escapes "&" in text, as in "Triệu chứng & phân biệt".
  for (const title of titles) expect(html).toContain(`>${title.replaceAll('&', '&amp;')}</h2>`);
});

test('the long-form sections render with numbered source links', async ({ page }) => {
  await page.goto('/itbs');
  for (const title of titles) {
    await expect(page.getByRole('heading', { level: 2, name: title, exact: true })).toBeVisible();
  }
  const ref = page.locator('section[aria-labelledby="co-che"] sup a').first();
  const target = await ref.getAttribute('href');
  expect(target).toMatch(/^#r\d+$/);
  await expect(page.locator(`ol.sources li${target}`)).toBeVisible();
});

test('sources cited together read "1,2", not "12"', async ({ page }) => {
  await page.goto('/itbs');
  // The mechanism intro cites two sources in a row.
  const intro = page.locator('section[aria-labelledby="co-che"] .intro');
  await expect(intro.locator('sup')).toHaveCount(2);
  await expect(intro.locator('sup').nth(1)).toHaveText(/^,\d+$/);
});

test('a clinical test opens its term in the 3D scene at its knee angle', async ({ page }) => {
  // One scene action after the first load (lessons.md L1).
  const test3d = sections.tests.items.find((t) => t.scene);
  if (!test3d?.scene) throw new Error('sections.json has no test with a scene');
  await page.goto('/itbs');
  await expect(page.getByTestId('sim-stage')).toHaveAttribute('data-state', 'ready', {
    timeout: 20_000,
  });
  await page
    .getByRole('button', { name: `Xem góc ${test3d.scene.kneeAngle}° trên 3D` })
    .first()
    .click();
  await expect(page.getByTestId('sim-knee')).toHaveText(`${test3d.scene.kneeAngle}°`);
  await expect(page.getByTestId('term-panel')).toBeVisible();
});
