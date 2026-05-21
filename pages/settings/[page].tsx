import type { GetServerSideProps, NextPage } from 'next';
import SettingsLayout, { normalizeSettingsPage } from '../../components/settings/SettingsLayout';

type SettingsRouteProps = {
  page: string;
};

const SettingsRoutePage: NextPage<SettingsRouteProps> = ({ page }) => {
  return <SettingsLayout page={page} />;
};

export const getServerSideProps: GetServerSideProps<SettingsRouteProps> = async (ctx) => {
  const rawPage = typeof ctx.params?.page === 'string' ? ctx.params.page : 'general';
  return {
    props: {
      page: normalizeSettingsPage(rawPage),
    },
  };
};

export default SettingsRoutePage;
