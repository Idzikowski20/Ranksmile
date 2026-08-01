import React from 'react';
import Head from 'next/head';
import type { GetServerSideProps, NextPage } from 'next';
import { DashboardRegions } from '../../components/koala/gallery/DashboardRegions';

/** Dev-only stub for dashboard visual regions (no auth). */
const KoalaDashboardRegionsPage: NextPage = () => (
  <>
    <Head>
      <title>Koala dashboard regions — Ranksmile</title>
      <meta name="robots" content="noindex" />
    </Head>
    <DashboardRegions />
  </>
);

export const getServerSideProps: GetServerSideProps = async () => {
  if (process.env.NODE_ENV === 'production' && process.env.ENABLE_KOALA_GALLERY !== '1') {
    return { notFound: true };
  }
  return { props: {} };
};

export default KoalaDashboardRegionsPage;
