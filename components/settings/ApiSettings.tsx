import React, { useState } from 'react';
import toast from 'react-hot-toast';
import { Button } from '../core';
import { SentryPanel, SentryPanelHeader, SentryPanelBody } from '../sentry-pages';

const font = 'var(--font-family-primary)';

const RanksmileMark = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <path d="M18.3955 0C21.4658 0 23.9548 2.48899 23.9548 5.55933V7.02488L21.4689 7.78901V5.55016C21.464 3.85696 20.0899 2.48587 18.3955 2.48587H5.55933C3.86192 2.48587 2.48589 3.86189 2.48589 5.55933V11.4871C2.48589 12.517 2.48589 13.0319 2.20286 13.415C1.91983 13.7981 1.42762 13.9494 0.443206 14.252L0 14.3882L9.42195e-06 5.55933C9.42195e-06 2.48899 2.489 0 5.55933 0H18.3955Z" fill="#FF5B49" />
    <path d="M23.5116 9.75731L23.9548 9.62109V18.4408C23.9548 21.5111 21.4658 24.0001 18.3955 24.0001H5.55933C2.48899 24.0001 0 21.5111 0 18.4408L1.55422e-06 16.9844L2.48589 16.2203V18.4499C2.49077 20.1431 3.86493 21.5143 5.55933 21.5143H18.3955C20.0929 21.5143 21.4689 20.1382 21.4689 18.4408V12.5222C21.4689 11.4923 21.4689 10.9774 21.752 10.5943C22.035 10.2112 22.5272 10.0599 23.5116 9.75731Z" fill="#FF5B49" />
    <path d="M6.69922 15.7673V11.1256C6.69922 9.90231 6.95458 9.64697 8.17783 9.64697H8.6353C9.85868 9.64697 10.1139 9.90225 10.1139 11.1256V15.7673C10.1139 16.9907 9.85868 17.2459 8.6353 17.2459H8.17783C6.95458 17.2459 6.69922 16.9906 6.69922 15.7673Z" fill="#FF5B49" />
    <path d="M15.3204 6.75684C14.0972 6.75684 13.8418 7.0122 13.8418 8.23548V15.7674C13.8418 16.9907 14.0972 17.246 15.3204 17.246H15.7779C17.0013 17.246 17.2565 16.9907 17.2565 15.7674V8.23548C17.2565 7.01212 17.0013 6.75684 15.7779 6.75684H15.3204Z" fill="#FF5B49" />
  </svg>
);

const LookerMark = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <path d="M13.38 3.498c-.27 0-.511.19-.566.465L9.85 18.986a.578.578 0 0 0 .453.678l4.095.826a.58.58 0 0 0 .682-.455l2.963-15.021a.578.578 0 0 0-.453-.678l-4.096-.826a.589.589 0 0 0-.113-.012zm-5.876.098a.576.576 0 0 0-.516.318L.062 17.697a.575.575 0 0 0 .256.774l3.733 1.877a.578.578 0 0 0 .775-.258l6.926-13.781a.577.577 0 0 0-.256-.776L7.762 3.658a.571.571 0 0 0-.258-.062zm11.74.115a.576.576 0 0 0-.576.576v15.426c0 .318.258.578.576.578h4.178a.58.58 0 0 0 .578-.578V4.287a.578.578 0 0 0-.578-.576Z" fill="#2F73DA" />
  </svg>
);

const ZapierMark = () => (
  <svg width="20" height="20" viewBox="0 0 18 18" fill="none" aria-hidden="true">
    <path d="M10.5341 10.5374C9.54805 10.9084 8.44312 10.9091 7.45707 10.5376C7.08557 9.55265 7.08548 8.44795 7.4565 7.46285C8.44229 7.09117 9.54832 7.09111 10.5341 7.46279C10.9055 8.4476 10.9053 9.55256 10.5341 10.5374ZM16.1659 7.78889H11.9214L14.9226 4.78947C14.4516 4.12826 13.8701 3.54744 13.2085 3.07672L10.2071 6.07614V1.83438C9.40609 1.69972 8.58458 1.69992 7.78355 1.83438V6.07614L4.78218 3.07672C4.12074 3.54712 3.53908 4.12874 3.06804 4.78947L6.06964 7.78889H1.82518C1.72041 8.61341 1.68637 9.38829 1.82518 10.2111H6.06969L3.0681 13.2105C3.54027 13.8727 4.11957 14.4516 4.78218 14.9235L7.78355 11.9239V16.1658C8.58467 16.3 9.40595 16.3001 10.2071 16.1658V11.9239L13.2087 14.9235C13.8706 14.4523 14.4511 13.872 14.9226 13.2105L11.921 10.2111H16.1659C16.3006 9.41129 16.3006 8.58871 16.1659 7.78889Z" fill="#FF4A00" />
  </svg>
);

