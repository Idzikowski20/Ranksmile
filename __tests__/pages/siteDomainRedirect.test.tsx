import type { GetServerSidePropsContext } from 'next';
import { getServerSideProps } from '../../pages/sites/[domain]/index';

// The domain root (/sites/[domain]) is a pure redirect to Performance. Doing it in
// getServerSideProps means the legacy keyword-tracker UI never renders/flashes before
// the client-side redirect fires (the bug: old Ranksmile view flashing on load).
describe('sites/[domain] root redirect', () => {
  it('server-redirects to /sites/<domain>/performance', async () => {
    const res = await getServerSideProps({ params: { domain: 'idztech-pl' } } as unknown as GetServerSidePropsContext);
    expect(res).toEqual({ redirect: { destination: '/sites/idztech-pl/performance', permanent: false } });
  });
});
