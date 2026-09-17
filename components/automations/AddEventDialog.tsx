import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useQuery } from 'react-query';
import type { AutomationPublishMode } from '@/src/core/shared/types/automations';
import { normalizeKeywords, MAX_KEYWORDS_PER_SCHEDULE } from '@/src/core/domain/automations/keywords';
import {
  buildContentIdeas, dedupeGscKeywords, type ContentIdeaRec,
} from '@/src/core/domain/recommendations/contentIdeas';
import type { GscKeywordRow } from '@/utils/gsc';
import Modal, { ModalBody, ModalFooter } from '../koala/core/modal/modal';
import { Button, Input, Select, Alert, Chip } from '../koala/core';
import { Form, FormField, FormSection, FieldHint } from '../koala/forms';
import { Icon } from '../koala/icons/Icon';
import KeywordSuggestInput from '../articles/KeywordSuggestInput';
import { coveredTopicsKey, fetchCoveredTopics } from '../../services/article';

export type AddEventDialogProps = {
  open: boolean;
  onClose: () => void;
  /** Domain slug — the suggestions are its Recommendations → Content ideas. */
  slug: string;
  /** Market for keyword suggestions (ISO-2, e.g. "PL"). */
  country?: string;
  /** YYYY-MM-DD the dialog opens on (the clicked day, or today from the toolbar). */
  initialDate: string;
  wordpressConnected: boolean;
  submitting?: boolean;
  error?: string | null;
  onSubmit: (payload: {
    scheduledDate: string;
    keywords: string[];
    publishMode: AutomationPublishMode;
  }) => void;
};

const PUBLISH_OPTIONS = [
  { value: 'draft', label: 'Draft' },
  { value: 'live', label: 'Live' },
];

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function formatVolume(v: number): string {
  return v >= 1000 ? `${(v / 1000).toFixed(1)}k` : String(v);
}

/**
 * Schedule articles — only the day and the keywords are the user's to choose. Each keyword
 * becomes one article that the automations cron researches, titles and writes in the
 * background, the same way a new article is produced.
 */
