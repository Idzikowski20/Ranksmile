import { test, expect } from '@playwright/test';
import { applyTheme, authSignInCases, VIEWPORTS } from './matrix';

test.describe('visual / auth-sign-in', () => {
  for (const c of authSignInCases()) {
    test(`auth-sign-in ${c.name}`, async ({ page }) => {
      await page.setViewportSize(VIEWPORTS[c.viewport]);
      await page.goto('/auth/sign-in');
      await applyTheme(page, c.theme);
      await expect(page.locator('body')).toHaveScreenshot(`auth-sign-in-${c.name}.png`, {
        animations: 'disabled',
        maxDiffPixelRatio: 0.02,
      });
    });
  }
});
