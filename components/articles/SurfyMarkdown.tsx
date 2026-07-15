import React, { Suspense } from 'react';

// Assistant message body. Lazy-loads react-markdown + remark-gfm client-side (both ESM; lazy import
// avoids Next 12 SSR/build issues) so GFM tables/strikethrough/task-lists render. Styled to match
// Twenty's assistant body in the app's light theme (design.md tokens).
const Markdown = React.lazy(async () => {
  const [{ default: ReactMarkdown }, { default: remarkGfm }] = await Promise.all([
    import('react-markdown'),
    import('remark-gfm'),
  ]);
  const Comp = ({ children }: { children: string }) => <ReactMarkdown remarkPlugins={[remarkGfm]}>{children}</ReactMarkdown>;
  Comp.displayName = 'SurfyMarkdownInner';
  return { default: Comp };
});

const MD_CSS = `
.surfy-md { color: #18181b; font-size: 14px; line-height: 1.55; font-family: var(--font-family-primary); word-break: break-word; }
.surfy-md > :first-child { margin-top: 0; }
.surfy-md > :last-child { margin-bottom: 0; }
.surfy-md p { margin: 8px 0; }
.surfy-md h1 { font-size: 1.5em; font-weight: 600; color: #18181b; line-height: 1.25; margin: 18px 0 8px; }
.surfy-md h2 { font-size: 1.25em; font-weight: 600; color: #18181b; line-height: 1.25; margin: 16px 0 8px; }
.surfy-md h3 { font-size: 1.1em; font-weight: 600; color: #18181b; line-height: 1.3; margin: 14px 0 6px; }
.surfy-md h4, .surfy-md h5, .surfy-md h6 { font-size: 1em; font-weight: 600; color: #18181b; margin: 12px 0 6px; }
.surfy-md strong, .surfy-md b { font-weight: 600; color: #18181b; }
.surfy-md em { font-style: italic; }
.surfy-md a { color: #f29964; text-decoration: none; }
.surfy-md a:hover { text-decoration: underline; }
.surfy-md ul, .surfy-md ol { margin: 8px 0; padding-left: 22px; }
.surfy-md ul { list-style: disc; }
.surfy-md ol { list-style: decimal; }
.surfy-md li { margin: 3px 0; }
.surfy-md blockquote { border-left: 3px solid #e4e4e7; color: #52525c; margin: 10px 0; padding: 2px 0 2px 12px; }
.surfy-md code { background: #f4f4f5; border-radius: 6px; padding: 1px 5px; font-size: 0.92em; font-family: ui-monospace, SFMono-Regular, Menlo, monospace; color: #be185d; }
.surfy-md pre { background: #f8f9ff; border: 1px solid #e4e4e7; border-radius: 8px; padding: 12px; overflow-x: auto; margin: 10px 0; }
.surfy-md pre code { background: none; padding: 0; color: #18181b; font-size: 0.88em; }
.surfy-md hr { border: none; border-top: 1px solid #e4e4e7; margin: 14px 0; }
.surfy-md table { border-collapse: collapse; margin: 10px 0; }
.surfy-md th, .surfy-md td { border: 1px solid #e4e4e7; padding: 6px 10px; text-align: left; font-size: 13px; }
.surfy-md th { background: #f4f4f5; font-weight: 600; }
.surfy-md img { max-width: 100%; height: auto; border-radius: 6px; }
`;

const SurfyMarkdown = ({ children }: { children: string }) => (
  <div className="surfy-md">
    <style>{MD_CSS}</style>
    <Suspense fallback={<div style={{ whiteSpace: 'pre-wrap' }}>{children}</div>}>
      <Markdown>{children}</Markdown>
    </Suspense>
  </div>
);

export default SurfyMarkdown;
