import type { NextPage } from 'next';
import Head from 'next/head';
import { useEffect } from 'react';

const Login: NextPage = () => {
   useEffect(() => {
      // Przekierowanie do Auth0 Universal Login
      window.location.href = '/api/auth/login';
   }, []);

   return (
      <>
         <Head>
            <title>Log in — SerpBear</title>
            <style>{`
               *, *::before, *::after { box-sizing: border-box; font-family: "Inter", sans-serif; }
               html, body { margin: 0; padding: 0; background: #000; }
               .splash { background: #000; min-height: 100vh; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 1.5rem; }
               .splash-title { margin: 0; font-size: clamp(1.5rem, 6vw, 3.75rem); font-weight: 600; color: #fff; letter-spacing: -0.02em; }
               .splash-spin { width: 28px; height: 28px; border: 3px solid rgba(255,255,255,0.2); border-top-color: #783AFB; border-radius: 50%; animation: sp 0.75s linear infinite; }
               .splash-sub { font-size: 0.9rem; color: rgba(255,255,255,0.45); }
               @keyframes sp { to { transform: rotate(360deg); } }
            `}</style>
         </Head>

         <div className="splash">
            <h1 className="splash-title">SerpBear</h1>
            <div className="splash-spin" />
            <p className="splash-sub">Redirecting to login…</p>
         </div>
      </>
   );
};

export default Login;
