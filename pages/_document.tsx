import Document, { Html, Head, Main, NextScript } from 'next/document';
import { ACCENT_NAMES, accentPreloadVars } from '../components/koala/tokens/themes';

/** accent -> the CSS variables it changes, serialised for the no-flash script below. */
const ACCENT_VARS = JSON.stringify(
  Object.fromEntries(ACCENT_NAMES.map((name) => [name, accentPreloadVars(name)])),
);

class MyDocument extends Document {
  // eslint-disable-next-line class-methods-use-this
  render() {
    return (
      <Html>
        <Head>
          <link rel="manifest" href="/manifest.json" />
          <link rel="icon" href="/favicon.svg" type="image/svg+xml" />
          <link rel="icon" href="/favicon.ico" sizes="any" />
          <link rel="apple-touch-icon" href="/icon.png" />
          <meta name="theme-color" content="#F84416" />
          {/* Koala UI / Ranksmile — DM Sans */}
          <link rel="preconnect" href="https://fonts.googleapis.com" />
          <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
          <link
            href="https://fonts.googleapis.com/css2?family=DM+Sans:ital,opsz,wght@0,9..40,400;0,9..40,500;0,9..40,700;1,9..40,400&display=swap"
            rel="stylesheet"
          />
        </Head>
        <body>
          <script
            // Avoid theme AND accent flash: both are applied before React hydrates.
            // The accent used to land only after the provider mounted, so a saved accent
            // showed one orange frame on every reload.
            dangerouslySetInnerHTML={{
              __html: `(function(){try{var d=document.documentElement;var t=localStorage.getItem('ranksmile-theme');if(t==='light'||t==='dark'||t==='cream'||t==='moonlight'){d.setAttribute('data-theme',t);}var a=localStorage.getItem('ranksmile-accent');var m=${ACCENT_VARS};if(a&&m[a]){for(var k in m[a]){d.style.setProperty(k,m[a][k]);}}}catch(e){}})();`,
            }}
          />
          <Main />
          <NextScript />
        </body>
      </Html>
    );
  }
}

export default MyDocument;
