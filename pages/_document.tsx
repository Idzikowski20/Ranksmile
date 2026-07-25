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
          <meta name="theme-color" content="#50B9FF" />
          {/* Official Inter (rsms.me) — the Google Fonts build is outdated and ships
              WITHOUT the cvXX / slashed-zero OpenType features, so font-feature-settings
              had no effect. This build (InterVariable) includes them. */}
          <link rel="preconnect" href="https://rsms.me/" />
          <link rel="stylesheet" href="https://rsms.me/inter/inter.css" />
          <style dangerouslySetInnerHTML={{ __html: '@font-face{font-family:"InterVariable";font-style:normal;font-weight:100 900;font-display:swap;src:url("https://rsms.me/inter/font-files/InterVariable.woff2?v=4.0") format("woff2")}' }} />
        </Head>
        <body>
          <Main />
          <NextScript />
        </body>
      </Html>
    );
  }
}

export default MyDocument;
