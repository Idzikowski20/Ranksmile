import { NextRouter } from 'next/router';
import { useQuery } from 'react-query';

function domainSlugFromRouter(router: NextRouter): string | undefined {
   const raw = router.query.domain ?? router.query.slug;
   return typeof raw === 'string' ? raw : undefined;
}

export async function fetchSCKeywords(router: NextRouter) {
   const domain = domainSlugFromRouter(router);
   if (!domain) throw new Error('Invalid Domain Name');
   const res = await fetch(`${window.location.origin}/api/searchconsole?domain=${domain}`, { method: 'GET' });
   if (res.status >= 400 && res.status < 600) {
      if (res.status === 401) {
         console.log('Unauthorized!!');
         router.push('/login');
      }
      throw new Error('Bad response from server');
   }
   return res.json();
}

export function useFetchSCKeywords(router: NextRouter, domainLoaded: boolean = false) {
   const domain = domainSlugFromRouter(router);
   return useQuery(['sckeywords', domain], () => fetchSCKeywords(router), { enabled: domainLoaded && !!domain });
}

export async function fetchSCInsight(router: NextRouter) {
   const domain = domainSlugFromRouter(router);
   if (!domain) throw new Error('Invalid Domain Name');
   const res = await fetch(`${window.location.origin}/api/insight?domain=${domain}`, { method: 'GET' });
   if (res.status >= 400 && res.status < 600) {
      if (res.status === 401) {
         console.log('Unauthorized!!');
         router.push('/login');
      }
      throw new Error('Bad response from server');
   }
   return res.json();
}

export function useFetchSCInsight(router: NextRouter, domainLoaded: boolean = false) {
   const domain = domainSlugFromRouter(router);
   return useQuery(['scinsight', domain], () => fetchSCInsight(router), { enabled: domainLoaded && !!domain });
}
