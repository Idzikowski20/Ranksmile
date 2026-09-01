import { useQuery } from 'react-query';

export async function fetchChangelog() {
   const res = await fetch('https://api.github.com/repos/towfiqi/ranksmile/releases', { method: 'GET' });
   return res.json();
}

export function useFetchChangelog() {
   return useQuery('changelog', () => fetchChangelog(), { cacheTime: 60 * 60 * 1000 });
}
