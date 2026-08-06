import type { AppState, RouteCapability } from './types';
import { ACCESS_POLICY_VERSION } from './types';

export { ACCESS_POLICY_VERSION };

/** Capabilities granted per AppState (policyVersion=1). */
const CAPABILITIES: Record<AppState, ReadonlySet<RouteCapability>> = {
  EMAIL_PENDING: new Set(['Public', 'Auth', 'Health']),
  ONBOARDING_REQUIRED: new Set(['Public', 'Auth', 'Onboarding', 'Health']),
  BILLING_REQUIRED: new Set([
    'Public',
    'Auth',
    'Plans',
    'BillingCheckout',
    'BillingSuccess',
    'BillingRead',
    'Health',
  ]),
  PAYMENT_FAILED: new Set([
    'Public',
    'Auth',
    'Plans',
    'BillingCheckout',
    'BillingSuccess',
    'BillingRecovery',
    'BillingRead',
    'BillingManage',
    'Health',
  ]),
  WORKSPACE_REQUIRED: new Set([
    'Public',
    'Auth',
    'Plans',
    // A first purchase lands here the moment the subscription activates — often before
    // the checkout page has finished minting its confirmation token. Without these the
    // order confirmation is unreachable and the user is bounced to /workspace/new.
    'BillingCheckout',
    'BillingSuccess',
    'BillingRead',
    'BillingManage',
    'WorkspaceSetup',
    'Health',
  ]),
  READY: new Set([
    'Public',
    'Auth',
    'Plans',
    'Onboarding',
    'BillingCheckout',
    'BillingSuccess',
    'BillingRecovery',
    'BillingRead',
    'BillingManage',
    'WorkspaceSetup',
    'App',
    'Health',
  ]),
  LOCKED: new Set(['Public', 'Auth', 'Health']),
};

export function capabilitiesForState(state: AppState): ReadonlySet<RouteCapability> {
  return CAPABILITIES[state];
}

export function allowsCapability(state: AppState, capability: RouteCapability): boolean {
  return CAPABILITIES[state].has(capability);
}

function stripQueryHash(url: string): string {
  return url.split('?')[0]?.split('#')[0] ?? '';
}

/**
 * Map a frontend pathname to the primary capability required.
 * Pure — no Next/React.
 */
export function frontendPathCapability(pathname: string): RouteCapability {
  const path = stripQueryHash(pathname);

  if (
    path.startsWith('/auth')
    || path.startsWith('/login')
    || path.startsWith('/invite')
  ) {
    return 'Auth';
  }
  if (path === '/onboarding') return 'Onboarding';
  if (path === '/plans') return 'Plans';
  if (path.startsWith('/billing/checkout/')) return 'BillingCheckout';
  if (path === '/billing/confirmation/success') return 'BillingSuccess';
  if (path === '/billing/confirmation/failed') return 'BillingRecovery';
  if (
    path === '/settings/billing_subscription'
    || path === '/settings/billing_details'
    || path === '/settings/billing_invoices'
    || path === '/settings/billing_history'
  ) {
    return 'BillingManage';
  }
  if (path === '/workspace/new') return 'WorkspaceSetup';
  if (path === '/setup') return 'WorkspaceSetup';
  if (/^\/workspace\/\d+\/setup$/.test(path)) return 'WorkspaceSetup';
  if (path === '/no-access' || path === '/404') return 'Public';
  if (
    path.startsWith('/legal')
    || path.startsWith('/drafts')
    || path.startsWith('/dev')
    || path === '/'
  ) {
    return 'Public';
  }
  return 'App';
}

export function allowsFrontend(state: AppState, pathname: string): boolean {
  return allowsCapability(state, frontendPathCapability(pathname));
}

/**
 * The API calls `pages/setup.tsx` makes while creating the first workspace.
 *
 * WORKSPACE_REQUIRED grants the wizard's *route* but not `App`, so without this list
 * the page renders and every action inside it is denied — "Connect Search Console"
 * navigates the whole window to `/api/gsc/connect` and paints the raw denial JSON.
 *
 * Deliberately exact: these are the endpoints the wizard needs and nothing more.
 * `/api/gsc/search-data`, `/api/gsc/pages` and the rest of the product stay `App`.
 */
const SETUP_WIZARD_ROUTES: ReadonlySet<string> = new Set([
  'GET:/api/workspaces',
  // Google OAuth round trip for the Search Console connection.
  'GET:/api/gsc/connect',
  'GET:/api/gsc/callback',
  'GET:/api/gsc/sites',
  'GET:/api/domains',
  'POST:/api/domains/configure',
  'POST:/api/domains/detect-blog-paths',
  'POST:/api/domains/blog-paths',
  'POST:/api/brand-knowledge',
]);

function isSetupWizardRoute(method: string, path: string): boolean {
  return SETUP_WIZARD_ROUTES.has(`${method}:${path}`);
}

/**
 * Map `METHOD:/api/...` to capability. Unknown product APIs → App.
 */
export function apiRouteCapability(routeKey: string): RouteCapability {
  const trimmed = routeKey.trim().split('?')[0] ?? '';
  const m = trimmed.match(/^(GET|POST|PUT|DELETE|PATCH)\s*[: ]\s*(\/.*)$/i);
  if (!m) return 'App';
  const method = m[1].toUpperCase();
  const path = m[2];

  if (path === '/api/webhooks/stripe') return 'Webhook';
  if (path === '/api/health' || path === '/api/ready') return 'Health';
  if (path === '/api/session/bootstrap') return 'Health';

  if (path.startsWith('/api/billing/')) {
    if (method === 'GET') {
      if (path === '/api/billing/confirmation') return 'BillingSuccess';
      return 'BillingRead';
    }
    if (
      path === '/api/billing/create-subscription'
      || path === '/api/billing/checkout-session'
      || path === '/api/billing/activate-trial'
      || path === '/api/billing/tax-preview'
      || path === '/api/billing/update-customer'
      || path === '/api/billing/issue-confirmation'
      || path === '/api/billing/audit-beacon'
    ) {
      return 'BillingCheckout';
    }
    if (
      path === '/api/billing/portal'
      || path === '/api/billing/cancel'
      || path === '/api/billing/upgrade-subscription'
      || path === '/api/billing/upgrade-preview'
      || /^\/api\/billing\/payment-methods\//.test(path)
    ) {
      return 'BillingManage';
    }
    return 'BillingManage';
  }

  if (path === '/api/workspaces/setup' || path === '/api/onboarding') {
    return path === '/api/onboarding' ? 'Onboarding' : 'WorkspaceSetup';
  }
  // The onboarding wizard names the organization, uploads its logo, and invites
  // teammates before a plan exists, so these two writes must survive
  // ONBOARDING_REQUIRED. Reads stay App — nothing in onboarding lists members.
  if (
    (path === '/api/organization' && method === 'PUT')
    || (path === '/api/members' && method === 'POST')
  ) {
    return 'Onboarding';
  }
  if (/^\/api\/workspaces\/\d+\/finish$/.test(path)) return 'WorkspaceSetup';
  if (isSetupWizardRoute(method, path)) return 'WorkspaceSetup';

  return 'App';
}

export function allowsApi(state: AppState, routeKey: string): boolean {
  const cap = apiRouteCapability(routeKey);
  if (cap === 'Webhook' || cap === 'Health') return true;
  return allowsCapability(state, cap);
}
