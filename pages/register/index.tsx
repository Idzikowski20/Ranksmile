import type { NextPage } from 'next';
import Head from 'next/head';
import { useRouter } from 'next/router';
import { useState, useEffect } from 'react';

const Register: NextPage = () => {
   const [mounted, setMounted] = useState(false);
   useEffect(() => setMounted(true), []);

   const router = useRouter();
   const [email, setEmail] = useState('');
   const [password, setPassword] = useState('');
   const [showPassword, setShowPassword] = useState(false);
   const [acceptAll, setAcceptAll] = useState(false);
   const [acceptMarketing, setAcceptMarketing] = useState(false);
   const [acceptTerms, setAcceptTerms] = useState(false);
   const [isLoading, setIsLoading] = useState(false);
   const [error, setError] = useState('');
   const [success, setSuccess] = useState(false);
   const [submitted, setSubmitted] = useState(false);

   const handleAcceptAll = (checked: boolean) => {
      setAcceptAll(checked);
      setAcceptMarketing(checked);
      setAcceptTerms(checked);
   };

   const emailError = submitted && !email.trim();
   const passwordError = submitted && password.length < 8;
   const termsError = submitted && !acceptTerms;

   const handleSubmit = async (e: React.FormEvent) => {
      e.preventDefault();
      setSubmitted(true);
      if (!email.trim() || password.length < 8 || !acceptTerms) return;
      setError('');
      setIsLoading(true);
      // SerpBear is self-hosted — registration is managed via environment variables.
      // This page is visual-only; show an info message.
      await new Promise((r) => setTimeout(r, 800));
      setIsLoading(false);
      setSuccess(true);
   };

   if (!mounted) return null;

   return (
      <>
         <Head>
            <title>Sign up — SerpBear</title>
            <style>{`
            :root {
               --font-family-primary: "Inter", sans-serif;
               --white-160: #ffffff; --white-base: var(--white-160); --white-60: rgba(255,255,255,0.5); --white-100: rgba(255,255,255,0.7);
               --gray-10: #F4F4F5; --gray-20: #E4E4E7; --gray-40: #D4D4D8; --gray-60: #9F9FA9; --gray-70: #71717B;
               --gray-80: #52525C; --gray-100: #3F3F47; --gray-120: #2F2F34; --gray-140: #18181B; --gray-160: #09090B;
               --gray-base: var(--gray-140);
               --purple-70: #783AFB; --purple-base: var(--purple-70); --purple-40: #AA93FD; --purple-100: #4D08B5;
               --blue-80: #155DFC;
               --spacer-md: 0.75rem; --font-md: .875rem;
               --shadow-xs: 0px 1px 2px 0px rgba(26,29,40,0.06);
               --shadow-md: 0px 8px 16px 0px rgba(24,26,34,0.04),0px 2px 8px 0px rgba(24,26,34,0.02),0px 1px 2px 0px rgba(24,26,34,0.06);
               --opacity-60: 0.64;
            }
            *, *::before, *::after { box-sizing: border-box; font-family: var(--font-family-primary); }
            html, body { margin: 0; padding: 0; background: #000; }

            .surfer-page { background: #000; min-height: 100vh; display: flex; flex-direction: column; }
            .page-inner {
               flex: 1; display: flex; align-items: center; justify-content: center;
               padding: 1rem 1.5rem; width: 100%; max-width: 1920px; margin: 0 auto; position: relative;
            }
            @media (min-width: 640px) { .page-inner { align-items: flex-start; } }
            @media (min-height: 800px) { .page-inner { padding-top: 8vh; } }

            /* Title */
            .reg-title {
               margin: 0; padding-bottom: 0.75rem; text-align: center; font-weight: 600;
               color: #fff; line-height: 1; letter-spacing: -0.02em;
               font-size: clamp(1.5rem, 6vw, 3.75rem);
            }

            /* Card */
            .reg-card {
               display: flex; flex-direction: column; align-items: center; gap: 0.75rem;
               width: 100%; max-width: 480px;
            }
            .reg-card form { width: 100%; }
            @media (min-width: 640px) {
               .reg-card { background: var(--gray-10); padding: 2rem; margin-top: 1rem; border-radius: 1rem; }
            }

            /* Button */
            .btn-surfer {
               position: relative; display: inline-flex; align-items: center; justify-content: center;
               gap: 0.5rem; padding: 0.5rem 1.5rem; border-radius: 0.5rem; border: none;
               background: var(--gray-base); color: var(--white-base);
               font-family: var(--font-family-primary); font-size: 1rem; font-weight: 600;
               cursor: pointer; width: 100%; text-decoration: none;
               transition: background 0.15s, opacity 0.15s; outline: none; min-height: 2.5rem;
            }
            .btn-surfer:hover { background: var(--purple-base); }
            .btn-surfer:active { background: var(--purple-100); }
            .btn-surfer:focus-visible { outline: 2px solid var(--purple-40); outline-offset: 2px; }
            .btn-surfer:disabled { opacity: 0.6; cursor: not-allowed; }

            /* Input */
            .input-surfer {
               transition: border-color 0.25s, box-shadow 0.25s;
               background: #fff; box-sizing: border-box; width: 100%;
               padding: 0 var(--spacer-md); font-size: var(--font-md);
               font-family: var(--font-family-primary); min-height: 2.5rem;
               border-radius: 0.5rem; border: 1.5px solid transparent;
               outline: none; box-shadow: var(--shadow-xs); color: var(--gray-base);
            }
            .input-surfer::placeholder { color: var(--gray-80); }
            .input-surfer:focus { border-color: var(--purple-70); box-shadow: 0 0 0 3px rgba(120,58,251,0.15); }
            .input-surfer.has-icon { padding-right: 2.5rem; }
            .input-surfer.is-error { border-color: #f87171 !important; box-shadow: 0 0 0 3px rgba(239,68,68,0.15) !important; }

            /* Validation */
            .field-label { font-size: 0.875rem; font-weight: 500; color: var(--gray-100); display: flex; align-items: center; gap: 2px; }
            .req-star { color: #ef4444; font-weight: 700; font-size: 0.875rem; line-height: 1; }
            .field-err-msg { font-size: 0.75rem; color: #ef4444; font-weight: 500; margin-top: 0.25rem; display: flex; align-items: center; gap: 0.25rem; }
            .field-err-msg::before { content: "⚠"; font-size: 0.7rem; }
            .toggle-input.is-error { outline: 2px solid #f87171; outline-offset: 2px; }

            /* Password toggle */
            .pw-toggle {
               position: absolute; right: var(--spacer-md); top: 50%; transform: translateY(-50%);
               display: flex; align-items: center; background: transparent; border: none;
               padding: 0; cursor: pointer; color: var(--gray-100); transition: color 0.15s;
            }
            .pw-toggle:hover { color: var(--gray-120); }

            /* Separator */
            .sep-line { height: 1px; background: var(--gray-20); flex: 1; min-height: 1px; min-width: 1px; }

            /* Toggle switch (lmeXrk) */
            .toggle-label {
               font-size: var(--font-md); line-height: 1.25rem; font-weight: 500;
               color: var(--gray-base); cursor: pointer; display: flex; align-items: center;
               gap: 0.75rem; position: relative;
            }
            .toggle-input {
               margin: 0; border-radius: 32px; transition: background-color 0.25s;
               background: var(--toggle-bg, var(--gray-60));
               appearance: none; -webkit-appearance: none;
               flex-shrink: 0; width: 24px; height: 12px;
               display: grid; align-items: center; cursor: pointer;
               position: relative;
            }
            .toggle-input::after {
               content: ""; position: absolute; left: 0; top: 0;
               width: 12px; height: 12px; border-radius: 50%;
               background: #fff; box-shadow: var(--shadow-md);
               transition: transform 0.25s, background-color 0.25s;
               transform: translateX(0px);
            }
            .toggle-input:checked { background: var(--purple-70); }
            .toggle-input:checked::after { transform: translateX(12px); }

            /* Link */
            .link-surfer {
               color: var(--gray-base); text-decoration: underline; text-underline-offset: 0.05em;
               transition: color 0.15s; display: inline-flex; align-items: center; gap: 0.125rem; cursor: pointer;
            }
            .link-surfer:hover { color: var(--purple-base); }
            .link-surfer:active { color: var(--purple-100); }

            /* Link ghost (Already have account) */
            .link-ghost {
               display: inline-flex; align-items: center; background: transparent; border: none;
               color: #fff; font-family: var(--font-family-primary); font-size: 0.875rem; font-weight: 600;
               padding-left: 0.25rem; text-decoration: none; transition: opacity 0.15s; cursor: pointer;
            }
            .link-ghost:hover { opacity: 0.8; }

            /* Error / Success */
            .error-msg {
               padding: 0.625rem 0.875rem; background: #fef2f2; border: 1px solid #fecaca;
               border-radius: 0.5rem; color: #dc2626; font-size: 0.875rem; font-weight: 500;
               text-align: center; width: 100%;
            }
            .success-msg {
               padding: 1rem; background: #f0fdf4; border: 1px solid #86efac;
               border-radius: 0.5rem; color: #16a34a; font-size: 0.875rem; font-weight: 500;
               text-align: center; width: 100%; line-height: 1.5;
            }

            /* Spinner */
            .spin {
               width: 15px; height: 15px; border: 2px solid rgba(255,255,255,0.3);
               border-top-color: #fff; border-radius: 50%; animation: sb-spin 0.65s linear infinite; flex-shrink: 0;
            }
            @keyframes sb-spin { to { transform: rotate(360deg); } }

            /* Hint text */
            .hint-text { font-size: 0.8125rem; line-height: 1.25rem; color: var(--gray-100); padding-top: 0.375rem; }

            @media (max-width: 639px) {
               .sep-row { display: none !important; }
               .toggle-label span { color: var(--white-60); }
               .toggle-label .link-surfer { color: var(--white-60); }
            }
         `}</style>
         </Head>

         <div className="surfer-page">
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '1rem', paddingTop: '1rem', paddingBottom: '1rem' }}>
               <div className="page-inner">
                  <div style={{ width: '100%', maxWidth: 600 }}>
                     <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem' }}>

                        {/* Title */}
                        <div style={{ paddingTop: '1rem', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                           <h1 className="reg-title">Sign up for SerpBear</h1>
                           <div style={{ minHeight: '1.5rem' }} />
                        </div>

                        {/* Card */}
                        <div className="reg-card">

                           {/* Google button */}
                           <button type="button" className="btn-surfer" onClick={() => alert('Google sign-up is not available in self-hosted mode.')}>
                              <svg width="1.2em" height="1.2em" viewBox="0 0 16 16" fill="none" style={{ flexShrink: 0 }}>
                                 <g clipPath="url(#rg)">
                                    <path d="M15.6823 8.18368C15.6823 7.63986 15.6382 7.0931 15.5442 6.55811H7.99829V9.63876H12.3194C12.1401 10.6323 11.564 11.5113 10.7203 12.0698V14.0687H13.2983C14.8122 12.6753 15.6823 10.6176 15.6823 8.18368Z" fill="#4285F4" />
                                    <path d="M7.99812 16C10.1558 16 11.9753 15.2915 13.3011 14.0687L10.7231 12.0698C10.0058 12.5578 9.07988 12.8341 8.00106 12.8341C5.91398 12.8341 4.14436 11.426 3.50942 9.53296H0.849121V11.5936C2.2072 14.295 4.97332 16 7.99812 16Z" fill="#34A853" />
                                    <path d="M3.50665 9.53295C3.17154 8.53938 3.17154 7.4635 3.50665 6.46993V4.4093H0.849292C-0.285376 6.66982 -0.285376 9.33306 0.849292 11.5936L3.50665 9.53295Z" fill="#FBBC04" />
                                    <path d="M7.99812 3.16589C9.13867 3.14825 10.241 3.57743 11.067 4.36523L13.3511 2.0812C11.9048 0.723121 9.98526 -0.0235266 7.99812 -1.02057e-05C4.97332 -1.02057e-05 2.2072 1.70493 0.849121 4.40932L3.50648 6.46995C4.13848 4.57394 5.91104 3.16589 7.99812 3.16589Z" fill="#EA4335" />
                                 </g>
                                 <defs><clipPath id="rg"><rect width="15.6825" height="16" fill="white" /></clipPath></defs>
                              </svg>
                              <span>Sign up with Google</span>
                           </button>

                           {/* Divider */}
                           <div className="sep-row" style={{ display: 'flex', width: '100%', alignItems: 'center', justifyContent: 'center', color: 'rgba(255,255,255,0.7)' }}>
                              <div style={{ display: 'flex', width: '100%', alignItems: 'center' }}><div className="sep-line" /></div>
                              <div style={{ padding: '0 1rem', display: 'inline-block', fontSize: '0.875rem' }}>or</div>
                              <div style={{ display: 'flex', width: '100%', alignItems: 'center' }}><div className="sep-line" /></div>
                           </div>

                           {/* Form */}
                           <form onSubmit={handleSubmit} style={{ width: '100%' }}>
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>

                                 {/* Email */}
                                 <div style={{ display: 'flex', flexDirection: 'column', gap: '0.375rem' }}>
                                    <label htmlFor="reg-email" className="field-label">
                                       Email <span className="req-star">*</span>
                                    </label>
                                    <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                                       <input
                                          id="reg-email"
                                          className={`input-surfer${emailError ? ' is-error' : ''}`}
                                          type="text"
                                          placeholder="Enter your email"
                                          value={email}
                                          onChange={(e) => setEmail(e.target.value)}
                                          autoComplete="email"
                                          autoFocus
                                       />
                                    </div>
                                    {emailError && <span className="field-err-msg">This field is required</span>}
                                 </div>

                                 {/* Password */}
                                 <div style={{ display: 'flex', flexDirection: 'column', gap: '0.375rem' }}>
                                    <label htmlFor="reg-password" className="field-label">
                                       Password <span className="req-star">*</span>
                                    </label>
                                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                                       <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                                          <input
                                             id="reg-password"
                                             className={`input-surfer has-icon${passwordError ? ' is-error' : ''}`}
                                             type={showPassword ? 'text' : 'password'}
                                             placeholder="Enter your password"
                                             value={password}
                                             onChange={(e) => setPassword(e.target.value)}
                                             autoComplete="new-password"
                                          />
                                          <button type="button" className="pw-toggle" aria-label={showPassword ? 'Hide password' : 'Show password'} onClick={() => setShowPassword(!showPassword)}>
                                             {showPassword ? (
                                                <svg viewBox="0 0 20 20" width="1.2em" height="1.2em"><g fill="currentColor"><path fillRule="evenodd" d="M3.28 2.22a.75.75 0 0 0-1.06 1.06l14.5 14.5a.75.75 0 1 0 1.06-1.06l-1.745-1.745a10.03 10.03 0 0 0 3.3-4.38 1.65 1.65 0 0 0 0-1.185A10 10 0 0 0 9.999 3a9.96 9.96 0 0 0-4.744 1.194zm4.472 4.47 1.092 1.092a2.5 2.5 0 0 1 3.374 3.373l1.091 1.092A4 4 0 0 0 7.752 6.69" clipRule="evenodd" /><path d="m10.748 13.93 2.523 2.523a10 10 0 0 1-3.27.547c-4.258 0-7.894-2.66-9.337-6.41a1.65 1.65 0 0 1 0-1.186A10 10 0 0 1 2.839 6.02L6.07 9.252Q6 9.616 6 10a4 4 0 0 0 4.748 3.93" /></g></svg>
                                             ) : (
                                                <svg viewBox="0 0 20 20" width="1.2em" height="1.2em"><path fill="currentColor" d="M10 12.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5Z" /><path fill="currentColor" fillRule="evenodd" d="M.664 10.59a1.651 1.651 0 0 1 0-1.186A10.004 10.004 0 0 1 10 3c4.257 0 7.893 2.66 9.336 6.41.147.381.146.804 0 1.186A10.004 10.004 0 0 1 10 17c-4.257 0-7.893-2.66-9.336-6.41ZM14 10a4 4 0 1 1-8 0 4 4 0 0 1 8 0Z" clipRule="evenodd" /></svg>
                                             )}
                                          </button>
                                       </div>
                                       {passwordError
                                          ? <span className="field-err-msg">{password.length === 0 ? 'This field is required' : 'Password must be at least 8 characters'}</span>
                                          : <div className="hint-text">Use at least 8 characters.</div>
                                       }
                                    </div>
                                 </div>

                                 {/* Toggles */}
                                 <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>

                                    {/* Accept all */}
                                    <div style={{ display: 'flex', gap: '0.75rem' }}>
                                       <label className="toggle-label">
                                          <input
                                             type="checkbox"
                                             className="toggle-input"
                                             checked={acceptAll}
                                             onChange={(e) => handleAcceptAll(e.target.checked)}
                                          />
                                          <span>Accept all</span>
                                       </label>
                                    </div>

                                    {/* Marketing */}
                                    <div style={{ display: 'flex', gap: '0.75rem' }}>
                                       <label className="toggle-label">
                                          <input
                                             type="checkbox"
                                             className="toggle-input"
                                             checked={acceptMarketing}
                                             onChange={(e) => { setAcceptMarketing(e.target.checked); if (!e.target.checked) setAcceptAll(false); }}
                                          />
                                          <span>Send me early access to new features, expert tutorials, and special offers.</span>
                                       </label>
                                    </div>

                                    {/* Terms */}
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                                       <div style={{ display: 'flex', gap: '0.75rem' }}>
                                          <label className="toggle-label">
                                             <input
                                                type="checkbox"
                                                className={`toggle-input${termsError ? ' is-error' : ''}`}
                                                checked={acceptTerms}
                                                onChange={(e) => { setAcceptTerms(e.target.checked); if (!e.target.checked) setAcceptAll(false); }}
                                             />
                                             <span>
                                                I have read and accept{' '}
                                                <a className="link-surfer" href="https://surferseo.com/regulations" target="_blank" rel="noopener noreferrer">Regulations</a>
                                                {' '}and{' '}
                                                <a className="link-surfer" href="https://surferseo.com/privacy-policy" target="_blank" rel="noopener noreferrer">Privacy Policy</a>
                                                {' '}<span className="req-star">*</span>
                                             </span>
                                          </label>
                                       </div>
                                       {termsError && <span className="field-err-msg" style={{ paddingLeft: '2.25rem' }}>You must accept the Terms and Privacy Policy</span>}
                                    </div>
                                 </div>

                                 {/* Error */}
                                 {error && <div className="error-msg">{error}</div>}

                                 {/* Success */}
                                 {success && (
                                    <div className="success-msg">
                                       SerpBear is self-hosted — accounts are managed via environment variables by the administrator.<br />
                                       <a href="/login" style={{ color: 'var(--purple-base)', textDecoration: 'underline' }}>← Back to login</a>
                                    </div>
                                 )}

                                 {/* Submit */}
                                 {!success && (
                                    <button type="submit" className="btn-surfer" disabled={isLoading}>
                                       {isLoading ? <><div className="spin" /><span>Creating account…</span></> : <span>Sign up with Email</span>}
                                    </button>
                                 )}

                              </div>
                           </form>
                        </div>

                        {/* Footer — Already have account */}
                        <div style={{ color: '#fff', fontSize: '0.875rem', textAlign: 'center' }}>
                           Already have an account?
                           <a className="link-ghost" href="/login">Log in</a>
                        </div>

                     </div>
                  </div>
               </div>
            </div>
         </div>
      </>
   );
};

export default Register;
