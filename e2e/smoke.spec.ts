import { test, expect } from '@playwright/test';

/**
 * Functional e2e smoke — runs before visual job in CI.
 * Authenticated dashboard regions skip without PLAYWRIGHT_STORAGE_STATE.
 */
test.describe('e2e smoke', () => {
  test('sign-in page loads', async ({ page }) => {
    await page.goto('/auth/sign-in');
    await expect(page.locator('body')).toBeVisible();
  });

  test('koala gallery loads in non-production', async ({ page }) => {
    test.skip(process.env.NODE_ENV === 'production' && process.env.ENABLE_KOALA_GALLERY !== '1', 'gallery disabled');
    await page.goto('/dev/koala-gallery');
    await expect(page.getByTestId('koala-gallery')).toBeVisible();
  });

  test('dashboard regions stub loads', async ({ page }) => {
    test.skip(process.env.NODE_ENV === 'production' && process.env.ENABLE_KOALA_GALLERY !== '1', 'gallery disabled');
    await page.goto('/dev/koala-dashboard-regions');
    await expect(page.getByTestId('dashboard-shell')).toBeVisible();
    await expect(page.getByTestId('dashboard-widget-row')).toBeVisible();
    await expect(page.getByTestId('dashboard-chart')).toBeVisible();
    await expect(page.getByTestId('dashboard-list')).toBeVisible();
  });

  test('dashboard page (auth)', async ({ page }) => {
    test.skip(!process.env.PLAYWRIGHT_STORAGE_STATE, 'needs storage state');
    await page.goto('/dashboard');
    await expect(page.getByTestId('dashboard-widget-row')).toBeVisible();
  });
});

