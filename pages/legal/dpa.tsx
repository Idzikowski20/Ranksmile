import type { NextPage } from 'next';
import LegalLayout from '../../components/legal/LegalLayout';
import { LEGAL_COMPANY } from '../../lib/legal/company';

const DpaPage: NextPage = () => (
  <LegalLayout
    title="Data Processing Addendum"
    description="GDPR processor terms for customer personal data processed in Ranksmile."
  >
    <p>
      This Data Processing Addendum (&quot;DPA&quot;) forms part of the
      {' '}
      <a href="/legal/terms">Terms of Service</a>
      {' '}
      (or other master agreement) between
      {' '}
      <strong>{LEGAL_COMPANY.legalName}</strong>
      {' '}
      (&quot;Processor&quot;, &quot;Ranksmile&quot;) and the customer entity that accepts the Terms
      (&quot;Controller&quot;, &quot;Customer&quot;).
    </p>
    <p>
      This DPA applies when Ranksmile processes personal data on Customer&apos;s behalf in the course
      of providing the Service. It does not replace our role as independent controller for account,
      billing, and product operations data described in the
      {' '}
      <a href="/legal/privacy">Privacy Policy</a>
      .
    </p>

    <h2>1. Definitions</h2>
    <p>
      Terms such as &quot;personal data&quot;, &quot;processing&quot;, &quot;controller&quot;,
      &quot;processor&quot;, and &quot;sub-processor&quot; have the meanings in the GDPR. &quot;Customer
      Personal Data&quot; means personal data contained in Customer Content or otherwise processed by
      Ranksmile solely on Customer&apos;s documented instructions as a processor.
    </p>

    <h2>2. Roles</h2>
    <ul>
      <li>Customer is the controller (or processor instructing Ranksmile as a sub-processor).</li>
      <li>Ranksmile is the processor for Customer Personal Data in the Service.</li>
      <li>Each party will comply with its obligations under applicable data protection law.</li>
    </ul>

    <h2>3. Details of processing</h2>
    <h3>3.1 Subject matter and duration</h3>
    <p>
      Processing of Customer Personal Data to provide the Ranksmile Service for the term of the
      agreement and until deletion or return under this DPA.
    </p>
    <h3>3.2 Nature and purpose</h3>
    <p>
      Hosting, storage, transmission, analysis, AI-assisted processing, scoring, export, and related
      operations initiated by Customer users in the Service.
    </p>
    <h3>3.3 Types of personal data</h3>
    <p>
      As determined by Customer — commonly identifiers, contact data, content authored by individuals,
      URLs, and other data Customer chooses to upload or connect. Ranksmile does not control what
      Customer submits.
    </p>
    <h3>3.4 Data subjects</h3>
    <p>
      Customer&apos;s personnel, contractors, end users, or other individuals whose data appears in
      Customer Content.
    </p>

    <h2>4. Instructions</h2>
    <p>
      Ranksmile will process Customer Personal Data only on documented instructions from Customer,
      including via the Service configuration, unless required by EU or Member State law. If we believe
      an instruction infringes GDPR, we will inform Customer (unless legally prohibited).
    </p>

    <h2>5. Confidentiality and personnel</h2>
    <p>
      Persons authorized to process Customer Personal Data are bound by confidentiality and receive
      appropriate training. Access is limited on a need-to-know basis.
    </p>

    <h2>6. Security</h2>
    <p>
      Ranksmile implements appropriate technical and organizational measures under Art. 32 GDPR,
      including access controls, encryption in transit, logging, and vulnerability handling practices
      proportionate to risk. Customer is responsible for securing its own accounts, API keys, and
      endpoint devices.
    </p>

    <h2>7. Sub-processors</h2>
    <p>
      Customer authorizes Ranksmile to engage sub-processors for infrastructure and product
      operations (for example hosting, database, email, monitoring, and AI providers used to deliver
      features Customer enables). We will impose data-protection terms no less protective than this
      DPA. A current list of material sub-processors is available on request at
      {' '}
      <a href={`mailto:${LEGAL_COMPANY.privacyEmail}`}>{LEGAL_COMPANY.privacyEmail}</a>
      {' '}
      (publish a public list before launch if required by your sales process).
    </p>
    <p>
      We will provide notice of material sub-processor changes where practicable. Customer may object
      on reasonable data-protection grounds; if unresolved, Customer may terminate the affected
      Service as its sole remedy.
    </p>

    <h2>8. International transfers</h2>
    <p>
      Where Customer Personal Data is transferred outside the EEA/UK, Ranksmile will ensure a valid
      transfer mechanism (e.g. SCCs) with the relevant recipient, unless an adequacy decision applies.
    </p>

    <h2>9. Assistance</h2>
    <p>
      Taking into account the nature of processing, Ranksmile will assist Customer by appropriate
      technical and organizational measures with data-subject requests, DPIAs, and consultations with
      supervisory authorities, at Customer&apos;s reasonable request and cost where the assistance is
      beyond standard product self-serve capabilities.
    </p>

    <h2>10. Personal data breach</h2>
    <p>
      Ranksmile will notify Customer without undue delay after becoming aware of a personal data
      breach affecting Customer Personal Data, and provide information reasonably available to help
      Customer meet Art. 33/34 obligations.
    </p>

    <h2>11. Deletion and return</h2>
    <p>
      Upon termination of the Service (or earlier written request), Ranksmile will delete or return
      Customer Personal Data within a commercially reasonable period, except where retention is
      required by law or needed for dispute resolution / security logs (retained under our own
      controller purposes where applicable).
    </p>

    <h2>12. Audits</h2>
    <p>
      Upon reasonable written notice, no more than once annually (unless a competent authority or
      confirmed breach requires otherwise), Customer may request information reasonably necessary to
      demonstrate compliance with this DPA, including summaries of security practices. On-site audits
      require mutual agreement on scope, timing, and confidentiality, and are at Customer&apos;s
      expense unless a material breach of this DPA is found.
    </p>

    <h2>13. Liability</h2>
    <p>
      Liability under this DPA is subject to the limitations in the Terms, except where mandatory law
      provides otherwise regarding data protection claims.
    </p>

    <h2>14. Contact</h2>
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
      <a href={`mailto:${LEGAL_COMPANY.privacyEmail}`}>{LEGAL_COMPANY.privacyEmail}</a>
      {' · '}
      <a href={`mailto:${LEGAL_COMPANY.legalEmail}`}>{LEGAL_COMPANY.legalEmail}</a>
    </p>
  </LegalLayout>
);

export default DpaPage;
