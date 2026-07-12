import type { GetServerSideProps, NextPage } from 'next';

/**
 * The domain root now lands on SEO Overview.
 */
export const getServerSideProps: GetServerSideProps = async (ctx) => {
   const domain = ctx.params?.domain as string;
   return { redirect: { destination: `/sites/${domain}/seo-overview`, permanent: false } };
};

const SingleDomain: NextPage = () => null;

export default SingleDomain;
