import type { GetServerSideProps, NextApiRequest, NextApiResponse, NextPage } from 'next';
import Head from 'next/head';
import Link from 'next/link';
import React, { useEffect, useState } from 'react';
import ArticleBlogPreview from '../../../components/articles/ArticleBlogPreview';
import { Icon } from '../../../components/koala/icons';
import db from '../../../database/database';
import { ensureArticlesTables } from '../../../lib/ensureArticlesTables';
import { getArticleIdSql } from '../../../lib/articleSql';
import { queryOne } from '../../../lib/db/query';
import type { ArticleRow } from '../../../lib/db/query';
import { assertArticleAccess, ensureUserTenancy } from '../../../lib/tenancy';
import { getCurrentUser } from '../../../utils/getUser';

type PreviewArticle = {
  id: number;
  title: string;
  content: string;
  target_keyword: string;
  meta_title: string | null;
  featured_image: string | null;
};

type PreviewProps = {
  article: PreviewArticle;
};

const ArticlePreviewPage: NextPage<PreviewProps> = ({ article: initial }) => {
  const [article, setArticle] = useState(initial);

  // Re-fetch once on the client so Preview shows the latest autosave (GSSP can race flush).
  useEffect(() => {
    let cancelled = false;
    fetch(`/api/articles/${initial.id}`, { credentials: 'include' })
      .then((r) => (r.ok ? r.json() : null))
      .then((data: { article?: Partial<PreviewArticle> } | null) => {
        if (cancelled || !data?.article) return;
        const a = data.article;
        setArticle({
          id: initial.id,
          title: a.title || initial.title,
          content: typeof a.content === 'string' ? a.content : initial.content,
          target_keyword: a.target_keyword || initial.target_keyword,
          meta_title: a.meta_title ?? initial.meta_title,
          featured_image: a.featured_image ?? initial.featured_image,
        });
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [initial]);

  const title = (article.meta_title || article.title || 'Untitled').trim();
  const html = (article.content || '').trim();

  return (
    <div style={{ minHeight: '100vh', background: '#fff', overflowY: 'auto' }}>
      <Head>
        <title>{`Preview · ${title} — Ranksmile`}</title>
        <meta name="robots" content="noindex,nofollow" />
      </Head>
      <div style={{ position: 'sticky', top: 0, zIndex: 20, background: '#fff', borderBottom: '1px solid #e5e5e5' }}>
        <div
          style={{
            maxWidth: 768,
            margin: '0 auto',
            padding: '10px 32px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 12,
            fontFamily: 'var(--font-family-primary)',
            boxSizing: 'border-box',
          }}
        >
          <Link
            href={`/articles/${article.id}`}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              color: '#575757',
              fontSize: 14,
              fontWeight: 500,
              textDecoration: 'none',
            }}
          >
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
              <Icon name="ArrowLeft" size={16} />
              Back to editor
            </span>
          </Link>
          <span
            style={{
              fontSize: 12,
              fontWeight: 500,
              color: '#767676',
              padding: '4px 10px',
              borderRadius: 999,
              background: '#f5f5f5',
              border: '1px solid #e5e5e5',
            }}
          >
            Preview · read only
          </span>
        </div>
      </div>
      <ArticleBlogPreview
        title={title}
        html={html}
        featuredImageUrl={article.featured_image}
        featuredImageAlt={title}
      />
    </div>
  );
};

export const getServerSideProps: GetServerSideProps<PreviewProps> = async (ctx) => {
  const rawId = typeof ctx.params?.id === 'string' ? ctx.params.id : '';
  const articleId = parseInt(rawId, 10);
  if (!Number.isFinite(articleId)) return { notFound: true };

  try {
    const user = await getCurrentUser(
      ctx.req as unknown as NextApiRequest,
      ctx.res as unknown as NextApiResponse,
    );
    if (!user) {
      return {
        redirect: {
          destination: `/login?next=${encodeURIComponent(`/articles/${articleId}/preview`)}`,
          permanent: false,
        },
      };
    }
    await ensureUserTenancy(user.id);
    if (!(await assertArticleAccess(user.id, articleId))) {
      return { notFound: true };
    }

    await db.sync();
    await ensureArticlesTables();
    const articleIdSql = await getArticleIdSql();
    const row = await queryOne<ArticleRow>(
      `SELECT *, ${articleIdSql} AS id FROM articles WHERE ${articleIdSql} = ? LIMIT 1`,
      [articleId],
    );
    if (!row) return { notFound: true };

    return {
      props: {
        article: {
          id: Number(row.id),
          title: row.title || '',
          content: row.content || '',
          target_keyword: row.target_keyword || '',
          meta_title: row.meta_title ?? null,
          featured_image: row.featured_image ?? null,
        },
      },
    };
  } catch {
    return { notFound: true };
  }
};

export default ArticlePreviewPage;
