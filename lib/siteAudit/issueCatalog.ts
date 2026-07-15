import type { IssueCategory, IssueHelpContent, IssueSeverity } from './types';

export type IssueCatalogEntry = {
  id: string;
  severity: IssueSeverity;
  categories: IssueCategory[];
  aiSearch?: boolean;
  isNew?: boolean;
  /** Semrush-style title: count phrase + suffix */
  countLabel: (count: number) => string;
  suffix: string;
  help: IssueHelpContent;
};

function pageLabel(count: number, word = 'page'): string {
  const w = count === 1 ? word : `${word}s`;
  return `${count} ${w}`;
}

function linkLabel(count: number): string {
  return count === 1 ? '1 link' : `${count} links`;
}

function urlLabel(count: number): string {
  return count === 1 ? '1 URL' : `${count} URLs`;
}

function subdomainLabel(count: number): string {
  return count === 1 ? '1 subdomain' : `${count} subdomains`;
}

const GOOGLE_SNIPPETS = {
  label: 'Create good titles and snippets in Search Results',
  href: 'https://developers.google.com/search/docs/appearance/snippet',
};

const SEMRUSH_META = {
  label: 'On-Page SEO Basics: Meta Descriptions',
  href: 'https://www.semrush.com/blog/on-page-seo-basics-meta-descriptions/',
};

