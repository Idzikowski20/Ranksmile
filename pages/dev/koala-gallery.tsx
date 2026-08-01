import React from 'react';
import Head from 'next/head';
import type { GetServerSideProps, NextPage } from 'next';
import { KoalaGallery } from '../../components/koala/gallery';

/**
 * @deprecated Dev gallery kept for Playwright smoke/visual (`e2e/smoke`, `e2e/visual/gallery`).
 * Do not delete until those e2e suites retarget product surfaces. Cleanup Wave B KEEP.
 *
 * Dev-only wrapper around koala/gallery (Storybook-ready module).
 */
const KoalaGalleryPage: NextPage = () => (
  <>
    <Head>
      <title>Koala gallery — Ranksmile</title>
      <meta name="robots" content="noindex" />
    </Head>
    <KoalaGallery />
  </>
);

export const getServerSideProps: GetServerSideProps = async () => {
  if (process.env.NODE_ENV === 'production' && process.env.ENABLE_KOALA_GALLERY !== '1') {
    return { notFound: true };
  }
  return { props: {} };
};

export default KoalaGalleryPage;
