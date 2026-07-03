import type { GetServerSideProps, NextPage } from 'next';

/**
 * The domain root now lands on Performance. The redirect runs server-side so the
 * legacy keyword-tracker view (DomainHeader + KeywordsTable + Footer) never renders
 * — previously it flashed the old SerpBear UI before a client-side router.replace.
 */
export const getServerSideProps: GetServerSideProps = async (ctx) => {
   const domain = ctx.params?.domain as string;
   return { redirect: { destination: `/sites/${domain}/performance`, permanent: false } };
};

const SingleDomain: NextPage = () => null;

export default SingleDomain;
