import type { NextPage } from 'next';
import Head from 'next/head';
import { useRouter } from 'next/router';
import React from 'react';
import AppShell from '../common/AppShell';
import DomainSubLayout from '../domains/DomainSubLayout';
import EmptyEyes from '../common/EmptyEyes';
import { useFetchDomains } from '../../services/domains';
import { slugToDomain } from '../../utils/slugToDomain';

const FONT = 'var(--font-family-primary)';

type LocalPageConfig = {
  title: string;
  description: string;
};

export function createLocalPage(config: LocalPageConfig): NextPage {
  const LocalPage: NextPage = () => {
    const router = useRouter();
    const { domain: slug } = router.query as { domain: string };
    const domain = slug ? slugToDomain(slug) : '';
    const { data: domainsData } = useFetchDomains(router, true);
    const domains = domainsData?.domains || [];

    return (
      <AppShell domains={domains} showAddModal={() => {}} showSettings={() => {}}>
        <Head><title>{`${config.title} — ${domain} — SerpBear`}</title></Head>
        <DomainSubLayout domain={domain} slug={slug || ''} section="Local" heading={config.title} contentMaxWidth="100%">
          <div style={{
            border: '1px solid #F4F4F5',
            borderRadius: 12,
            background: '#FFFFFF',
            padding: '64px 24px',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 14,
            textAlign: 'center',
            fontFamily: FONT,
          }}
          >
            <EmptyEyes size={80} />
            <div style={{ fontSize: 16, fontWeight: 600, color: '#18181B' }}>{config.title}</div>
            <p style={{ maxWidth: 420, fontSize: 14, lineHeight: 1.5, color: '#52525C', margin: 0 }}>
              {config.description}
            </p>
          </div>
        </DomainSubLayout>
      </AppShell>
    );
  };

  return LocalPage;
}
