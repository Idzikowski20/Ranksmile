import { test, expect } from '@playwright/test';
import { applyTheme, galleryCases, VIEWPORTS } from './matrix';

const REGIONS = [
  'gallery-button',
  'gallery-card',
  'gallery-tooltip',
  'gallery-dialog',
  'gallery-select',
  'gallery-widget',
] as const;

test.describe('visual / koala-gallery regions', () => {
  for (const c of galleryCases()) {
    test.describe(c.name, () => {
      test.beforeEach(async ({ page }) => {
        await page.setViewportSize(VIEWPORTS[c.viewport]);
        await page.goto('/dev/koala-gallery');
        await applyTheme(page, c.theme);
      });

      for (const region of REGIONS) {
        test(`${region}`, async ({ page }) => {
          const el = page.getByTestId(region);
          await expect(el).toBeVisible();
          await expect(el).toHaveScreenshot(`gallery-${region}-${c.name}.png`, {
            animations: 'disabled',
            maxDiffPixelRatio: 0.02,
          });
        });
      }
    });
  }
});
