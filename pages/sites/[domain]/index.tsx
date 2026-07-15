import type { GetServerSideProps, NextPage } from 'next';

export const getServerSideProps: GetServerSideProps = async (ctx) => {
   const domain = ctx.params?.domain as string;
   return { redirect: { destination: `/sites/${domain}/performance`, permanent: false } };
};

const SingleDomain: NextPage = () => null;

export default SingleDomain;
