import { test, expect } from '@playwright/test';
import { applyTheme, galleryCases, VIEWPORTS } from './matrix';

const REGIONS = [
  'dashboard-shell',
  'dashboard-widget-row',
  'dashboard-chart',
  'dashboard-list',
] as const;

test.describe('visual / dashboard regions (stub)', () => {
  for (const c of galleryCases()) {
    test.describe(c.name, () => {
      test.beforeEach(async ({ page }) => {
        await page.setViewportSize(VIEWPORTS[c.viewport]);
        await page.goto('/dev/koala-dashboard-regions');
        await applyTheme(page, c.theme);
      });

      for (const region of REGIONS) {
        test(`${region}`, async ({ page }) => {
          const el = page.getByTestId(region);
          await expect(el).toBeVisible();
          await expect(el).toHaveScreenshot(`dashboard-${region}-${c.name}.png`, {
            animations: 'disabled',
            maxDiffPixelRatio: 0.02,
          });
        });
      }
    });
  }
});
