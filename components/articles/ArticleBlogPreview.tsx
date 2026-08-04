import React from 'react';
import { Icon } from '../koala/icons';

/** Figma blog/rich-text preview styles (nodes 3105:65402 / 4608:18835). */
export const ARTICLE_PREVIEW_CSS = `
.rs-article-preview {
  --ap-text: #1a1a1a;
  --ap-muted: #575757;
  --ap-tertiary: #767676;
  --ap-border: #e5e5e5;
  --ap-brand: #F84416;
  font-family: var(--font-family-primary);
  color: var(--ap-text);
  background: #fff;
  min-height: 100vh;
}
.rs-article-preview__inner {
  max-width: 768px;
  margin: 0 auto;
  padding: 96px 32px;
  box-sizing: border-box;
}
.rs-article-preview__title {
  margin: 0;
  padding: 40px 0 16px;
  font-size: 36px;
  line-height: 44px;
  font-weight: 700;
  letter-spacing: -0.09px;
  color: var(--ap-text);
}
.rs-article-preview__hero {
  width: 100%;
  margin: 0 0 24px;
  border-radius: 16px;
  overflow: hidden;
  display: block;
}
.rs-article-preview__hero img {
  width: 100%;
  height: auto;
  display: block;
  object-fit: cover;
  border-radius: 16px;
}
.rs-article-preview__body {
  font-size: 18px;
  line-height: 26px;
  letter-spacing: -0.5px;
  color: var(--ap-muted);
  font-weight: 400;
}
.rs-article-preview__body > *:first-child { margin-top: 0; }
.rs-article-preview__body h1 {
  margin: 0;
  padding: 40px 0 16px;
  font-size: 36px;
  line-height: 44px;
  font-weight: 700;
  letter-spacing: -0.09px;
  color: var(--ap-text);
}
.rs-article-preview__body h2 {
  margin: 0;
  padding: 16px 0;
  font-size: 30px;
  line-height: 36px;
  font-weight: 700;
  letter-spacing: -0.07px;
  color: var(--ap-text);
}
.rs-article-preview__body h3 {
  margin: 0;
  padding: 40px 0 16px;
  font-size: 24px;
  line-height: 30px;
  font-weight: 700;
  letter-spacing: -1px;
  color: var(--ap-text);
}
.rs-article-preview__body h4,
.rs-article-preview__body h5,
.rs-article-preview__body h6 {
  margin: 24px 0 12px;
  font-size: 20px;
  line-height: 28px;
  font-weight: 700;
  color: var(--ap-text);
}
.rs-article-preview__body p {
  margin: 0 0 24px;
  font-size: 18px;
  line-height: 26px;
  letter-spacing: -0.5px;
  color: var(--ap-muted);
}
.rs-article-preview__body a {
  color: var(--ap-brand);
  text-decoration: underline;
  text-underline-offset: 2px;
}
.rs-article-preview__body strong,
.rs-article-preview__body b { color: var(--ap-text); font-weight: 700; }
.rs-article-preview__body em,
.rs-article-preview__body i { font-style: italic; }
.rs-article-preview__body ul,
.rs-article-preview__body ol {
  margin: 0 0 24px;
  padding-left: 27px;
  color: var(--ap-muted);
}
.rs-article-preview__body li {
  margin: 0 0 8px;
  font-size: 18px;
  line-height: 26px;
  letter-spacing: -0.5px;
}
.rs-article-preview__body blockquote {
  margin: 8px 0 24px;
  padding: 8px 0 8px 24px;
  border-left: 4px solid var(--ap-brand);
  font-size: 20px;
  line-height: 28px;
  font-weight: 500;
  letter-spacing: -1px;
  color: var(--ap-text);
}
.rs-article-preview__body blockquote p {
  margin: 0;
  font-size: inherit;
  line-height: inherit;
  font-weight: inherit;
  letter-spacing: inherit;
  color: inherit;
}
.rs-article-preview__body img {
  max-width: 100%;
  height: auto;
  border-radius: 16px;
  display: block;
  margin: 24px 0 8px;
}
.rs-article-preview__body figure {
  margin: 24px 0;
}
.rs-article-preview__body figcaption,
.rs-article-preview__body .caption {
  display: flex;
  align-items: center;
  gap: 4px;
  margin: 0;
  padding-top: 4px;
  font-size: 14px;
  line-height: 20px;
  letter-spacing: -0.4px;
  color: var(--ap-muted);
}
.rs-article-preview__body figcaption::before,
.rs-article-preview__body .caption::before {
  content: '';
  flex-shrink: 0;
  width: 16px;
  height: 16px;
  background: currentColor;
  opacity: 0.7;
  /* Phosphor Info (bold) as mask — Figma caption info icon */
  -webkit-mask: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 256 256' fill='black'%3E%3Cpath d='M128,24A104,104,0,1,0,232,128,104.11,104.11,0,0,0,128,24Zm0,192a88,88,0,1,1,88-88A88.1,88.1,0,0,1,128,216Zm16-40a8,8,0,0,1-8,8,16,16,0,0,1-16-16V128a8,8,0,0,1,0-16,16,16,0,0,1,16,16v40A8,8,0,0,1,144,176ZM112,84a12,12,0,1,1,12,12A12,12,0,0,1,112,84Z'/%3E%3C/svg%3E") center / contain no-repeat;
  mask: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 256 256' fill='black'%3E%3Cpath d='M128,24A104,104,0,1,0,232,128,104.11,104.11,0,0,0,128,24Zm0,192a88,88,0,1,1,88-88A88.1,88.1,0,0,1,128,216Zm16-40a8,8,0,0,1-8,8,16,16,0,0,1-16-16V128a8,8,0,0,1,0-16,16,16,0,0,1,16,16v40A8,8,0,0,1,144,176ZM112,84a12,12,0,1,1,12,12A12,12,0,0,1,112,84Z'/%3E%3C/svg%3E") center / contain no-repeat;
}
.rs-article-preview__body hr {
  border: none;
  border-top: 1px solid var(--ap-border);
  margin: 32px 0;
}
.rs-article-preview__body pre,
.rs-article-preview__body code {
  font-family: var(--font-family-mono, ui-monospace, monospace);
  font-size: 15px;
}
.rs-article-preview__body pre {
  background: #f5f5f5;
  border: 1px solid var(--ap-border);
  border-radius: 12px;
  padding: 16px;
  overflow-x: auto;
  margin: 0 0 24px;
}
.rs-article-preview__body table {
  width: 100%;
  border-collapse: collapse;
  margin: 0 0 24px;
  font-size: 16px;
}
.rs-article-preview__body th,
.rs-article-preview__body td {
  border: 1px solid var(--ap-border);
  padding: 10px 12px;
  text-align: left;
}
.rs-article-preview__footer {
  margin-top: 24px;
  padding-top: 24px;
  border-top: 1px solid var(--ap-border);
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  flex-wrap: wrap;
}
.rs-article-preview__author {
  display: flex;
  align-items: center;
  gap: 12px;
}
.rs-article-preview__avatar {
  width: 40px;
  height: 40px;
  border-radius: 9999px;
  background: #FFF0EB;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}
.rs-article-preview__author-name {
  margin: 0;
  font-size: 16px;
  line-height: 24px;
  font-weight: 600;
  letter-spacing: -0.25px;
  color: var(--ap-text);
}
.rs-article-preview__author-role {
  margin: 0;
  font-size: 16px;
  line-height: 24px;
  letter-spacing: -0.25px;
  color: var(--ap-muted);
}
.rs-article-preview__social {
  display: flex;
  align-items: center;
  gap: 8px;
  color: var(--ap-muted);
}
@media (max-width: 640px) {
  .rs-article-preview__inner { padding: 48px 20px; }
  .rs-article-preview__title { font-size: 30px; line-height: 36px; padding-top: 24px; }
  .rs-article-preview__body h1 { font-size: 30px; line-height: 36px; }
  .rs-article-preview__body h2 { font-size: 24px; line-height: 30px; }
}
`;