const GoogleMark = () => (
  <svg width="20" height="20" viewBox="0 0 186.59 298.85" fill="none" aria-hidden="true">
    <path d="M92.3,0c-14.97,0-26.19,11.22-26.19,26.19,0,4.99,1.25,9.98,4.99,14.97l11.22-11.22v-3.74c0-6.24,4.99-11.22,11.22-11.22s11.22,4.99,11.22,11.22-4.99,11.22-11.22,11.22h-3.74l-11.22,9.98c12.47,7.48,28.7,4.99,36.17-7.48,7.48-12.47,4.99-28.7-7.48-36.17C103.53,1.27,98.54.02,92.3.02v-.02Z" fill="#AECBFA" />
    <path d="M82.32,76.09c0-8.73-2.49-17.46-7.48-24.94l-14.97,14.97c1.25,3.74,2.49,6.24,2.49,9.98,0,6.24-2.49,11.22-6.24,14.97l7.48,19.97c12.47-7.48,18.71-21.2,18.71-34.92l.02-.03Z" fill="#5E97F6" />
    <path d="M42.4,97.29c-11.22,0-21.2-8.73-21.2-19.97s8.73-21.2,19.97-21.2c3.74,0,8.73,1.25,12.47,3.74l14.97-13.72c-8.73-7.48-17.46-11.22-27.44-11.22C18.71,34.92,0,53.64,0,76.09s17.46,41.17,41.17,41.17c2.49,0,6.24,0,8.73-1.25l-7.48-18.71h-.02Z" fill="#5E97F6" />
    <path d="M93.55,113.5c-8.73,0-17.46,1.25-26.19,3.74l11.22,27.44c4.99,0,9.98-1.25,14.97-1.25,34.92,0,62.37,28.7,62.37,62.37s-28.7,62.37-62.37,62.37-62.37-28.7-62.37-62.37c0-23.71,12.47-44.91,33.67-54.89l-11.22-27.44C7.48,145.93-11.22,202.06,11.22,246.96c22.45,46.16,78.58,64.85,123.48,42.4,46.16-22.45,64.85-78.58,42.4-123.48-16.21-31.18-48.64-52.38-83.57-52.38h.02Z" fill="#4285F4" />
  </svg>
);

const LogoCircle = ({ children, overlap }: { children: React.ReactNode; overlap?: boolean }) => (
  <div
    style={{
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      border: '1px solid #E4E4E7',
      borderRadius: 9999,
      padding: 8,
      background: '#fff',
      marginLeft: overlap ? -8 : 0,
    }}
  >
    {children}
  </div>
);

const ApiSettings = () => (
  <div style={{ display: 'flex', flexDirection: 'column', gap: 24, fontFamily: font, width: '100%' }}>
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center' }}>
        <LogoCircle><RanksmileMark /></LogoCircle>
        <div style={{ display: 'flex', alignItems: 'center', margin: '0 -6px', zIndex: 10 }}>
          <div style={{ width: 10, height: 10, borderRadius: 9999, background: '#D4D4D8' }} />
          <div style={{ width: 12, height: 2, background: '#D4D4D8' }} />
          <div style={{ width: 10, height: 10, borderRadius: 9999, background: '#D4D4D8' }} />
        </div>
        <div style={{ display: 'flex', alignItems: 'center' }}>
          <LogoCircle><LookerMark /></LogoCircle>
          <LogoCircle overlap><ZapierMark /></LogoCircle>
          <LogoCircle overlap><GoogleMark /></LogoCircle>
        </div>
      </div>
      <p style={{ margin: 0, fontSize: 16, lineHeight: 1.5 }}>
        <span style={{ fontWeight: 600, color: '#18181B' }}>
          Connect with Zapier, Looker Studio, or your CMS of choice.
        </span>
        <span style={{ display: 'block', fontWeight: 600, color: '#71717B', marginTop: 4 }}>
          Automate query creation, work in bulk, and analyze data without accessing the Ranksmile web app.
        </span>
      </p>
    </div>

    <div style={{ display: 'flex', gap: 16, width: '100%', alignItems: 'stretch', flexWrap: 'wrap' }}>
      <div style={{ flexShrink: 0 }}>
        <SentryPanel>
          <SentryPanelHeader title="Docs" />
          <SentryPanelBody>
            <p style={{ margin: '0 0 12px', fontSize: 14, color: '#71717B' }}>Examples, Troubleshooting, FAQ</p>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <Button variant="secondary" size="sm" onClick={() => window.open('https://ranksmile.pl', '_blank')}>Overview</Button>
              <Button variant="secondary" size="sm" onClick={() => window.open('https://ranksmile.pl', '_blank')}>API reference</Button>
              <Button variant="secondary" size="sm" onClick={() => window.open('https://ranksmile.pl', '_blank')}>LLM-ready docs</Button>
            </div>
          </SentryPanelBody>
        </SentryPanel>
      </div>

      <div style={{ flex: '1 1 280px', minWidth: 0 }}>
        <SentryPanel>
          <SentryPanelHeader title="API access" />
          <SentryPanelBody>
            <p style={{ margin: '0 0 12px', fontSize: 14, color: '#3F3F47', lineHeight: 1.45 }}>
              API access is not available on your plan. Upgrade to unlock API access and integrate Ranksmile with your tools.
            </p>
            <Button type="button" variant="primary" onClick={() => toast.success('Upgrade to Scale — coming soon!')}>
              Upgrade to Scale
            </Button>
          </SentryPanelBody>
        </SentryPanel>
      </div>
    </div>
  </div>
);

export default ApiSettings;
