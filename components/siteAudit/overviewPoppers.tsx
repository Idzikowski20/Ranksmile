import React from 'react';
import InfoPopper, { PopperHeading, PopperLink, PopperList, PopperParagraph } from './InfoPopper';
import { BotRow, EXTENDED_BOTS } from './aiSearchBots';

export type OverviewPopperKind =
  | 'how-it-works'
  | 'unblock'
  | 'show-more'
  | 'info-site-health'
  | 'info-crawled-pages'
  | 'info-ai-search-health'
  | 'info-blocked-ai-search'
  | 'info-errors'
  | 'info-warnings'
  | 'info-robots-txt';

type Props = {
  kind: OverviewPopperKind;
  anchorRect: DOMRect;
  onClose: () => void;
};

/** Renders the InfoPopper body for a given overview popper kind. */
export function OverviewInfoPopperContent({ kind }: { kind: OverviewPopperKind }) {
  switch (kind) {
    case 'info-site-health':
      return (
        <>
          <PopperHeading>Site Health</PopperHeading>
          <PopperParagraph>
            The Site Health score is based on the number of errors and warnings found on your site, and their uniqueness. The higher the score, the fewer problems your site has, the better it is optimized for search engines, and the more user-friendly it is.
          </PopperParagraph>
          <PopperParagraph>
            The average industry score is based on the score of each website associated with the selected industry. This list of sites is based on Traffic Analytics data. For more information about the Site Health score, see{' '}
            <PopperLink href="https://www.semrush.com/kb/114-total-score">this article</PopperLink>.
          </PopperParagraph>
        </>
      );
    case 'info-crawled-pages':
      return (
        <PopperParagraph>
          Here you can view the total number of pages crawled by SiteAuditBot. The bar chart shows the distribution of pages by their status.
        </PopperParagraph>
      );
    case 'info-ai-search-health':
      return (
        <PopperParagraph>
          AI Search Health is based on AI search checks and whether AI search bots are blocked. The score is in beta and will be refined as we gather more information on AI search.
        </PopperParagraph>
      );
    case 'info-blocked-ai-search':
      return (
        <PopperParagraph>
          Pages blocked from AI search bots prevent your content from appearing in AI-generated responses and search results, which negatively affects your AI Search Health and potential visibility.
        </PopperParagraph>
      );
    case 'info-errors':
      return (
        <>
          <PopperParagraph>
            The number of issues of the highest severity detected on your website during the last audit. You can also see the difference in the number of errors found during your previous and last audits.
          </PopperParagraph>
          <PopperParagraph>
            The trend graph below shows how your website&apos;s health has improved over the last seven audits.
          </PopperParagraph>
        </>
      );
    case 'info-warnings':
      return (
        <>
          <PopperParagraph>
            The number of issues of medium severity detected on your website during the last audit. You can also see the difference in the number of warnings found during your previous and last audits.
          </PopperParagraph>
          <PopperParagraph>
            The trend graph below shows how your website&apos;s health has improved over the last seven audits.
          </PopperParagraph>
        </>
      );
    case 'info-robots-txt':
      return (
        <>
          <PopperParagraph>
            Here you can see if SiteAuditBot was able to access your robots.txt file and the number of changes made to this file (if any) since the previous crawl.
          </PopperParagraph>
          <PopperParagraph>
            Even a minor change to this file may negatively affect your website&apos;s indexability. Unplanned and ill-considered updates may dramatically damage your website&apos;s rankings.
          </PopperParagraph>
          <PopperParagraph>
            robots.txt file is used to instruct search engines what content on your website they should crawl. The Site Audit tool searches for any changes in the robots.txt rules for the main subdomain that is specified in your crawler settings. Please note that each subdomain can have its own robots.txt.
          </PopperParagraph>
        </>
      );
    case 'how-it-works':
      return (
        <>
          <PopperHeading>Improve your score:</PopperHeading>
          <PopperList items={[
            'Review and fix AI search issues',
            'Check your robots.txt file for blocked AI search bots',
          ]}
          />
          <PopperParagraph>
            A higher score means your content is more accessible, better structured, and more likely to be shown in AI search engines.
          </PopperParagraph>
          <PopperHeading>How does it work with Site Health?</PopperHeading>
          <PopperParagraph>
            Maintaining Site Health is crucial for AI search engines, but AI SEO requires some additional strategies, including enhanced use of structured data, internal linking, and additional files.
          </PopperParagraph>
        </>
      );
    case 'unblock':
      return (
        <>
          <PopperHeading>Review your robots.txt file:</PopperHeading>
          <PopperList items={[
            'Check for the lines mentioning user agents and User-agent: * rules',
            'Change the disallow rules to allow AI search bots to access your website',
          ]}
          />
        </>
      );
    case 'show-more':
      return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {EXTENDED_BOTS.map((bot) => (
            <BotRow key={bot.id} bot={bot} />
          ))}
        </div>
      );
    default: {
      const _exhaustive: never = kind;
      return _exhaustive;
    }
  }
}

const POPPER_WIDTH: Record<OverviewPopperKind, number> = {
  'info-site-health': 320,
  'info-crawled-pages': 300,
  'info-ai-search-health': 300,
  'info-blocked-ai-search': 320,
  'info-errors': 320,
  'info-warnings': 320,
  'info-robots-txt': 340,
  'how-it-works': 320,
  unblock: 300,
  'show-more': 260,
};

/** Full InfoPopper for a Site Audit overview tooltip. */
export default function OverviewInfoPopper({ kind, anchorRect, onClose }: Props) {
  return (
    <InfoPopper
      anchorRect={anchorRect}
      onClose={onClose}
      width={POPPER_WIDTH[kind]}
      align={kind === 'unblock' ? 'right' : undefined}
    >
      <OverviewInfoPopperContent kind={kind} />
    </InfoPopper>
  );
}
