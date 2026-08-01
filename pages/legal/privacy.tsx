import type { NextPage } from 'next';
import LegalLayout from '../../components/legal/LegalLayout';
import { LEGAL_COMPANY } from '../../lib/legal/company';

const PrivacyPage: NextPage = () => (
  <LegalLayout
    title="Privacy Policy"
    description="How Ranksmile processes personal data when you use our Service."
  >
    <p>
      This Privacy Policy explains how
      {' '}
      <strong>{LEGAL_COMPANY.legalName}</strong>
      {' '}
      (&quot;Ranksmile&quot;, &quot;we&quot;, &quot;us&quot;) processes personal data when you visit
      {' '}
      {LEGAL_COMPANY.website}
      , use the Ranksmile application, or otherwise interact with us. We process data in line with
      applicable law, including the EU General Data Protection Regulation (GDPR).
    </p>
    <p>
      Cookie-specific details are in our
      {' '}
      <a href="/legal/cookies">Cookie Policy</a>
      . Where we process personal data on a customer&apos;s behalf as a processor, see the
      {' '}
      <a href="/legal/dpa">Data Processing Addendum</a>
      .
    </p>

    <h2>1. Controller</h2>
    <p>
      The controller of personal data described in this Policy is:
    </p>
    <p>
      <strong>{LEGAL_COMPANY.legalName}</strong>
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
      Privacy contact:
      {' '}
      <a href={`mailto:${LEGAL_COMPANY.privacyEmail}`}>{LEGAL_COMPANY.privacyEmail}</a>
    </p>
    <p>
      We are typically the controller for account, billing, support, marketing (where consented), and
      product analytics data. For Customer Content that includes personal data of your end users or
      employees that you upload for SEO analysis, you are generally the controller and we act as your
      processor under the DPA.
    </p>

    <h2>2. Data we process</h2>
    <h3>2.1 Account and identity</h3>
    <ul>
      <li>Name, email address, authentication identifiers</li>
      <li>Organization / workspace membership and roles</li>
      <li>Profile preferences and onboarding answers</li>
    </ul>
    <h3>2.2 Billing</h3>
    <ul>
      <li>Plan, subscription status, invoices metadata</li>
      <li>Billing name, address, tax IDs (e.g. NIP/VAT) you provide</li>
      <li>Payment method details handled by Stripe (we do not store full card numbers)</li>
    </ul>
    <h3>2.3 Product usage</h3>
    <ul>
      <li>Feature usage events, device/browser metadata, IP address, approximate location</li>
      <li>Logs needed for security, debugging, and reliability</li>
      <li>Support communications you send us</li>
    </ul>
    <h3>2.4 Customer Content</h3>
    <ul>
      <li>Keywords, URLs, page HTML/text, drafts, scores, integration payloads you connect</li>
      <li>Any personal data incidentally present in content you choose to process in Ranksmile</li>
    </ul>

    <h2>3. Purposes and legal bases</h2>
    <ul>
      <li>
        <strong>Provide the Service</strong>
        {' '}
        (accounts, workspaces, SEO/AI features, integrations) — contract (Art. 6(1)(b) GDPR)
      </li>
      <li>
        <strong>Billing and accounting</strong>
        {' '}
        — contract and legal obligation (Art. 6(1)(b)(c))
      </li>
      <li>
        <strong>Security, abuse prevention, fraud</strong>
        {' '}
        — legitimate interests (Art. 6(1)(f))
      </li>
      <li>
        <strong>Product analytics and improvement</strong>
        {' '}
        — legitimate interests and/or consent for non-essential cookies (Art. 6(1)(f)/(a))
      </li>
      <li>
        <strong>Transactional email</strong>
        {' '}
        (confirmations, security, billing) — contract / legitimate interests
      </li>
      <li>
        <strong>Marketing communications</strong>
        {' '}
        (if offered) — consent where required (Art. 6(1)(a))
      </li>
    </ul>

    <h2>4. Processors and recipients</h2>
    <p>
      We use infrastructure and service providers under contracts that require appropriate
      safeguards. Categories include:
    </p>
    <ul>
      <li>Database / auth hosting (e.g. Neon)</li>
      <li>Payments (Stripe)</li>
      <li>Transactional email (e.g. Resend)</li>
      <li>Caching / queues (Redis hosting)</li>
      <li>Error monitoring (Sentry)</li>
      <li>Product analytics (PostHog)</li>
      <li>Cloud hosting / CDN for the application</li>
      <li>AI model providers when you use AI features</li>
    </ul>
    <p>
      We may disclose data if required by law, to protect rights and safety, or in connection with a
      merger, acquisition, or asset sale (with notice where required).
    </p>

    <h2>5. International transfers</h2>
    <p>
      Where personal data is transferred outside the EEA/UK, we use appropriate safeguards such as
      EU Standard Contractual Clauses and vendor assessments, unless an adequacy decision applies.
    </p>

    <h2>6. Retention</h2>
    <p>
      We retain account and billing data for the life of the subscription and as required for legal,
      tax, and accounting obligations. Product logs are kept for a limited operational period.
      Customer Content is retained while your workspace needs it and deleted or anonymized after
      account closure according to our deletion practices and the DPA, subject to legal holds.
    </p>

    <h2>7. Your rights</h2>
    <p>Subject to GDPR and local law, you may have the right to:</p>
    <ul>
      <li>Access, rectify, or erase personal data</li>
      <li>Restrict or object to certain processing</li>
      <li>Data portability</li>
      <li>Withdraw consent where processing is based on consent</li>
      <li>Lodge a complaint with a supervisory authority (in Poland: UODO)</li>
    </ul>
    <p>
      Requests:
      {' '}
      <a href={`mailto:${LEGAL_COMPANY.privacyEmail}`}>{LEGAL_COMPANY.privacyEmail}</a>
      . We may need to verify your identity.
    </p>

    <h2>8. Security</h2>
    <p>
      We implement technical and organizational measures appropriate to the risk (access controls,
      encryption in transit, least-privilege practices, monitoring). No method of transmission or
      storage is perfectly secure.
    </p>

    <h2>9. Children</h2>
    <p>
      The Service is not directed to children under 16. We do not knowingly collect personal data from
      children. Contact us if you believe we have done so.
    </p>

    <h2>10. Changes</h2>
    <p>
      We may update this Policy. The &quot;Last updated&quot; date at the top of this page will change.
      Material updates may also be communicated in-product or by email.
    </p>

    <h2>11. Contact</h2>
    <p>
      {LEGAL_COMPANY.legalName}
      <br />
      {LEGAL_COMPANY.registeredAddress}
      <br />
      <a href={`mailto:${LEGAL_COMPANY.privacyEmail}`}>{LEGAL_COMPANY.privacyEmail}</a>
      {' · '}
      <a href={`mailto:${LEGAL_COMPANY.supportEmail}`}>{LEGAL_COMPANY.supportEmail}</a>
    </p>

    <div className="legal-note">
      <strong>Nota PL (RODO) — administrator</strong>
      Administratorem danych osobowych jest
      {' '}
      {LEGAL_COMPANY.legalName}
      , adres:
      {' '}
      {LEGAL_COMPANY.registeredAddress}
      , NIP:
      {' '}
      {LEGAL_COMPANY.nip}
      , KRS:
      {' '}
      {LEGAL_COMPANY.krs}
      . W sprawach prywatności:
      {' '}
      <a href={`mailto:${LEGAL_COMPANY.privacyEmail}`}>{LEGAL_COMPANY.privacyEmail}</a>
      . Przysługują Ci prawa z RODO (dostęp, sprostowanie, usunięcie, ograniczenie, sprzeciw,
      przenoszalność, skarga do UODO). Szczegóły celów, podstaw i odbiorców — w angielskiej treści
      powyżej. Polityka cookies:
      {' '}
      <a href="/legal/cookies">/legal/cookies</a>
      .
    </div>
  </LegalLayout>
);

export default PrivacyPage;
