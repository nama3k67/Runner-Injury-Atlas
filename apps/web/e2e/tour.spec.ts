import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { expect, type Page, test } from '@playwright/test';

interface TourFile {
  steps: {
    title: string;
    enter: { camera?: string; kneeAngle?: number };
    lines: { text: string }[];
  }[];
}
// Expected scene state comes from the content, so the test follows tour edits.
const { steps } = JSON.parse(
  readFileSync(join(process.cwd(), '../../content/injuries/itbs/tour.json'), 'utf8'),
) as TourFile;
const VIEW_LABEL: Record<string, string> = {
  lateral: 'Mặt ngoài',
  front: 'Phía trước',
  knee: 'Cận gối',
  hip: 'Hông',
};

/** Camera and knee angle once step `n` (0-based) has been entered, before its line actions. */
const sceneAt = (n: number) => {
  let camera = 'lateral';
  let knee = 0;
  for (const s of steps.slice(0, n + 1)) {
    camera = s.enter.camera ?? camera;
    knee = s.enter.kneeAngle ?? knee;
  }
  return { camera, knee };
};

const step = (n: number) => {
  const s = steps[n];
  if (!s) throw new Error(`tour.json has no step ${n}`);
  return s;
};

const expectStep = async (page: Page, n: number) => {
  await expect(page.getByTestId('tour-title')).toHaveText(
    `${n + 1}/${steps.length} · ${step(n).title}`,
  );
  const { camera, knee } = sceneAt(n);
  await expect(
    page
      .getByRole('group', { name: 'Góc nhìn' })
      .getByRole('button', { name: VIEW_LABEL[camera], exact: true }),
  ).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByTestId('sim-knee')).toHaveText(`${knee}°`);
};

const openStage = async (page: Page) => {
  await page.goto('/itbs');
  await expect(page.getByTestId('sim-stage')).toHaveAttribute('data-state', 'ready', {
    timeout: 20_000,
  });
};

const startButton = (page: Page) =>
  page.getByRole('button', { name: /^(▶ Nghe|■ Dừng) thuyết minh/ });

test.describe('guided tour', () => {
  // Several scene actions, each about 1.5 s on CI's software GL (lessons.md).
  test.slow();

  test('reads with a Vietnamese voice, steps with the keyboard, pauses for the reader and stops cleanly', async ({
    page,
  }) => {
    // A Vietnamese voice that never finishes a line, so the tour only moves when told to.
    await page.addInitScript(() => {
      const spoken: { text: string; lang: string }[] = [];
      Object.assign(window, { __spoken: spoken });
      Object.defineProperty(window, 'SpeechSynthesisUtterance', {
        value: class {
          lang = '';
          voice: unknown = null;
          onend: unknown = null;
          onerror: unknown = null;
          constructor(public text: string) {}
        },
      });
      Object.defineProperty(window, 'speechSynthesis', {
        value: {
          getVoices: () => [
            { lang: 'en-US', name: 'English' },
            { lang: 'vi-VN', name: 'Test Tiếng Việt' },
          ],
          speak: (u: { text: string; lang: string }) => spoken.push({ text: u.text, lang: u.lang }),
          cancel: () => {},
        },
      });
    });
    await openStage(page);
    const knee = page.getByLabel('Góc gập gối');
    await knee.fill('30');

    await startButton(page).click();
    const tour = page.getByRole('region', { name: 'Thuyết minh' });
    await expect(tour).toBeVisible();
    await expectStep(page, 0);
    await expect(page.getByTestId('tour-caption')).toHaveText(step(0).lines[0]?.text ?? '');
    await expect
      .poll(() => page.evaluate(() => (window as unknown as { __spoken: unknown[] }).__spoken))
      .toContainEqual({ text: step(0).lines[0]?.text, lang: 'vi-VN' });

    // Next and previous with the keyboard.
    await tour.getByRole('button', { name: 'Đoạn sau' }).focus();
    await page.keyboard.press('Enter');
    await expectStep(page, 1);
    await page.keyboard.press('Enter');
    await expectStep(page, 2);
    await tour.getByRole('button', { name: 'Đoạn trước' }).focus();
    await page.keyboard.press('Enter');
    await expectStep(page, 1);

    // A slider the reader moves pauses the tour.
    await knee.fill('40');
    await expect(page.getByTestId('tour-caption')).toContainText('tạm dừng');
    await expect(tour.getByRole('button', { name: 'Tiếp tục' })).toBeVisible();

    // Stop with the keyboard; the scene stays usable.
    await tour.getByRole('button', { name: 'Thoát thuyết minh' }).focus();
    await page.keyboard.press('Enter');
    await expect(tour).toHaveCount(0);
    await expect(startButton(page)).toHaveText(/Nghe thuyết minh/);
    await knee.fill('25');
    await expect(page.getByTestId('sim-zone')).toHaveText('TRONG VÙNG ÉP');
  });

  test('without speech synthesis the captions still show and the reader can advance', async ({
    page,
  }) => {
    await page.addInitScript(() => {
      Object.defineProperty(window, 'speechSynthesis', { value: undefined });
    });
    await openStage(page);
    await startButton(page).click();
    await expect(page.getByTestId('tour-caption')).toHaveText(step(0).lines[0]?.text ?? '');
    await expect(page.getByText('chưa có giọng đọc tiếng Việt')).toBeVisible();
    await page
      .getByRole('region', { name: 'Thuyết minh' })
      .getByRole('button', { name: 'Đoạn sau' })
      .click();
    await expectStep(page, 1);
  });
});
