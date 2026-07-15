import React, { useMemo } from 'react';
import { Button, CompactSelect, Switch } from '../../../core';
import type { SelectOption } from '../../../core';
import { AI_REPLY_LANGUAGES, AI_REPLY_TONES } from '../../../../lib/local/onboardingConfig';
import type { AiRepliesSettings } from '../../../../lib/local/types';
import LocalOnboardingShell from './LocalOnboardingShell';
import { IconMagicWand, IconThumbDown, IconThumbUp } from '../../icons';

type AiRepliesStepProps = {
  settings: AiRepliesSettings;
  onChange: (settings: AiRepliesSettings) => void;
  onContinue: () => void;
  onSkip: () => void;
};

function InlineToneSelect({
  value,
  options,
  onChange,
}: {
  value: string;
  options: SelectOption<string>[];
  onChange: (next: string) => void;
}) {
  const selectedLabel = options.find((opt) => opt.value === value)?.label ?? value;

  return (
    <span className="local-onboarding-inline-compact-select">
      <CompactSelect
        size="xs"
        value={value}
        options={options}
        onChange={(opt) => onChange(String(opt.value))}
        menuMinWidth={160}
        trigger={(props, isOpen) => (
          <button
            {...props}
            type="button"
            className={`local-onboarding-inline-select-trigger${isOpen ? ' local-onboarding-inline-select-trigger--open' : ''}`}
          >
            {selectedLabel}
          </button>
        )}
      />
    </span>
  );
}

export default function AiRepliesStep({
  settings,
  onChange,
  onContinue,
  onSkip,
}: AiRepliesStepProps) {
  const patch = (partial: Partial<AiRepliesSettings>) => onChange({ ...settings, ...partial });

  const hasAnyEnabled = settings.positiveEnabled || settings.negativeEnabled;

  const languageOptions = useMemo<SelectOption<string>[]>(
    () => AI_REPLY_LANGUAGES.map((lang) => ({ value: lang, label: lang })),
    [],
  );

  const toneOptions = useMemo<SelectOption<string>[]>(
    () => AI_REPLY_TONES.map((tone) => ({ value: tone, label: tone })),
    [],
  );

  return (
    <LocalOnboardingShell step="ai-replies">
      <h1 className="local-onboarding-title">AI Replies</h1>
      <p className="local-onboarding-subtitle local-onboarding-subtitle--wide">
        Start ranking higher and let AI handle replying to customer reviews automatically,
        saving you hours of work time.
      </p>

      <div className="local-onboarding-ai-form">
        <div className="local-onboarding-switch-row">
          <Switch
            size="lg"
            checked={settings.positiveEnabled}
            onChange={(checked) => patch({ positiveEnabled: checked, skipped: false })}
          />
          <div className="local-onboarding-switch-copy">
            <h2>
              Auto-reply to positive reviews
              <span className="local-onboarding-switch-hint">(recommended)</span>
            </h2>
            <span>4-5 stars</span>
          </div>
          <span className="local-onboarding-switch-icon"><IconThumbUp /></span>
        </div>

        <div className="local-onboarding-switch-row">
          <Switch
            size="lg"
            checked={settings.negativeEnabled}
            onChange={(checked) => patch({ negativeEnabled: checked, skipped: false })}
          />
          <div className="local-onboarding-switch-copy">
            <h2>Auto-reply to negative reviews</h2>
            <span>1-3 stars</span>
          </div>
          <span className="local-onboarding-switch-icon"><IconThumbDown /></span>
        </div>

        <p className="local-onboarding-tone-line">
          <span>Reply in</span>
          <InlineToneSelect
            value={settings.language}
            options={languageOptions}
            onChange={(language) => patch({ language })}
          />
          <span>with a</span>
          <InlineToneSelect
            value={settings.tone}
            options={toneOptions}
            onChange={(tone) => patch({ tone })}
          />
          <span>tone of voice</span>
        </p>

        <Button
          type="button"
          size="md"
          variant="primary"
          onClick={onContinue}
          disabled={!hasAnyEnabled}
          style={{ width: '100%', marginTop: 8 }}
        >
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
            <IconMagicWand />
            Continue
          </span>
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
