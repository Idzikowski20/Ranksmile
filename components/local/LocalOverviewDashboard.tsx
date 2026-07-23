import Link from 'next/link';
import { useRouter } from 'next/router';
import React, { useEffect, useMemo, useState } from 'react';
import { Button } from '../core';
import { calculateProfileCompletion, getProfileCompletionChecklist } from '../../lib/local/dashboardCompletion';
import { resolveMrtStatus } from '../../lib/local/localSetupJobs';
import type { AiRepliesSettings, BusinessDetails, GrowthActionLogEntry, LocalSetupJobs } from '../../lib/local/types';
import type { GrowthTaskId } from '../../lib/local/growthActions';
import GrowthActionsPanel from './dashboard/GrowthActionsPanel';
import {
  IconArrowRight,
  IconBook,
  IconChat,
  IconCheck,
  IconChevronRight,
  IconEdit,
  IconExport,
  IconKebab,
  IconPhone,
  IconPicture,
  IconPin,
  IconPlus,
  IconShare,
  LocalProBadge,
} from './icons';

const FONT = 'var(--font-family-primary)';

const LOCAL_TOOLS = [
  { title: 'GBP Optimization', lines: ['GBP', 'Optimization'], href: 'gbp-optimization', image: '/images/local-tool-gbp.webp' },
  { title: 'Listing Management', lines: ['Listing', 'Management'], href: 'listing-management', image: '/images/local-tool-lm.webp' },
  { title: 'Review Management', lines: ['Review', 'Management'], href: 'review-management', image: '/images/local-tool-rm.webp' },
  { title: 'Map Rank Tracker', lines: ['Map Rank', 'Tracker'], href: 'map-rank-tracker', image: '/images/local-tool-mrt.webp' },
] as const;

type LocalOverviewDashboardProps = {
  slug: string;
  details: BusinessDetails;
  jobs?: LocalSetupJobs | null;
  aiReplies: AiRepliesSettings;
  mapRankKeywords: string[];
  hasUserRole: boolean;
  onAddLocation: () => void;
  onJobsChange?: (jobs: LocalSetupJobs) => void;
  onDetailsChange: (details: BusinessDetails) => void;
  locationCreatedAt: string | null;
  growthActionsDay: string | null;
  growthActionsCompletedIds: GrowthTaskId[];
  growthActionsLog: GrowthActionLogEntry[];
  onGrowthProgressChange: (patch: {
    growthActionsDay: string;
    growthActionsCompletedIds: GrowthTaskId[];
    growthActionsLog: GrowthActionLogEntry[];
  }) => void;
};

