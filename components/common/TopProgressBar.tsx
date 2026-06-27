import React, { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/router';

const ACCENT = '#783AFB';

/**
 * Thin purple page-load bar pinned to the very top of the viewport (above the
 * topbar). Driven by Next.js route events: trickles toward 90% while a navigation
 * is in flight, snaps to 100% and fades out on completion.
 */
const TopProgressBar = () => {
   const router = useRouter();
   const [progress, setProgress] = useState(0);
   const [visible, setVisible] = useState(false);
   const trickle = useRef<ReturnType<typeof setInterval> | null>(null);
   const finish = useRef<ReturnType<typeof setTimeout> | null>(null);
   const reset = useRef<ReturnType<typeof setTimeout> | null>(null);

   useEffect(() => {
      const stopTrickle = () => { if (trickle.current) { clearInterval(trickle.current); trickle.current = null; } };

      const start = () => {
         if (finish.current) { clearTimeout(finish.current); finish.current = null; }
         if (reset.current) { clearTimeout(reset.current); reset.current = null; }
         stopTrickle();
         setVisible(true);
         setProgress(8);
         trickle.current = setInterval(() => {
            setProgress((p) => (p >= 90 ? p : Math.min(90, p + (p < 50 ? 6 : p < 75 ? 3 : 1))));
         }, 300);
      };

      const done = () => {
         stopTrickle();
         setProgress(100);
         finish.current = setTimeout(() => {
            setVisible(false);
            // Reset width only after the fade so the bar doesn't visibly rewind.
            reset.current = setTimeout(() => setProgress(0), 300);
         }, 250);
      };

      router.events.on('routeChangeStart', start);
      router.events.on('routeChangeComplete', done);
      router.events.on('routeChangeError', done);
      return () => {
         router.events.off('routeChangeStart', start);
         router.events.off('routeChangeComplete', done);
         router.events.off('routeChangeError', done);
         stopTrickle();
         if (finish.current) clearTimeout(finish.current);
         if (reset.current) clearTimeout(reset.current);
      };
   }, [router]);

   return (
      <div
         aria-hidden="true"
         style={{
            position: 'fixed', top: 0, left: 0, right: 0, height: 3, zIndex: 2000,
            pointerEvents: 'none', opacity: visible ? 1 : 0, transition: 'opacity 300ms ease',
         }}
      >
         <div
            style={{
               height: '100%', width: `${progress}%`, background: ACCENT,
               borderRadius: '0 2px 2px 0',
               boxShadow: `0 0 8px ${ACCENT}, 0 0 4px ${ACCENT}`,
               transition: 'width 200ms ease',
            }}
         />
      </div>
   );
};

export default TopProgressBar;
