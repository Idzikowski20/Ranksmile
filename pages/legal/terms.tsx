import type { NextPage } from 'next';
import LegalLayout from '../../components/legal/LegalLayout';

const TermsPage: NextPage = () => (
  <LegalLayout title="Terms of Service">
    <p>
      These Terms of Service (&quot;Terms&quot;) govern access to and use of the Ranksmile application
      and related services (the &quot;Service&quot;). By creating an account or using the Service, you agree to these Terms.
    </p>
    <h2 style={{ fontSize: 18, marginTop: 28, color: '#181225' }}>1. Account</h2>
    <p>
      You must provide accurate registration information and keep credentials secure. You are responsible
      for activity under your organization and workspaces.
    </p>
    <h2 style={{ fontSize: 18, marginTop: 28, color: '#181225' }}>2. Subscription and billing</h2>
    <p>
      Paid plans are billed via Stripe according to the plan you select. Fees are non-refundable except where
      required by law. Failed payments may suspend access until resolved.
    </p>
    <h2 style={{ fontSize: 18, marginTop: 28, color: '#181225' }}>3. Acceptable use</h2>
    <p>
      You may not misuse the Service, attempt unauthorized access to other tenants&apos; data, scrape or overload
      the Service, or use it to violate applicable law.
    </p>
    <h2 style={{ fontSize: 18, marginTop: 28, color: '#181225' }}>4. Content and IP</h2>
    <p>
      You retain rights to content you submit. You grant Ranksmile a limited license to process that content
      to provide the Service (including AI-assisted analysis and optimization features).
    </p>
    <h2 style={{ fontSize: 18, marginTop: 28, color: '#181225' }}>5. Disclaimers</h2>
    <p>
      The Service is provided &quot;as is.&quot; SEO and AI outputs are informational and do not guarantee rankings or results.
    </p>
    <h2 style={{ fontSize: 18, marginTop: 28, color: '#181225' }}>6. Contact</h2>
    <p>
      Questions: <a href="mailto:noreply@ranksmile.pl" style={{ color: '#E07D42' }}>noreply@ranksmile.pl</a>
    </p>
  </LegalLayout>
);

export default TermsPage;
