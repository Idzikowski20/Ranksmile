import type { NextPage } from 'next';
import { useEffect } from 'react';
import { useRouter } from 'next/router';
import AppLoading from '../components/common/AppLoading';

const HomepageAlias: NextPage = () => {
   const router = useRouter();
   useEffect(() => {
      router.replace('/');
   }, [router]);
   return <AppLoading />;
};

export default HomepageAlias;
