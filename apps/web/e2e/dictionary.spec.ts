import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { expect, test } from '@playwright/test';

interface TermFile {
  vi: string;
  injuries: Record<string, { scene?: { camera?: string; kneeAngle?: number } }>;
}
// The expected scene hint comes from the content, so the test follows content edits.
const fatpad = JSON.parse(
  readFileSync(join(process.cwd(), '../../content/terms/fatpad.json'), 'utf8'),
) as TermFile;
const VIEW_LABEL: Record<string, string> = {
  lateral: 'Mặt ngoài',
  front: 'Phía trước',
  knee: 'Cận gối',
  hip: 'Hông',
};

test('"Xem trên 3D" on a dictionary card opens the term in the scene', async ({ page }, info) => {
  // Every action on the 3D page is slow on CI's software GL; see docs/lessons.md.
  test.slow();
  const hint = fatpad.injuries.itbs?.scene;
  const camera = VIEW_LABEL[hint?.camera ?? ''];
  if (hint?.kneeAngle === undefined || !camera) throw new Error('fatpad has no ITBS scene hint');

  await page.goto('/itbs');
  await expect(page.getByTestId('sim-stage')).toHaveAttribute('data-state', 'ready', {
    timeout: 20_000,
  });

  await page
    .getByRole('region', { name: 'Từ điển' })
    .getByRole('listitem')
    .filter({ has: page.getByRole('heading', { name: fatpad.vi, exact: true }) })
    .getByRole('button', { name: 'Xem trên 3D' })
    .click();

  const panel = page.getByTestId('term-panel');
  await expect(panel.getByRole('heading')).toHaveText(fatpad.vi);
  await expect(
    page.getByRole('tablist', { name: 'Bảng mô phỏng' }).getByRole('tab', { name: 'Mục từ' }),
  ).toHaveAttribute('aria-selected', 'true');
  if (info.project.name === 'desktop') await expect(panel.getByRole('heading')).toBeInViewport();
  await expect(page.getByTestId('sim-knee')).toHaveText(`${hint.kneeAngle}°`);
  await expect(
    page.getByRole('group', { name: 'Góc nhìn' }).getByRole('button', { name: camera }),
  ).toHaveAttribute('aria-pressed', 'true');
});
