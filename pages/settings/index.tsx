import type { GetServerSideProps, NextPage } from 'next';

const SettingsIndex: NextPage = () => null;

export const getServerSideProps: GetServerSideProps = async () => {
  return {
    redirect: {
      destination: '/settings/general',
      permanent: false,
    },
  };
};

export default SettingsIndex;
