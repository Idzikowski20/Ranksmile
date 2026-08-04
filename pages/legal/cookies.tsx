import type { NextPage } from 'next';
import LegalLayout from '../../components/legal/LegalLayout';
import { LEGAL_COMPANY } from '../../lib/legal/company';

const CookiesPage: NextPage = () => (
  <LegalLayout
    title="Cookie Policy"
    description="How Ranksmile uses cookies and similar technologies."
  >
    <p>
      This Cookie Policy explains how
      {' '}
      <strong>{LEGAL_COMPANY.legalName}</strong>
      {' '}
      (&quot;Ranksmile&quot;, &quot;we&quot;) uses cookies and similar technologies on
      {' '}
      {LEGAL_COMPANY.website}
      {' '}
      and the Ranksmile application. It should be read with our
      {' '}
      <a href="/legal/privacy">Privacy Policy</a>
      .
    </p>

    <h2>1. What are cookies?</h2>
    <p>
      Cookies are small text files stored on your device. Similar technologies include local storage,
      session storage, and pixels. They help the Service run securely, remember preferences, and
      (where enabled) measure product usage.
    </p>

    <h2>2. Essential cookies</h2>
    <p>
      These are required to provide the Service you request. Legal basis: necessity for the contract /
      service (Art. 6(1)(b) GDPR) and, where applicable, legitimate interests in securing the Service.
    </p>
    <ul>
      <li>
        <strong>Session</strong>
        {' '}
        (<code>__Secure-neon-auth.session_token</code>
        {' '}
        or successor) — authenticates your login (HttpOnly where configured).
      </li>
      <li>
        <strong>Workspace</strong>
        {' '}
        (<code>active_workspace</code>
        ) — remembers the active workspace for routing and API scoping.
      </li>
      <li>
        <strong>OAuth state</strong>
        {' '}
        (e.g. Google Search Console / Ads connect) — short-lived CSRF protection during connect flows.
      </li>
      <li>
        <strong>Security / CSRF</strong>
        {' '}
        — tokens required to protect authenticated actions.
      </li>
    </ul>
    <p>
      Blocking essential cookies will prevent sign-in and core product functionality.
    </p>

    <h2>3. Analytics and product improvement</h2>
    <p>
      We may use product analytics tools to understand feature adoption and improve the product. These
      cookies or local storage keys are non-essential. Legal basis: consent where required
      (Art. 6(1)(a) GDPR), otherwise legitimate interests for aggregated product analytics where
      permitted.
    </p>
    <p>
      You can block non-essential cookies via browser settings. If we ship an in-product cookie
      preference center, you will also be able to manage optional categories there.
    </p>

    <h2>4. Error monitoring</h2>
    <p>
      Sentry (or similar) may use cookies or similar storage for error diagnostics when monitoring is
      enabled, to help us detect and fix failures. Prefer essential/security classification when used
      strictly for reliability; otherwise treat as optional diagnostics.
    </p>

    <h2>5. Duration</h2>
    <ul>
      <li>
        <strong>Session cookies</strong>
        {' '}
        — expire when you close the browser or after a short idle period.
      </li>
      <li>
        <strong>Persistent cookies</strong>
        {' '}
        — remain until expiry or until you delete them.
      </li>
    </ul>

    <h2>6. How to manage cookies</h2>
    <p>
      Most browsers let you refuse or delete cookies via privacy settings. See vendor help for Chrome,
      Firefox, Safari, Edge, and others. Limiting cookies may affect login, workspace memory, and
      analytics.
    </p>

    <h2>7. Third parties</h2>
    <p>
      Third-party providers listed in our Privacy Policy may set their own cookies when their scripts
      load. Their processing is also governed by their policies.
    </p>

    <h2>8. Changes and contact</h2>
    <p>
      We may update this Cookie Policy as our stack changes. Contact:
      {' '}
      <a href={`mailto:${LEGAL_COMPANY.privacyEmail}`}>{LEGAL_COMPANY.privacyEmail}</a>
      .
    </p>
  </LegalLayout>
);

export default CookiesPage;
