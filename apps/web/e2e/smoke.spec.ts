import { expect, test } from '@playwright/test';

const API = 'http://localhost:3001/api';

test('home lists injuries and links to the ITBS page', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('link', { name: 'Hội chứng dải chậu chày' }).click();
  await expect(page).toHaveURL(/\/itbs$/);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Hội chứng dải chậu chày');
});

test('ITBS page renders content with numbered source links', async ({ page }) => {
  await page.goto('/itbs');
  await expect(page.locator('.phases > li')).toHaveCount(5);
  await expect(page.locator('#term-fatpad')).toContainText('Lớp mỡ');
  const firstRef = page.locator('#term-fatpad sup a').first();
  const target = await firstRef.getAttribute('href');
  expect(target).toMatch(/^#r\d+$/);
  await expect(page.locator(`ol.sources li${target}`)).toBeVisible();
});

test('unreviewed content is labelled as a draft, approval flips the badge', async ({
  page,
  request,
}, info) => {
  // The API database lives for the whole run, so this state change runs once.
  test.skip(info.project.name !== 'desktop', 'review state is shared across projects');
  const adminKey = info.config.metadata.adminKey as string;

  // The page asks the API about its own content hash; read it off that request.
  const badgeRequest = page.waitForRequest((r) => r.url().includes('/reviews/badge'));
  await page.goto('/itbs');
  const contentHash = new URL((await badgeRequest).url()).searchParams.get('contentHash');
  expect(contentHash).toMatch(/^[a-f0-9]{64}$/);
  const badge = page.getByTestId('review-badge');
  await expect(badge).toContainText('Bản nháp');

  const headers = { 'x-admin-key': adminKey };
  const round = await request.post(`${API}/reviews`, {
    headers,
    data: { injurySlug: 'itbs', contentHash },
  });
  expect(round.status()).toBe(201);
  const { id } = await round.json();
  const decision = await request.post(`${API}/reviews/${id}/decision`, {
    headers,
    data: {
      verdict: 'approved',
      reviewerName: 'E2E Reviewer',
      reviewerTitle: 'Chuyên viên vật lý trị liệu',
    },
  });
  expect(decision.status()).toBe(200);

  await page.reload();
  await expect(badge).toContainText('Đã được duyệt chuyên môn bởi E2E Reviewer');
});

test('anonymous feedback reaches the API inbox', async ({ page, request }, info) => {
  const adminKey = info.config.metadata.adminKey as string;
  const message = `Phần test Ober khó hiểu (${info.project.name}).`;
  await page.goto('/itbs');
  await page.getByRole('textbox').fill(message);
  await page.getByRole('button', { name: 'Gửi góp ý' }).click();
  await expect(page.getByRole('status')).toHaveText('Đã nhận. Cảm ơn bạn.');

  const inbox = await request.get(`${API}/feedback?injurySlug=itbs`, {
    headers: { 'x-admin-key': adminKey },
  });
  const items = (await inbox.json()) as { message: string }[];
  expect(items.map((i) => i.message)).toContain(message);
});

test('feedback shorter than the contract allows is rejected in the form', async ({ page }) => {
  await page.goto('/itbs');
  await page.getByRole('textbox').fill('ngắn');
  await page.getByRole('button', { name: 'Gửi góp ý' }).click();
  await expect(page.getByRole('status')).toHaveText('Hãy viết ít nhất 10 ký tự.');
});
