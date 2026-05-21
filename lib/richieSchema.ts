// ── Richie.js JSON-LD Schema Markup ──────────────────────────────
// BlogPosting / Article / FAQ / BreadcrumbList
// Used by: Python sidecar article generation + frontend preview

export interface ArticleSchemaOptions {
  title: string;
  description?: string;
  url: string;
  siteUrl: string;
  authorName?: string;
  authorUrl?: string;
  publishedAt?: string;
  modifiedAt?: string;
  imageUrl?: string;
  imageWidth?: number;
  imageHeight?: number;
  keywords?: string[];
  articleBody?: string;
}

export interface FAQItem {
  question: string;
  answer: string;
}

export interface BreadcrumbItem {
  name: string;
  url: string;
}

// ── BlogPosting schema ───────────────────────────────────────────

export function generateArticleSchema(opts: ArticleSchemaOptions): object {
  const {
    title,
    description,
    url,
    siteUrl,
    authorName = 'Editorial Team',
    authorUrl,
    publishedAt = new Date().toISOString(),
    modifiedAt = new Date().toISOString(),
    imageUrl,
    imageWidth = 1200,
    imageHeight = 630,
    keywords = [],
    articleBody,
  } = opts;

  const schema: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': 'BlogPosting',
    '@id': url,
    headline: title,
    description: description || '',
    url: url.startsWith('http') ? url : `${siteUrl.replace(/\/$/, '')}/${url.replace(/^\//, '')}`,
    datePublished: publishedAt,
    dateModified: modifiedAt,
    author: {
      '@type': 'Person',
      name: authorName,
      ...(authorUrl ? { url: authorUrl } : {}),
    },
    publisher: {
      '@type': 'Organization',
      name: new URL(siteUrl).hostname.replace(/^www\./, ''),
      url: siteUrl,
    },
    mainEntityOfPage: {
      '@type': 'WebPage',
      '@id': url,
    },
  };

  if (imageUrl) {
    schema.image = imageUrl.startsWith('http')
      ? {
          '@type': 'ImageObject',
          url: imageUrl,
          width: imageWidth,
          height: imageHeight,
        }
      : imageUrl;
  }

  if (keywords.length > 0) {
    schema.keywords = keywords.join(', ');
  }

  if (articleBody) {
    // Strip HTML tags for articleBody (Google prefers plain text)
    schema.articleBody = articleBody.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
  }

  return schema;
}

// ── FAQ schema ───────────────────────────────────────────────────

export function generateFAQSchema(items: FAQItem[], pageUrl: string): object {
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    url: pageUrl,
    mainEntity: items.map((item) => ({
      '@type': 'Question',
      name: item.question,
      acceptedAnswer: {
        '@type': 'Answer',
        text: item.answer,
      },
    })),
  };
}

// ── BreadcrumbList schema ────────────────────────────────────────

export function generateBreadcrumbSchema(items: BreadcrumbItem[]): object {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: item.name,
      item: item.url,
    })),
  };
}

// ── Schema merge helper ──────────────────────────────────────────

export function mergeSchemas(...schemas: object[]): object[] {
  return schemas.flatMap((s) => {
    if (Array.isArray(s)) return s;
    return [s];
  });
}

// ── Render schema as <script> tag ─────────────────────────────────

export function renderSchemaTag(schemaOrSchemas: object | object[]): string {
  const schemas = Array.isArray(schemaOrSchemas) ? schemaOrSchemas : [schemaOrSchemas];
  return `<script type="application/ld+json">${JSON.stringify(
    schemas.length === 1 ? schemas[0] : { '@graph': schemas },
    null,
    2,
  )}</script>`;
}
