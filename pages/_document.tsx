import Document, { Html, Head, Main, NextScript } from 'next/document';

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
            // Avoid theme flash: apply data-theme before React hydrates.
            dangerouslySetInnerHTML={{
              __html: `(function(){try{var t=localStorage.getItem('ranksmile-theme');if(t==='light'||t==='dark'||t==='cream'||t==='moonlight'){document.documentElement.setAttribute('data-theme',t);}}catch(e){}})();`,
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
