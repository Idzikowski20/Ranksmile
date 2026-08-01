import type { NextPage } from 'next';
import LegalLayout from '../../components/legal/LegalLayout';

const PrivacyPage: NextPage = () => (
  <LegalLayout title="Privacy Policy">
    <p>
      This Privacy Policy describes how Ranksmile processes personal data when you use our Service.
      For cookie-specific details see our <a href="/legal/cookies" style={{ color: '#E07D42' }}>Cookie Policy</a>.
    </p>
    <h2 style={{ fontSize: 18, marginTop: 28, color: '#181225' }}>1. Data we process</h2>
    <p>
      Account data (email, name), organization and workspace metadata, billing identifiers via Stripe,
      product usage events, content you upload for SEO analysis, and technical logs needed to operate the Service.
    </p>
    <h2 style={{ fontSize: 18, marginTop: 28, color: '#181225' }}>2. Purposes</h2>
    <p>
      We process data to authenticate users, provide SEO and AI features, bill subscriptions, secure the platform,
      and improve the product. Legal bases include contract performance and legitimate interests where applicable.
    </p>
    <h2 style={{ fontSize: 18, marginTop: 28, color: '#181225' }}>3. Processors</h2>
    <p>
      We use infrastructure and subprocessors such as Neon (database/auth), Stripe (payments), Resend (email),
      Redis hosting, error monitoring (Sentry), and product analytics (PostHog), each under their own terms.
    </p>
    <h2 style={{ fontSize: 18, marginTop: 28, color: '#181225' }}>4. Retention</h2>
    <p>
      We retain account and billing data for the life of the subscription and as required for legal/accounting
      obligations. You may request deletion subject to those requirements.
    </p>
    <h2 style={{ fontSize: 18, marginTop: 28, color: '#181225' }}>5. Contact</h2>
    <p>
      Privacy requests: <a href="mailto:noreply@ranksmile.pl" style={{ color: '#E07D42' }}>noreply@ranksmile.pl</a>
    </p>
  </LegalLayout>
);

export default PrivacyPage;