export type ArticleBlogPreviewProps = {
  title: string;
  html: string;
  featuredImageUrl?: string | null;
  featuredImageAlt?: string;
  authorName?: string;
  authorRole?: string;
};

/** Readonly blog article surface — Koala content section 1:1 (Figma 3105:65402 / 4608:18835). */
export default function ArticleBlogPreview({
  title,
  html,
  featuredImageUrl,
  featuredImageAlt,
  authorName = 'Ranksmile',
  authorRole = 'Content preview',
}: ArticleBlogPreviewProps) {
  return (
    <div className="rs-article-preview">
      <style>{ARTICLE_PREVIEW_CSS}</style>
      <article className="rs-article-preview__inner">
        <h1 className="rs-article-preview__title">{title || 'Untitled'}</h1>
        {featuredImageUrl ? (
          <div className="rs-article-preview__hero">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={featuredImageUrl} alt={featuredImageAlt || title || ''} />
          </div>
        ) : null}
        <div
          className="rs-article-preview__body"
          dangerouslySetInnerHTML={{ __html: html || '<p>No content yet.</p>' }}
        />
        <footer className="rs-article-preview__footer">
          <div className="rs-article-preview__author">
            <div className="rs-article-preview__avatar" aria-hidden>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                <circle cx="12" cy="12" r="10" fill="#50B9FF" />
                <circle cx="9" cy="10.5" r="1.4" fill="#00558E" />
                <circle cx="15" cy="10.5" r="1.4" fill="#00558E" />
                <path d="M8.5 14.5c1.6 2 5.4 2 7 0" stroke="#057BC9" strokeWidth="1.6" strokeLinecap="round" />
              </svg>
            </div>
            <div>
              <p className="rs-article-preview__author-name">{authorName}</p>
              <p className="rs-article-preview__author-role">{authorRole}</p>
            </div>
          </div>
          <div className="rs-article-preview__social" aria-hidden>
            <Icon name="LinkedinLogo" size={20} color="currentColor" />
            <Icon name="XLogo" size={20} color="currentColor" />
            <Icon name="FacebookLogo" size={20} color="currentColor" />
            <Icon name="DribbbleLogo" size={20} color="currentColor" />
          </div>
        </footer>
      </article>
    </div>
  );
}