export default function LocalOverviewDashboard({
  slug,
  details,
  jobs,
  aiReplies,
  mapRankKeywords,
  hasUserRole,
  onAddLocation,
  onJobsChange,
  onDetailsChange,
  locationCreatedAt,
  growthActionsDay,
  growthActionsCompletedIds,
  growthActionsLog,
  onGrowthProgressChange,
}: LocalOverviewDashboardProps) {
  const router = useRouter();
  const [agentPromoHidden, setAgentPromoHidden] = useState(false);
  const [completionBoardOpen, setCompletionBoardOpen] = useState(false);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (!jobs || jobs.mrtStatus !== 'running') return undefined;
    const interval = window.setInterval(() => setTick((t) => t + 1), 2000);
    return () => window.clearInterval(interval);
  }, [jobs]);

  const resolvedJobs = useMemo(
    () => (jobs ? resolveMrtStatus(jobs) : null),
    [jobs, tick],
  );

  useEffect(() => {
    if (resolvedJobs && jobs && resolvedJobs.mrtStatus !== jobs.mrtStatus && onJobsChange) {
      onJobsChange(resolvedJobs);
    }
  }, [resolvedJobs, jobs, onJobsChange]);

  const completion = calculateProfileCompletion({
    details,
    aiReplies,
    mapRankKeywords,
    hasUserRole,
  });

  const completionChecklist = useMemo(
    () => getProfileCompletionChecklist({ details, aiReplies, mapRankKeywords, hasUserRole }),
    [details, aiReplies, mapRankKeywords, hasUserRole],
  );

  const gbpAgentHref = `/sites/${slug}/local/gbp-ai-agent`;

  return (
    <div className="local-dashboard" style={{ fontFamily: FONT }}>
      <header className="local-dashboard-header">
        <div className="local-dashboard-header-top">
          <nav className="local-dashboard-breadcrumbs" aria-label="Breadcrumbs">
            <Link href={`/sites/${slug}/local/overview`}>Local</Link>
            <IconChevronRight size={14} color="#878490" />
            <span aria-current="page">Local Dashboard</span>
          </nav>
          <div className="local-dashboard-header-links">
            <button type="button" className="local-dashboard-link-btn">
              <IconBook size={16} color="#52525C" />
              User manual
            </button>
            <button type="button" className="local-dashboard-link-btn">
              <IconChat size={16} color="#52525C" />
              Send feedback
            </button>
          </div>
        </div>
        <div className="local-dashboard-header-main">
          <h1 className="local-dashboard-title">Local Dashboard</h1>
          <div className="local-dashboard-header-actions">
            <Button type="button" size="sm" variant="secondary">
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                <IconExport size={14} />
                Export to PDF
              </span>
            </Button>
            <Button type="button" size="sm" variant="secondary">
              Buy more
              <span className="local-dashboard-counter">1/1</span>
            </Button>
            <Button type="button" size="sm" variant="primary" onClick={onAddLocation}>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                <IconPlus size={14} />
                Add new location
              </span>
            </Button>
          </div>
        </div>
      </header>

      <div className="local-dashboard-content">
        <section className="local-dashboard-card local-dashboard-business-card">
          <div
            className={`local-dashboard-business-banner${details.coverUrl ? '' : ' local-dashboard-business-banner--empty'}`}
            aria-hidden={!details.coverUrl}
          >
            {details.coverUrl ? (
              <img src={details.coverUrl} alt="" />
            ) : (
              <span className="local-dashboard-business-banner-placeholder" />
            )}
          </div>

          <div className="local-dashboard-business-head">
            <div className="local-dashboard-business-identity">
              <div className="local-dashboard-logo" aria-hidden={!details.logoUrl}>
                {details.logoUrl ? (
                  <img src={details.logoUrl} alt="" />
                ) : (
                  <IconPicture size={18} color="#A1A1AA" />
                )}
              </div>
              <div className="local-dashboard-business-name">
                <span title={details.name}>{details.name}</span>
                <LocalProBadge />
              </div>
            </div>
            <div className="local-dashboard-business-actions">
              <Button type="button" size="sm" variant="secondary">
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                  <IconShare size={14} />
                  Share
                </span>
              </Button>
              <button type="button" className="local-dashboard-icon-btn" aria-label="More options">
                <IconKebab size={16} color="#52525C" />
              </button>
            </div>
          </div>

          <div className="local-dashboard-business-meta">
            <div className="local-dashboard-meta-col">
              <IconPin size={16} color="#A1A1AA" />
              <span>{details.address}</span>
            </div>
            {details.phone && (
              <div className="local-dashboard-meta-col">
                <IconPhone size={16} color="#A1A1AA" />
                <span>{details.phone}</span>
              </div>
            )}
          </div>

          <div className="local-dashboard-business-footer">
            <div className="local-dashboard-business-footer-left">
              <Button type="button" size="sm" variant="primary">
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                  <IconEdit size={14} />
                  Edit business info
                </span>
              </Button>
              <div
                className="local-dashboard-completion"
                tabIndex={0}
                onMouseEnter={() => setCompletionBoardOpen(true)}
                onMouseLeave={() => setCompletionBoardOpen(false)}
                onFocus={() => setCompletionBoardOpen(true)}
                onBlur={() => setCompletionBoardOpen(false)}
              >
                <div className="local-dashboard-completion-bar" role="progressbar" aria-valuenow={completion} aria-valuemin={0} aria-valuemax={100}>
                  <div className="local-dashboard-completion-value" style={{ width: `${completion}%` }} />
                </div>
                <span>{completion}% completed</span>
                {completionBoardOpen && (
                  <div className="local-dashboard-completion-board" role="tooltip">
                    <ul className="local-dashboard-completion-board-list">
                      {completionChecklist.map((item) => {
                        const isComplete = item.done === item.total;
                        return (
                          <li
                            key={item.label}
                            className={`local-dashboard-completion-board-item${isComplete ? ' local-dashboard-completion-board-item--complete' : ''}`}
                          >
                            <IconCheck size={14} color={isComplete ? '#1AB25E' : '#D4D4D8'} />
                            <span>
                              {item.label}
                              {' '}
                              {item.done}
                              /
                              {item.total}
                            </span>
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                )}
              </div>
            </div>
          </div>
        </section>

        {!agentPromoHidden && (
          <article className="local-dashboard-card local-dashboard-agent-promo">
            <div>
              <div className="local-dashboard-agent-title-row">
                <h2>GBP AI Agent</h2>
                <span className="local-dashboard-tag">Available</span>
              </div>
              <p>
                The agent can automatically create posts, update photos, and reply to customer reviews.
              </p>
            </div>
            <div className="local-dashboard-agent-actions">
              <Button type="button" size="md" variant="transparent" onClick={() => setAgentPromoHidden(true)}>
                Hide
              </Button>
              <Button
                type="button"
                size="md"
                variant="primary"
                onClick={() => { void router.push(gbpAgentHref); }}
              >
                Set up agent
              </Button>
            </div>
          </article>
        )}

        <GrowthActionsPanel
          slug={slug}
          details={details}
          onDetailsChange={onDetailsChange}
          locationCreatedAt={locationCreatedAt}
          growthActionsDay={growthActionsDay}
          growthActionsCompletedIds={growthActionsCompletedIds}
          growthActionsLog={growthActionsLog}
          onGrowthProgressChange={onGrowthProgressChange}
          mrtPending={resolvedJobs?.mrtStatus === 'running'}
        />

        <section className="local-dashboard-tools-section">
          <h2 className="local-dashboard-tools-heading">Continue with other Local tools</h2>
          <div className="local-dashboard-tools-grid">
            {LOCAL_TOOLS.map((tool) => (
              <div
                key={tool.href}
                role="link"
                tabIndex={0}
                className="local-dashboard-tool-card"
                onClick={() => { void router.push(`/sites/${slug}/local/${tool.href}`); }}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault();
                    void router.push(`/sites/${slug}/local/${tool.href}`);
                  }
                }}
              >
                <div className="local-dashboard-tool-card-inner">
                  <div className="local-dashboard-tool-card-top">
                    <span>
                      {tool.lines[0]}
                      <br />
                      {tool.lines[1]}
                    </span>
                    <IconArrowRight size={16} color="#52525C" />
                  </div>
                  <div className="local-dashboard-tool-card-image">
                    <img src={tool.image} alt="" loading="lazy" decoding="async" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="local-dashboard-bottom-cta">
          <h2>Set up all your businesses to achieve maximum visibility</h2>
          <p>
            Improve local visibility of your brand and ensure that your business data is consistent across the Web.
          </p>
          <Button type="button" size="md" variant="secondary" onClick={onAddLocation}>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
              <IconPlus size={14} />
              Add new location
            </span>
          </Button>
        </section>
      </div>
    </div>
  );
}
