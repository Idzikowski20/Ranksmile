import { allowsApi, allowsFrontend, resolveAppState } from '../../lib/appAccess';

/**
 * The state a user is in for the whole gap between "payment succeeded" and
 * "first workspace is ready": entitled, but with nothing set up yet.
 */
const AFTER_FIRST_PURCHASE = resolveAppState({
  emailConfirmed: true,
  onboardingCompleted: true,
  billingState: 'ACTIVE',
  workspaceState: 'NONE',
}).state;

describe('WORKSPACE_REQUIRED — the state right after a first purchase', () => {
  it('is the state a fresh org lands in once the subscription activates', () => {
    expect(AFTER_FIRST_PURCHASE).toBe('WORKSPACE_REQUIRED');
  });

  describe('order confirmation', () => {
    // The checkout page navigates here after Stripe confirms. Denying it drops the
    // user on `/`, which the shell then bounces to /workspace/new — the order
    // confirmation is never shown.
    it('allows the confirmation page', () => {
      expect(allowsFrontend(AFTER_FIRST_PURCHASE, '/billing/confirmation/success')).toBe(true);
    });

    it('allows reading the confirmation it renders', () => {
      expect(allowsApi(AFTER_FIRST_PURCHASE, 'GET:/api/billing/confirmation')).toBe(true);
    });

    // Minted client-side straight after `stripe.confirmPayment` resolves. By then the
    // webhook may already have flipped billing to ACTIVE, so this call has to survive
    // the state it itself caused.
    it('allows minting the confirmation token', () => {
      expect(allowsApi(AFTER_FIRST_PURCHASE, 'POST:/api/billing/issue-confirmation')).toBe(true);
    });
  });

  describe('first-workspace setup wizard', () => {
    it('allows the wizard route itself', () => {
      expect(allowsFrontend(AFTER_FIRST_PURCHASE, '/workspace/1/setup')).toBe(true);
      expect(allowsFrontend(AFTER_FIRST_PURCHASE, '/workspace/new')).toBe(true);
    });

    // Everything below is called by pages/setup.tsx. Without these the wizard renders
    // but every action inside it fails — Connect Search Console navigates the whole
    // window to /api/gsc/connect and paints the raw ACCESS_DENIED JSON.
    it.each([
      'GET:/api/workspaces',
      'GET:/api/gsc/sites',
      'GET:/api/gsc/connect',
      'GET:/api/gsc/callback',
      'GET:/api/domains',
      'POST:/api/domains/configure',
      'POST:/api/domains/detect-blog-paths',
      // Methods here mirror pages/setup.tsx exactly — the whitelist matches on the
      // full `METHOD:path` key, so a wrong verb silently leaves the call denied.
      'PUT:/api/domains/blog-paths',
      'POST:/api/brand-knowledge',
      'POST:/api/workspaces/7/finish',
    ])('allows %s', (routeKey) => {
      expect(allowsApi(AFTER_FIRST_PURCHASE, routeKey)).toBe(true);
    });
  });

  describe('still gates the product itself', () => {
    it.each([
      'GET:/api/articles',
      'GET:/api/keywords',
      'GET:/api/gsc/search-data',
      'GET:/api/insight',
      // Verb-specific: the wizard only reads the workspace list, so the create verb on
      // the same path must not ride along on the whitelist entry.
      'POST:/api/workspaces',
      'DELETE:/api/domains',
    ])('denies %s', (routeKey) => {
      expect(allowsApi(AFTER_FIRST_PURCHASE, routeKey)).toBe(false);
    });

    it('denies product pages', () => {
      expect(allowsFrontend(AFTER_FIRST_PURCHASE, '/dashboard')).toBe(false);
    });
  });
});
