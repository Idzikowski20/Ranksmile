import type { GetServerSideProps, NextPage } from 'next';
import { resolveGscPostOAuthRedirect } from '../../lib/gscOAuthRedirect';

/** Legacy workspace route `/wordpress` → Settings (GSC OAuth used this as post-connect landing). */
export const getServerSideProps: GetServerSideProps = async (ctx) => {
  const q = ctx.query;
  const isGscReturn = typeof q.gsc_connected !== 'undefined' || typeof q.gsc_error !== 'undefined';
  const destination = isGscReturn
    ? `${resolveGscPostOAuthRedirect('/wordpress')}?${new URLSearchParams(
        Object.entries(q).flatMap(([k, v]) => {
          if (typeof v === 'string') return [[k, v] as [string, string]];
          if (Array.isArray(v) && typeof v[0] === 'string') return [[k, v[0]] as [string, string]];
          return [];
        }),
      ).toString()}`
    : '/settings/wordpress';

  return {
    redirect: { destination, permanent: false },
  };
};

const WordPressIntegrationRedirect: NextPage = () => null;

export default WordPressIntegrationRedirect;