export const ISSUE_CATALOG: Record<string, IssueCatalogEntry> = {
  sitemap_incorrect_pages: {
    id: 'sitemap_incorrect_pages',
    severity: 'error',
    categories: ['crawlability'],
    countLabel: (n) => pageLabel(n, 'incorrect page'),
    suffix: 'found in sitemap.xml',
    help: {
      about: [
        'A sitemap.xml file makes it easier for crawlers to discover the pages on your website. Only good pages intended for your visitors should be included in your sitemap.xml file.',
        'This error is triggered if your sitemap.xml contains URLs that:',
      ],
      bullets: [
        'lead to webpages with the same content',
        'redirect to a different webpage',
        'return non-200 status code',
      ],
      category: 'Crawlability',
      fix: [
        'Review your sitemap.xml for any redirected, non-canonical or non-200 URLs. Provide the final destination URLs that are canonical and return a 200 status code.',
      ],
    },
  },
  malformed_url_crawl: {
    id: 'malformed_url_crawl',
    severity: 'error',
    categories: ['links', 'crawlability'],
    countLabel: linkLabel,
    suffix: "couldn't be crawled (incorrect URL format)",
    help: {
      about: [
        'This issue is reported when SiteAuditBot fails to crawl a link because of an invalid link\'s URL.',
        'Common mistakes include the following:',
      ],
      bullets: [
        'Invalid URL syntax (e.g., no or an invalid protocol is specified, backslashes are used)',
        'Spelling mistakes',
        'Unnecessary additional characters',
      ],
      category: 'Links, Crawlability',
      fix: [
        'Make sure the link\'s URL conforms to a standard scheme and doesn\'t have any unnecessary characters or typos.',
      ],
    },
  },
  low_text_ratio: {
    id: 'low_text_ratio',
    severity: 'warning',
    categories: ['content', 'indexability'],
    countLabel: pageLabel,
    suffix: 'have low text-HTML ratio',
    help: {
      about: [
        'Your text to HTML ratio indicates the amount of actual text you have on your webpage compared to the amount of code. This issue is triggered when your text to HTML is 10% or less.',
        'Search engines have begun focusing on pages that contain more content. That\'s why a higher text-to-HTML ratio means your page has a better chance of getting a good position in search results.',
        'Less code increases your page\'s load speed and also helps your rankings. It also helps search engine robots crawl your website faster.',
      ],
      category: 'Indexability, Content',
      fix: [
        'Split your webpage\'s text content and code into separate files and compare their size. If the size of your code file exceeds the size of the text file, review your page\'s HTML code and consider optimizing its structure and removing embedded scripts and styles.',
      ],
    },
  },
  title_too_long: {
    id: 'title_too_long',
    severity: 'warning',
    categories: ['meta_tags', 'indexability'],
    countLabel: pageLabel,
    suffix: 'have too much text within the title tags',
    help: {
      about: [
        'Most search engines truncate titles containing more than 70 characters. Incomplete and shortened titles look unappealing to users and won\'t entice them to click on your page.',
      ],
      articleLinks: [GOOGLE_SNIPPETS],
      category: 'Meta tags, Indexability',
      fix: ['Try to rewrite your page titles to be 70 characters or less.'],
    },
  },
  missing_meta_description: {
    id: 'missing_meta_description',
    severity: 'warning',
    categories: ['meta_tags', 'indexability'],
    countLabel: pageLabel,
    suffix: "don't have meta descriptions",
    help: {
      about: [
        'Though meta descriptions don\'t have a direct influence on rankings, they are used by search engines to display your page\'s description in search results. A good description helps users know what your page is about and encourages them to click on it.',
        'If your page\'s meta description tag is missing, search engines will usually display its first sentence, which may be irrelevant and unappealing to users.',
      ],
      articleLinks: [GOOGLE_SNIPPETS, SEMRUSH_META],
      category: 'Meta tags, Indexability',
      fix: [
        'In order to gain a higher click-through rate, you should ensure that all of your webpages have meta descriptions that contain relevant keywords.',
      ],
    },
  },
  duplicate_h1_title: {
    id: 'duplicate_h1_title',
    severity: 'warning',
    categories: ['meta_tags', 'content'],
    countLabel: pageLabel,
    suffix: 'have duplicate H1 and title tags',
    help: {
      about: [
        'It is a bad idea to duplicate your title tag content in your first-level header. If your page\'s <title> and <h1> tags match, the latter may appear over-optimized to search engines.',
        'Also, using the same content in titles and headers means a lost opportunity to incorporate other relevant keywords for your page.',
      ],
      articleLinks: [GOOGLE_SNIPPETS],
      category: 'Meta tags, Content',
      fix: ['Try to create different content for your <title> and <h1> tags.'],
    },
  },
  missing_h1: {
    id: 'missing_h1',
    severity: 'warning',
    categories: ['meta_tags', 'content'],
    countLabel: pageLabel,
    suffix: "don't have an h1 heading",
    help: {
      about: [
        'While less important than <title> tags, h1 headings still help define your page\'s topic for search engines and users. If an <h1> tag is empty or missing, search engines may place your page lower than they would otherwise.',
        'Besides, a lack of an <h1> tag breaks your page\'s heading hierarchy, which is not SEO-friendly.',
      ],
      category: 'Meta tags, Content',
      fix: ['Provide a concise, relevant h1 heading for each of your pages.'],
    },
  },
  permanent_redirect: {
    id: 'permanent_redirect',
    severity: 'notice',
    categories: ['crawlability', 'links'],
    countLabel: urlLabel,
    suffix: 'with a permanent redirect',
    help: {
      about: [
        'Although using permanent redirects (a 301 or 308 redirect) is appropriate in many situations (for example, when you move a website to a new domain, redirect users from a deleted page to a new one, or handle duplicate content issues), we recommend that you keep them to a reasonable minimum.',
        'Every time you redirect one of your website\'s pages, it decreases your crawl budget, which may run out before search engines can crawl the page you want to be indexed. Moreover, too many permanent redirects can be confusing to users.',
      ],
      category: 'Crawlability, Links',
      fix: [
        'Review all URLs with a permanent redirect. Change permanent redirects to a target page URL where possible.',
      ],
    },
  },
  external_nofollow: {
    id: 'external_nofollow',
    severity: 'notice',
    categories: ['links'],
    countLabel: (n) => (n === 1 ? '1 outgoing external link' : `${n} outgoing external links`),
    suffix: 'contain nofollow attributes',
    help: {
      about: [
        'A nofollow attribute is an element in an <a> tag that tells crawlers not to follow the link. "Nofollow" links don\'t pass any link juice or anchor texts to referred webpages.',
        'The unintentional use of nofollow attributes may have a negative impact on the crawling process and your rankings.',
      ],
      category: 'Links',
      fix: [
        'Make sure you haven\'t used nofollow attributes by mistake. Remove them from <a> tags, if needed.',
      ],
    },
  },
  no_anchor_text: {
    id: 'no_anchor_text',
    severity: 'notice',
    categories: ['links'],
    countLabel: linkLabel,
    suffix: 'have no anchor text',
    help: {
      about: [
        'This issue is triggered if a link (either external or internal) on your website has an empty or naked anchor (i.e., anchor that uses a raw URL), or anchor text only contains symbols.',
        'Although a missing anchor doesn\'t prevent users and crawlers from following a link, it makes it difficult to understand what the page you\'re linking to is about. Also, Google considers anchor text when indexing a page.',
      ],
      articleLinks: [{
        label: 'Write good link text (Google SEO Starter Guide)',
        href: 'https://developers.google.com/search/docs/fundamentals/seo-starter-guide#use-links-wisely',
      }],
      category: 'Links',
      fix: [
        'Use anchor text for your links where it is necessary. The link text must give users and search engines at least a basic idea of what the target page is about. Also, use short but descriptive text.',
      ],
    },
  },
  single_incoming_internal_link: {
    id: 'single_incoming_internal_link',
    severity: 'notice',
    categories: ['links', 'crawlability'],
    countLabel: pageLabel,
    suffix: 'have only one incoming internal link',
    help: {
      about: [
        'Having very few incoming internal links means very few visits, or even none, and fewer chances of placing in search results.',
        'It is a good practice to add more incoming internal links to pages with useful content. That way, you can rest assured that users and search engines will never miss them.',
      ],
      category: 'Links, Crawlability',
      fix: ['Add more incoming internal links to pages with important content.'],
    },
  },
  content_not_optimized: {
    id: 'content_not_optimized',
    severity: 'notice',
    categories: ['ai_search', 'content'],
    aiSearch: true,
    isNew: true,
    countLabel: pageLabel,
    suffix: 'require content optimization',
    help: {
      about: [
        'Content optimization enhances on-page clarity, improves user engagement, snippet eligibility, and topical authority. It\'s especially important for pages with a lot of content.',
      ],
      badge: 'AI Search',
      badgeExtra: [
        'Well-optimized content ensures structuring and efficient token usage that AI search engines can summarize more reliably.',
        'This check detects poor heading hierarchy, paragraphs that are too long, and low readability.',
      ],
      category: 'AI Search, Content',
      fix: [
        'Follow the advice provided in the error details for each page.',
        'Improve your content with AI using the Content Optimizer tool.',
      ],
      fixBullets: true,
      showOptimizeAi: true,
    },
  },
  multiple_h1: {
    id: 'multiple_h1',
    severity: 'notice',
    categories: ['meta_tags', 'content'],
    countLabel: pageLabel,
    suffix: 'have more than one H1 tag',
    help: {
      about: [
        'Although multiple <h1> tags are allowed in HTML5, we still do not recommend that you use more than one <h1> tag per page. Including multiple <h1> tags may confuse users.',
      ],
      category: 'Meta tags, Content',
      fix: ['Use multiple <h2>–<h6> tags instead of an extra <h1>.'],
    },
  },
  hsts_missing: {
    id: 'hsts_missing',
    severity: 'notice',
    categories: ['crawlability'],
    countLabel: subdomainLabel,
    suffix: "don't support HSTS",
    help: {
      about: [
        'HTTP Strict Transport Security (HSTS) informs web browsers that they can communicate with servers only through HTTPS connections.',
        'So, to ensure that you don\'t serve unsecured content to your audience, we recommend that you implement HSTS support.',
      ],
      category: 'HTTPS, Crawlability',
      fix: ['Use a server that supports HSTS.'],
    },
  },
  external_link_403: {
    id: 'external_link_403',
    severity: 'notice',
    categories: ['links', 'http_status'],
    countLabel: linkLabel,
    suffix: 'to external page or resource returns a 403 HTTP status code',
    help: {
      about: [
        'This issue is triggered if a crawler gets a 403 code when trying to access an external webpage or resource via a link on your site.',
        'A 403 HTTP status code is returned if a user is not allowed to access the resource for some reason. In the case of crawlers, this usually means that a crawler is being blocked from accessing content at the server level.',
      ],
      category: 'Links, HTTP Status',
      fix: [
        'Check that the page is available to browsers and search engines. To do this, follow a link in your browser and check the Google Search Console data.',
        'If a page or resource is not available, contact the owner of the external website to restore deleted content or change the link on your page.',
        'If a page is available but our bot is blocked from accessing it, you can ask the external website owner to unblock the page.',
      ],
      fixBullets: true,
    },
  },
};

