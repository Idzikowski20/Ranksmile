import React, { useCallback, useState } from 'react';
import { Button } from '../../../core';
import LocalOnboardingShell from './LocalOnboardingShell';
import { IconRobot } from '../../icons';

const MAX_KEYWORDS = 3;

type MapRankTrackerStepProps = {
  businessName: string;
  keywords: string[];
  suggestions: string[];
  onChangeKeywords: (keywords: string[]) => void;
  onCreateCampaign: () => void;
  onSkip: () => void;
  onBack: () => void;
};

const COMPETITORS = [
  { rank: '2.6', name: 'Your competitor #1' },
  { rank: '5.8', name: 'AODC Sp. z o.o.', isUser: true },
  { rank: '7.2', name: 'Your competitor #2' },
  { rank: '9.4', name: 'Your competitor #3' },
  { rank: '11.8', name: 'Your competitor #4' },
];

export default function MapRankTrackerStep({
  businessName,
  keywords,
  suggestions,
  onChangeKeywords,
  onCreateCampaign,
  onSkip,
  onBack,
}: MapRankTrackerStepProps) {
  const [input, setInput] = useState('');

  const addKeyword = useCallback((value: string) => {
    const trimmed = value.trim();
    if (!trimmed || keywords.length >= MAX_KEYWORDS) return;
    if (keywords.some((k) => k.toLowerCase() === trimmed.toLowerCase())) return;
    onChangeKeywords([...keywords, trimmed]);
    setInput('');
  }, [keywords, onChangeKeywords]);

  const removeKeyword = (value: string) => {
    onChangeKeywords(keywords.filter((k) => k !== value));
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      addKeyword(input);
    }
    if (e.key === 'Backspace' && !input && keywords.length > 0) {
      removeKeyword(keywords[keywords.length - 1]);
    }
  };

  const displayCompetitors = COMPETITORS.map((c) =>
    c.isUser ? { ...c, name: businessName } : c,
  );

  return (
    <LocalOnboardingShell step="map-rank-tracker" showBack onBack={onBack}>
      <h1 className="local-onboarding-title">Map Rank Tracker</h1>

      <div className="local-onboarding-mrt-preview">
        <div className="local-onboarding-mrt-list-wrap">
          <div className="local-onboarding-mrt-list">
            {displayCompetitors.map((item, idx) => (
              <React.Fragment key={item.name}>
                {idx > 0 && <div className="local-onboarding-mrt-divider" />}
                <div className={`local-onboarding-mrt-row${item.isUser ? ' local-onboarding-mrt-row--user' : ''}`}>
                  <span className="local-onboarding-mrt-rank">{item.rank}</span>
                  <span className="local-onboarding-mrt-name">{item.name}</span>
                  {item.isUser && <span className="local-onboarding-mrt-you">You</span>}
                </div>
              </React.Fragment>
            ))}
          </div>
        </div>
        <div className="local-onboarding-mrt-map">
          <img src="/images/local-mini-map.webp" alt="" loading="lazy" decoding="async" />
        </div>
      </div>

      <p className="local-onboarding-subtitle local-onboarding-subtitle--mrt">
        Add your business-related keywords to track positions on Google Maps and monitor competitors.
      </p>

      <div className="local-onboarding-mrt-form">
        <label className="local-onboarding-mrt-label" htmlFor="mrt-keyword-input">
          Enter up to 3 keywords
        </label>

        <div className="local-onboarding-tag-input">
          {keywords.map((kw) => (
            <span key={kw} className="local-onboarding-tag">
              {kw}
              <button type="button" aria-label={`Remove ${kw}`} onClick={() => removeKeyword(kw)}>
                <svg width="14" height="14" viewBox="0 0 16 16" aria-hidden="true">
                  <path
                    d="M3.758 3.758a1 1 0 0 0 0 1.414L6.586 8l-2.828 2.828a1 1 0 1 0 1.414 1.414L8 9.414l2.828 2.828a1 1 0 1 0 1.414-1.414L9.414 8l2.828-2.828a1 1 0 1 0-1.414-1.414L8 6.586 5.172 3.758a1 1 0 0 0-1.414 0Z"
                    fill="currentColor"
                  />
                </svg>
              </button>
            </span>
          ))}
          {keywords.length < MAX_KEYWORDS && (
            <input
              id="mrt-keyword-input"
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              onBlur={() => input && addKeyword(input)}
              placeholder={keywords.length === 0 ? 'Type a keyword…' : ''}
            />
          )}
        </div>

        <div className="local-onboarding-suggestions">
          <span className="local-onboarding-suggestions-label">
            <IconRobot />
            AI suggestions
          </span>
          <div className="local-onboarding-suggestions-pills">
            {suggestions.map((s) => {
              const selected = keywords.includes(s);
              const disabled = !selected && keywords.length >= MAX_KEYWORDS;
              return (
                <button
                  key={s}
                  type="button"
                  className={`local-onboarding-suggestion-pill${selected ? ' local-onboarding-suggestion-pill--selected' : ''}`}
                  disabled={disabled}
                  onClick={() => (selected ? removeKeyword(s) : addKeyword(s))}
                >
                  {s}
                  <span aria-hidden="true">{selected ? '×' : '+'}</span>
                </button>
              );
            })}
          </div>
        </div>

        <Button
          type="button"
          size="md"
          variant="primary"
          onClick={onCreateCampaign}
          disabled={keywords.length === 0}
          style={{ width: '100%', marginTop: 32 }}
        >
          Create campaign
        </Button>

        <div className="local-onboarding-actions">
          <Button type="button" size="md" variant="transparent" onClick={onSkip}>
            Skip
          </Button>
        </div>
      </div>
    </LocalOnboardingShell>
  );
}
