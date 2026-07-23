import type { NextPage } from 'next';
import Head from 'next/head';
import { useRouter } from 'next/router';
import React from 'react';
import AppShell from '../../../../components/common/AppShell';
import DomainSubLayout from '../../../../components/domains/DomainSubLayout';
import ListingsManagementContent from '../../../../components/local/listings/ListingsManagementContent';
import { useFetchDomains } from '../../../../services/domains';
import { slugToDomain } from '../../../../utils/slugToDomain';

const ListingManagementPage: NextPage = () => {
  const router = useRouter();
  const { domain: slug } = router.query as { domain: string };
  const domain = slug ? slugToDomain(slug) : '';
  const { data: domainsData } = useFetchDomains(router, true);
  const domains = domainsData?.domains || [];

  return (
    <AppShell domains={domains} showAddModal={() => {}} showSettings={() => {}}>
      <Head><title>{`Listing Management — ${domain} — SerpBear`}</title></Head>
      <DomainSubLayout
        domain={domain}
        slug={slug || ''}
        section="Local"
        heading="Listing Management"
        contentMaxWidth={960}
      >
        <ListingsManagementContent slug={slug || ''} />
      </DomainSubLayout>
    </AppShell>
  );
};

export default ListingManagementPage;
