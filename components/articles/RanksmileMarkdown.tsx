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
  Comp.displayName = 'RanksmileMarkdownInner';
  return { default: Comp };
});

const MD_CSS = `
.ranksmile-md { color: #18181b; font-size: 14px; line-height: 1.55; font-family: var(--font-family-primary); word-break: break-word; }
.ranksmile-md > :first-child { margin-top: 0; }
.ranksmile-md > :last-child { margin-bottom: 0; }
.ranksmile-md p { margin: 8px 0; }
.ranksmile-md h1 { font-size: 1.5em; font-weight: 600; color: #18181b; line-height: 1.25; margin: 18px 0 8px; }
.ranksmile-md h2 { font-size: 1.25em; font-weight: 600; color: #18181b; line-height: 1.25; margin: 16px 0 8px; }
.ranksmile-md h3 { font-size: 1.1em; font-weight: 600; color: #18181b; line-height: 1.3; margin: 14px 0 6px; }
.ranksmile-md h4, .ranksmile-md h5, .ranksmile-md h6 { font-size: 1em; font-weight: 600; color: #18181b; margin: 12px 0 6px; }
.ranksmile-md strong, .ranksmile-md b { font-weight: 600; color: #18181b; }
.ranksmile-md em { font-style: italic; }
.ranksmile-md a { color: #F84416; text-decoration: none; }
.ranksmile-md a:hover { text-decoration: underline; }
.ranksmile-md ul, .ranksmile-md ol { margin: 8px 0; padding-left: 22px; }
.ranksmile-md ul { list-style: disc; }
.ranksmile-md ol { list-style: decimal; }
.ranksmile-md li { margin: 3px 0; }
.ranksmile-md blockquote { border-left: 3px solid #e4e4e7; color: #52525c; margin: 10px 0; padding: 2px 0 2px 12px; }
.ranksmile-md code { background: #f4f4f5; border-radius: 6px; padding: 1px 5px; font-size: 0.92em; font-family: ui-monospace, SFMono-Regular, Menlo, monospace; color: #be185d; }
.ranksmile-md pre { background: #f8f9ff; border: 1px solid #e4e4e7; border-radius: 8px; padding: 12px; overflow-x: auto; margin: 10px 0; }
.ranksmile-md pre code { background: none; padding: 0; color: #18181b; font-size: 0.88em; }
.ranksmile-md hr { border: none; border-top: 1px solid #e4e4e7; margin: 14px 0; }
.ranksmile-md table { border-collapse: collapse; margin: 10px 0; }
.ranksmile-md th, .ranksmile-md td { border: 1px solid #e4e4e7; padding: 6px 10px; text-align: left; font-size: 13px; }
.ranksmile-md th { background: #f4f4f5; font-weight: 600; }
.ranksmile-md img { max-width: 100%; height: auto; border-radius: 6px; }
`;

const RanksmileMarkdown = ({ children }: { children: string }) => (
  <div className="ranksmile-md">
    <style>{MD_CSS}</style>
    <Suspense fallback={<div style={{ whiteSpace: 'pre-wrap' }}>{children}</div>}>
      <Markdown>{children}</Markdown>
    </Suspense>
  </div>
);

export default RanksmileMarkdown;
