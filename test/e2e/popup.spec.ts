import { expect, test, type BrowserContext } from '@playwright/test';

async function getExtensionId(context: BrowserContext): Promise<string> {
  let [serviceWorker] = context.serviceWorkers();
  serviceWorker ??= await context.waitForEvent('serviceworker');
  return serviceWorker.url().split('/')[2] ?? '';
}

test('popup opens and displays variant selectors', async ({ context, page }) => {
  const extensionId = await getExtensionId(context);
  await page.goto(`chrome-extension://${extensionId}/popup.html`);

  await expect(page.getByRole('heading', { name: 'OpenCC' })).toBeVisible();
  await expect(page.getByTestId('origin-selector')).toBeVisible();
  await expect(page.getByTestId('target-selector')).toBeVisible();
});
