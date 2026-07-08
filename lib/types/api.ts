import type { NextApiResponse } from 'next';

type FlushableResponse = NextApiResponse & {
   flush?: () => void;
   flushHeaders?: () => void;
};

/** SSE helper — flush buffered chunks when the runtime supports it. */
export function flushSse(res: NextApiResponse): void {
   const r = res as FlushableResponse;
   if (typeof r.flush === 'function') r.flush();
}

export function flushHeaders(res: NextApiResponse): void {
   const r = res as FlushableResponse;
   if (typeof r.flushHeaders === 'function') r.flushHeaders();
}
