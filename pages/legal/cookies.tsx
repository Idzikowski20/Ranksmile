import type { NextPage } from 'next';
import LegalLayout from '../../components/legal/LegalLayout';

const CookiesPage: NextPage = () => (
  <LegalLayout title="Cookie Policy">
    <p>
      Ranksmile uses cookies and similar technologies to run the Service securely and understand product usage.
    </p>
    <h2 style={{ fontSize: 18, marginTop: 28, color: '#181225' }}>1. Essential cookies</h2>
    <ul>
      <li>
        <strong>Session</strong> (<code>__Secure-neon-auth.session_token</code>) — authenticates your login (HttpOnly).
      </li>
      <li>
        <strong>Workspace</strong> (<code>active_workspace</code>) — remembers the active workspace for routing.
      </li>
      <li>
        <strong>OAuth state</strong> (e.g. GSC / Ads) — short-lived CSRF protection during Google connect flows.
      </li>
    </ul>
    <h2 style={{ fontSize: 18, marginTop: 28, color: '#181225' }}>2. Analytics</h2>
    <p>
      We may use PostHog (or similar) to measure product usage. These cookies or local storage keys help us
      understand feature adoption. You can block non-essential cookies via browser settings; essential cookies
      are required for the app to function.
    </p>
    <h2 style={{ fontSize: 18, marginTop: 28, color: '#181225' }}>3. Error monitoring</h2>
    <p>
      Sentry may set cookies or use similar storage for error diagnostics when monitoring is enabled.
    </p>
    <h2 style={{ fontSize: 18, marginTop: 28, color: '#181225' }}>4. Contact</h2>
    <p>
      Questions: <a href="mailto:noreply@ranksmile.pl" style={{ color: '#E07D42' }}>noreply@ranksmile.pl</a>
    </p>
  </LegalLayout>
);

export default CookiesPage;
