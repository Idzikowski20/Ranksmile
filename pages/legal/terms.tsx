import type { NextPage } from 'next';
import LegalLayout from '../../components/legal/LegalLayout';
import { LEGAL_COMPANY } from '../../lib/legal/company';

const TermsPage: NextPage = () => (
  <LegalLayout
    title="Terms of Service"
    description="Terms governing access to and use of the Ranksmile Service."
  >
    <p>
      These Terms of Service (&quot;Terms&quot;) govern access to and use of the Ranksmile application,
      websites, APIs, and related services (collectively, the &quot;Service&quot;) operated by
      {' '}
      <strong>{LEGAL_COMPANY.legalName}</strong>
      {' '}
      (&quot;Ranksmile&quot;, &quot;we&quot;, &quot;us&quot;). By creating an account, starting a trial,
      or using the Service, you agree to these Terms.
    </p>
    <p>
      If you use the Service on behalf of an organization, you represent that you have authority to
      bind that organization, and &quot;you&quot; includes that organization.
    </p>

    <h2>1. The Service</h2>
    <p>
      Ranksmile provides SEO and content tooling, including research, scoring, AI-assisted drafting
      and optimization, integrations (for example Google Search Console or Ads where enabled),
      workspaces, and related features. Features may change over time. We may offer free, trial, or
      paid plans with different limits.
    </p>

    <h2>2. Accounts and workspaces</h2>
    <p>
      You must provide accurate registration information and keep credentials secure. You are
      responsible for activity under your account, organization, and workspaces, including invites
      you send. Notify us promptly of unauthorized access at
      {' '}
      <a href={`mailto:${LEGAL_COMPANY.supportEmail}`}>{LEGAL_COMPANY.supportEmail}</a>
      .
    </p>
    <p>
      You must be at least 18 years old (or the age of majority in your jurisdiction) to use the
      Service. We may suspend or terminate accounts that violate these Terms or create security risk.
    </p>

    <h2>3. Subscriptions and billing</h2>
    <p>
      Paid plans are billed through Stripe according to the plan and billing interval you select.
      Prices, quotas, and feature entitlements are shown at checkout or in-product. Fees are
      generally non-refundable except where required by law or expressly stated in writing.
    </p>
    <ul>
      <li>Subscriptions renew automatically until canceled in billing settings.</li>
      <li>Failed payments may result in suspension until payment succeeds.</li>
      <li>Taxes may apply based on your billing details (including VAT/NIP where required).</li>
      <li>Downgrades take effect at the next billing period unless we state otherwise.</li>
    </ul>

    <h2>4. Acceptable use</h2>
    <p>You will not:</p>
    <ul>
      <li>Misuse the Service, probe or breach security, or disrupt other customers</li>
      <li>Access another tenant&apos;s data without authorization</li>
      <li>Scrape, overload, or reverse engineer the Service except as allowed by law</li>
      <li>Use the Service to violate applicable law, third-party rights, or spam/abuse policies</li>
      <li>Upload unlawful, infringing, or malicious content</li>
      <li>Resell or provide the Service as a competing white-label offering without our written consent</li>
    </ul>

    <h2>5. Customer content and intellectual property</h2>
    <p>
      You retain rights to content you submit (&quot;Customer Content&quot;). You grant Ranksmile a
      worldwide, non-exclusive license to host, process, transmit, and display Customer Content solely
      to provide and improve the Service (including AI-assisted analysis and generation features you
      enable).
    </p>
    <p>
      The Service, software, models configurations, UI, documentation, and Ranksmile trademarks remain
      our property or our licensors&apos;. These Terms do not transfer ownership of our IP to you.
    </p>

    <h2>6. AI and SEO outputs</h2>
    <p>
      AI-assisted and SEO scoring outputs are informational. They do not guarantee rankings, traffic,
      conversions, or compliance with search-engine guidelines. You are responsible for reviewing
      outputs before publishing and for how you use them.
    </p>

    <h2>7. Third-party services</h2>
    <p>
      The Service may integrate with third parties (e.g. Google, Stripe, WordPress). Your use of those
      services is subject to their terms. We are not responsible for third-party outages or policy
      changes that affect integrations.
    </p>

    <h2>8. Confidentiality</h2>
    <p>
      Each party may receive non-public information from the other. The receiving party will protect
      it with reasonable care and use it only to perform under these Terms, except where disclosure is
      required by law or the information is already public through no fault of the receiver.
    </p>

    <h2>9. Data protection</h2>
    <p>
      Our
      {' '}
      <a href="/legal/privacy">Privacy Policy</a>
      {' '}
      explains how we process personal data as a controller
      for account and product operations. Where we process personal data on your behalf as a
      processor, the
      {' '}
      <a href="/legal/dpa">Data Processing Addendum</a>
      {' '}
      applies.
    </p>

    <h2>10. Disclaimers</h2>
    <p>
      THE SERVICE IS PROVIDED &quot;AS IS&quot; AND &quot;AS AVAILABLE.&quot; TO THE MAXIMUM EXTENT
      PERMITTED BY LAW, WE DISCLAIM WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE,
      AND NON-INFRINGEMENT. We do not warrant uninterrupted or error-free operation.
    </p>

    <h2>11. Limitation of liability</h2>
    <p>
      To the maximum extent permitted by law, Ranksmile will not be liable for indirect, incidental,
      special, consequential, or punitive damages, or for lost profits, revenue, or data. Our aggregate
      liability arising out of these Terms or the Service in any twelve-month period will not exceed
      the amounts you paid us for the Service in that period (or EUR 100 if you are on a free plan).
      Nothing in these Terms limits liability that cannot be limited under applicable law.
    </p>

    <h2>12. Term and termination</h2>
    <p>
      These Terms apply while you use the Service. You may stop using the Service and cancel paid
      plans as described in billing settings. We may suspend or terminate access for material breach,
      non-payment, legal risk, or prolonged inactivity on free accounts. Upon termination, your right
      to access the Service ends; provisions that by nature should survive will survive.
    </p>

    <h2>13. Changes</h2>
    <p>
      We may update these Terms. Material changes will be posted on this page with an updated date
      (and, where appropriate, notified in-product or by email). Continued use after the effective
      date constitutes acceptance, except where mandatory law requires otherwise.
    </p>

    <h2>14. Governing law</h2>
    <p>
      These Terms are governed by the laws of
      {' '}
      {LEGAL_COMPANY.country}
      , without regard to conflict-of-law rules. Courts competent for the registered seat of
      {' '}
      {LEGAL_COMPANY.legalName}
      {' '}
      shall have jurisdiction, subject to mandatory consumer protections that may apply.
    </p>

    <h2>15. Contact</h2>
    <p>
      {LEGAL_COMPANY.legalName}
      <br />
      {LEGAL_COMPANY.registeredAddress}
      <br />
      NIP:
      {' '}
      {LEGAL_COMPANY.nip}
      {' · '}
      KRS:
      {' '}
      {LEGAL_COMPANY.krs}
      <br />
      <a href={`mailto:${LEGAL_COMPANY.legalEmail}`}>{LEGAL_COMPANY.legalEmail}</a>
      {' · '}
      <a href={`mailto:${LEGAL_COMPANY.supportEmail}`}>{LEGAL_COMPANY.supportEmail}</a>
    </p>
  </LegalLayout>
);

export default TermsPage;
