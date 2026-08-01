import type { NextPage } from 'next';
import Link from 'next/link';
import styled from '@emotion/styled';
import LegalLayout from '../../components/legal/LegalLayout';
import { LEGAL_COMPANY, LEGAL_DOCS } from '../../lib/legal/company';

const Intro = styled.p`
  margin: 0 0 8px;
`;

const GroupTitle = styled.h2`
  margin: 40px 0 0 !important;
`;

const CardList = styled.ul`
  list-style: none !important;
  padding-left: 0 !important;
  margin: 0 0 8px !important;
  display: flex;
  flex-direction: column;
  gap: 12px;
`;

const Card = styled.a`
  display: block;
  padding: 18px 20px;
  border: 1px solid #e5e5e5;
  border-radius: 16px;
  background: #fff;
  text-decoration: none !important;
  color: inherit;

  &:hover {
    border-color: #f84416;
  }
`;

const CardTitle = styled.span`
  display: block;
  font-size: 18px;
  font-weight: 700;
  color: #1a1a1a;
  letter-spacing: -0.3px;
  margin-bottom: 6px;
`;

const CardSummary = styled.span`
  display: block;
  font-size: 15px;
  line-height: 22px;
  color: #575757;
  letter-spacing: -0.3px;
`;

const LegalHubPage: NextPage = () => {
  const agreements = LEGAL_DOCS.filter((d) => d.group === 'agreements');
  const policies = LEGAL_DOCS.filter((d) => d.group === 'policies');

  return (
    <LegalLayout
      title="Legal"
      description="Ranksmile terms, privacy, cookies, and data processing documents."
    >
      <Intro>
        These documents apply to customers and users of Ranksmile (
        {LEGAL_COMPANY.website}
        {' '}
        and related app hosts). Replace company placeholders before launch and have counsel review.
      </Intro>

      <GroupTitle>Terms and agreements</GroupTitle>
      <CardList>
        {agreements.map((doc) => (
          <li key={doc.id}>
            <Link href={doc.href} passHref>
              <Card>
                <CardTitle>{doc.title}</CardTitle>
                <CardSummary>{doc.summary}</CardSummary>
              </Card>
            </Link>
          </li>
        ))}
      </CardList>

      <GroupTitle>Policies</GroupTitle>
      <CardList>
        {policies.map((doc) => (
          <li key={doc.id}>
            <Link href={doc.href} passHref>
              <Card>
                <CardTitle>{doc.title}</CardTitle>
                <CardSummary>{doc.summary}</CardSummary>
              </Card>
            </Link>
          </li>
        ))}
      </CardList>

      <p>
        Questions:
        {' '}
        <a href={`mailto:${LEGAL_COMPANY.legalEmail}`}>{LEGAL_COMPANY.legalEmail}</a>
        {' '}
        or
        {' '}
        <a href={`mailto:${LEGAL_COMPANY.privacyEmail}`}>{LEGAL_COMPANY.privacyEmail}</a>
        .
      </p>
    </LegalLayout>
  );
};

export default LegalHubPage;