export function formatIssueTitle(entry: IssueCatalogEntry, count: number): string {
  return `${entry.countLabel(count)} ${entry.suffix}`;
}

export function formatIssueLinkText(entry: IssueCatalogEntry, count: number): string {
  return entry.countLabel(count);
}

export function getCatalogEntry(issueId: string): IssueCatalogEntry | undefined {
  return ISSUE_CATALOG[issueId];
}

export const CATEGORY_LABELS: Record<IssueCategory, string> = {
  all: 'All',
  ai_search: 'AI Search',
  crawlability: 'Crawlability',
  content: 'Content',
  meta_tags: 'Meta tags',
  links: 'Links',
  indexability: 'Indexability',
  http_status: 'HTTP Status',
};

export const VISIBLE_CATEGORIES: IssueCategory[] = [
  'ai_search',
  'crawlability',
  'content',
  'meta_tags',
];

export const EXTRA_CATEGORIES: IssueCategory[] = ['indexability', 'links', 'http_status'];

export const SEVERITY_GROUP_INFO: Record<IssueSeverity, string> = {
  error: 'Errors are the most severe issues. Fixing them should be your top priority as they may prevent pages from being indexed.',
  warning: 'Warnings are medium-severity issues that can affect rankings and user experience if left unaddressed.',
  notice: 'Notices are low-severity suggestions for improvement. They do not directly affect your Site Health score.',
};