export default function AddEventDialog({
  open,
  onClose,
  slug,
  country = 'US',
  initialDate,
  wordpressConnected,
  submitting = false,
  error = null,
  onSubmit,
}: AddEventDialogProps) {
  const [date, setDate] = useState(initialDate);
  const [keywords, setKeywords] = useState<string[]>([]);
  const [publishMode, setPublishMode] = useState<AutomationPublishMode>('draft');

  useEffect(() => {
    if (!open) return;
    setDate(initialDate);
    setKeywords([]);
    setPublishMode('draft');
  }, [open, initialDate]);

  // The same three sources (and cache keys) the Recommendations page builds Content ideas
  // from: scan-suggested topics, Search Console keywords, and the topics the domain already covers.
  const enabled = open && !!slug;
  const recsQ = useQuery(['domainRecs', slug], async () => {
    const r = await fetch(`/api/domains/${slug}/recommendations`);
    return r.json() as Promise<{ recommendations?: ContentIdeaRec[] }>;
  }, { enabled, staleTime: 60_000 });
  const scQ = useQuery(['sc-data', slug], async () => {
    const r = await fetch(`/api/gsc/search-data?domain=${slug}`);
    return r.json() as Promise<{ data?: { thirtyDays?: GscKeywordRow[] } }>;
  }, { enabled, staleTime: 5 * 60 * 1000 });
  const coveredQ = useQuery(coveredTopicsKey(slug), () => fetchCoveredTopics(slug), { enabled, staleTime: 60_000 });
  const allIdeas = useMemo(() => buildContentIdeas({
    recs: recsQ.data?.recommendations,
    gscKeywords: dedupeGscKeywords(scQ.data?.data?.thirtyDays || []),
    covered: coveredQ.data || [],
  }), [recsQ.data, scQ.data, coveredQ.data]);
  const ideas = useMemo(() => {
    const taken = new Set(keywords.map((k) => k.toLowerCase()));
    return allIdeas.filter((i) => !taken.has(i.keyword.toLowerCase())).slice(0, 8);
  }, [allIdeas, keywords]);
  const ideasLoading = recsQ.isLoading || scQ.isLoading || coveredQ.isLoading;

  if (!open) return null;

  const full = keywords.length >= MAX_KEYWORDS_PER_SCHEDULE;
  const addKeyword = (kw: string) => setKeywords((list) => normalizeKeywords([...list, kw]));
  const removeKeyword = (kw: string) => setKeywords((list) => list.filter((k) => k !== kw));

  // Draft events schedule without WordPress; only a live publish needs a connection.
  const liveBlocked = publishMode === 'live' && !wordpressConnected;
  const count = keywords.length;
  const canSubmit = DATE_RE.test(date) && count > 0 && !submitting && !liveBlocked;
  const articlesLabel = `${count} ${count === 1 ? 'article' : 'articles'}`;

  return (
    <Modal title="Schedule articles" onClose={onClose} width={560}>
      <ModalBody>
        <Form
          id="add-automation-event"
          onSubmit={(e) => {
            e.preventDefault();
            if (!canSubmit) return;
            onSubmit({ scheduledDate: date, keywords, publishMode });
          }}
        >
          <FormSection
            title="What to write, and when"
            description="Each keyword becomes one article. It is researched, titled and written in the background on the chosen day."
          >
            <FormField label="Publish date" required>
              <Input size="md" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </FormField>

            <FormField label="Main keywords" required>
              <KeywordSuggestInput
                keywords={keywords}
                onAdd={(kw) => { if (!full) addKeyword(kw); }}
                onRemove={removeKeyword}
                country={country}
                numbered
                placeholder="Type a keyword and press Enter"
              />
              <FieldHint>
                {count === 0
                  ? 'Add one or more keywords — 1 keyword = 1 article.'
                  : `${count} ${count === 1 ? 'keyword' : 'keywords'} = ${articlesLabel}${full ? ` (maximum ${MAX_KEYWORDS_PER_SCHEDULE})` : ''}.`}
              </FieldHint>

              {ideasLoading && !full ? (
                <div style={{ marginTop: 12, fontSize: 12, color: 'var(--koala-text-tertiary)' }}>
                  Loading content ideas…
                </div>
              ) : null}
              {!ideasLoading && ideas.length > 0 && !full ? (
                <div style={{ marginTop: 12 }}>
                  <div style={{
                    display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8,
                    fontSize: 12, fontWeight: 500, color: 'var(--koala-text-secondary)',
                  }}
                  >
                    <Icon name="Lightbulb" size={14} weight="regular" />
                    Suggested from Content ideas
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                    {ideas.map((idea) => (
                      <Chip
                        key={idea.keyword}
                        size="sm"
                        icon="Plus"
                        aria-label={`Add ${idea.keyword}`}
                        onClick={() => addKeyword(idea.keyword)}
                      >
                        {idea.keyword}
                        {idea.impressions > 0 || idea.volume != null ? (
                          <span
                            style={{ color: 'var(--koala-text-tertiary)', fontWeight: 400 }}
                            title={idea.impressions > 0 ? 'Search Console impressions (30 days)' : 'Monthly search volume'}
                          >
                            {idea.impressions > 0 ? `${formatVolume(idea.impressions)} impr.` : `${formatVolume(idea.volume ?? 0)}/mo`}
                          </span>
                        ) : null}
                      </Chip>
                    ))}
                  </div>
                </div>
              ) : null}
            </FormField>

            <FormField label="Publication option" required>
              <div style={{ width: '100%' }}>
                <Select
                  options={PUBLISH_OPTIONS}
                  value={publishMode}
                  onChange={(v) => setPublishMode(v === 'live' ? 'live' : 'draft')}
                  size="md"
                  width="100%"
                />
              </div>
              <FieldHint>
                {publishMode === 'live'
                  ? 'Publishes live to WordPress once each article is written.'
                  : 'Creates drafts you can review before publishing.'}
              </FieldHint>
            </FormField>
          </FormSection>
          {liveBlocked ? (
            <Alert variant="error" title="WordPress not connected">
              Connect WordPress to publish live, or keep these articles as drafts.{' '}
              <Link href="/settings/wordpress" style={{ color: 'inherit', fontWeight: 600, textDecoration: 'underline' }}>
                Open WordPress settings
              </Link>
            </Alert>
          ) : null}
          {error ? <Alert variant="error" title="Could not schedule">{error}</Alert> : null}
        </Form>
      </ModalBody>
      <ModalFooter>
        <Button type="button" variant="secondary" size="md" onClick={onClose} disabled={submitting}>
          Cancel
        </Button>
        <Button type="submit" form="add-automation-event" variant="primary" size="md" disabled={!canSubmit}>
          {submitting ? 'Scheduling…' : count > 0 ? `Schedule ${articlesLabel}` : 'Schedule'}
        </Button>
      </ModalFooter>
    </Modal>
  );
}
