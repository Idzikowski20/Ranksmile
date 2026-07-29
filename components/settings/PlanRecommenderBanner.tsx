import React, { useId, useState } from 'react';
import {
  type BillingPeriod,
  formatEuro,
  getPlanCheckoutHref,
} from '../../lib/billingPlans';
import {
  AI_PROMPT_SLIDER_STEPS,
  DEFAULT_PROMPT_SLIDER_VALUE,
  type PromptSliderValue,
  type RecommendedPlanSlug,
  getPromptSliderStep,
  getRecommendedCheckoutPlan,
  getRecommenderDisplayPrice,
  getRecommenderFeatureBullets,
  getYearlySavePercent,
  promptSliderIndex,
  promptSliderValueAt,
} from '../../lib/pricing/planRecommender';
import { Button } from '../core';

const Check = ({ color = '#F29964' }: { color?: string }) => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true" style={{ flexShrink: 0 }}>
    <path
      d="M19.916 4.626a.75.75 0 0 1 .208 1.04l-9 13.5a.75.75 0 0 1-1.154.114l-6-6a.75.75 0 0 1 1.06-1.06l5.353 5.353 8.493-12.74a.75.75 0 0 1 1.04-.207"
      fill={color}
    />
  </svg>
);

const TogglePill = ({ on, onClick }: { on: boolean; onClick: () => void }) => (
  <button
    type="button"
    onClick={onClick}
    aria-pressed={on}
    style={{
      width: 32,
      height: 16,
      borderRadius: 9999,
      background: on ? '#F29964' : '#E4E4E7',
      position: 'relative',
      flexShrink: 0,
      cursor: 'pointer',
      border: 'none',
      padding: 0,
      transition: 'background 150ms ease',
    }}
  >
    <div
      style={{
        position: 'absolute',
        top: 2,
        left: on ? 18 : 2,
        width: 12,
        height: 12,
        borderRadius: 9999,
        background: '#fff',
        boxShadow: '0 1px 2px rgba(0,0,0,0.2)',
        transition: 'left 150ms ease',
      }}
    />
  </button>
);

/** Soft starfield — decorative only, no Surfer asset paste. */
const Starfield = () => (
  <svg
    aria-hidden="true"
    width="100%"
    height="100%"
    style={{ position: 'absolute', inset: 0, pointerEvents: 'none', opacity: 0.55 }}
  >
    <circle cx="8%" cy="18%" r="1.2" fill="#F29964" opacity="0.45" />
    <circle cx="22%" cy="72%" r="1" fill="#181225" opacity="0.2" />
    <circle cx="41%" cy="28%" r="1.4" fill="#F29964" opacity="0.3" />
    <circle cx="58%" cy="14%" r="1" fill="#181225" opacity="0.18" />
    <circle cx="73%" cy="62%" r="1.2" fill="#F29964" opacity="0.35" />
    <circle cx="88%" cy="34%" r="1" fill="#181225" opacity="0.22" />
    <circle cx="15%" cy="48%" r="0.8" fill="#F29964" opacity="0.25" />
    <circle cx="66%" cy="80%" r="1.1" fill="#181225" opacity="0.16" />
  </svg>
);

export interface PlanRecommenderBannerProps {
  billing: BillingPeriod;
  onBillingChange: (billing: BillingPeriod) => void;
  onRecommendChange?: (planSlug: RecommendedPlanSlug) => void;
  onSeePlan: (planSlug: RecommendedPlanSlug) => void;
  currentPlanSlug?: string | null;
}

const PlanRecommenderBanner = ({
  billing,
  onBillingChange,
  onRecommendChange,
  onSeePlan,
  currentPlanSlug = null,
}: PlanRecommenderBannerProps) => {
  const sliderId = useId();
  const [sliderValue, setSliderValue] = useState<PromptSliderValue>(DEFAULT_PROMPT_SLIDER_VALUE);

  const step = getPromptSliderStep(sliderValue);
  const plan = getRecommendedCheckoutPlan(step.planSlug);
  const price = getRecommenderDisplayPrice(plan, billing);
  const savePercent = getYearlySavePercent(plan);
  const features = getRecommenderFeatureBullets(step.planSlug);
  const index = promptSliderIndex(sliderValue);
  const maxIndex = AI_PROMPT_SLIDER_STEPS.length - 1;
  const thumbPercent = maxIndex === 0 ? 0 : (index / maxIndex) * 100;
  const checkoutHref = getPlanCheckoutHref(step.planSlug, billing);
  const isCurrent = currentPlanSlug === step.planSlug;

  const setValue = (next: PromptSliderValue) => {
    setSliderValue(next);
    const nextStep = getPromptSliderStep(next);
    onRecommendChange?.(nextStep.planSlug);
  };

  return (
    <section
      aria-label="Plan recommender"
      style={{
        position: 'relative',
        overflow: 'hidden',
        border: '1px solid #DAD9DE',
        borderRadius: 12,
        background: 'linear-gradient(135deg, #FFFFFF 0%, #F8F8F9 48%, #FFF6F0 100%)',
        boxShadow: '0 4px 0 0 #e4e4e7',
        padding: '28px 28px 24px',
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
        gap: 28,
        fontFamily: 'var(--font-family-primary)',
      }}
    >
      <Starfield />

      {/* Left: question + slider + benefits */}
      <div style={{ position: 'relative', zIndex: 1, display: 'flex', flexDirection: 'column', gap: 18, minWidth: 0 }}>
        <div>
          <span
            style={{
              display: 'inline-block',
              fontSize: 11,
              fontWeight: 600,
              letterSpacing: '0.06em',
              textTransform: 'uppercase',
              color: '#E07D42',
              marginBottom: 8,
            }}
          >
            AI Search Visibility
          </span>
          <h2
            style={{
              margin: 0,
              fontSize: 22,
              fontWeight: 600,
              color: '#181225',
              lineHeight: 1.25,
              letterSpacing: '-0.01em',
            }}
          >
            How many AI prompts do you need to track?
          </h2>
          <p style={{ margin: '8px 0 0', fontSize: 14, color: '#6A6772', lineHeight: 1.5, maxWidth: 480 }}>
            {step.hint}
          </p>
        </div>

        <div>
          <label htmlFor={sliderId} style={{ position: 'absolute', width: 1, height: 1, overflow: 'hidden', clip: 'rect(0 0 0 0)' }}>
            Prompt volume
          </label>
          <div style={{ position: 'relative', padding: '8px 4px 4px' }}>
            <div
              style={{
                position: 'relative',
                height: 6,
                borderRadius: 9999,
                background: '#E6E6E9',
              }}
            >
              <div
                style={{
                  position: 'absolute',
                  left: 0,
                  top: 0,
                  bottom: 0,
                  width: `${thumbPercent}%`,
                  borderRadius: 9999,
                  background: '#F29964',
                  transition: 'width 160ms ease',
                }}
              />
              <input
                id={sliderId}
                type="range"
                min={0}
                max={maxIndex}
                step={1}
                value={index}
                onChange={(e) => setValue(promptSliderValueAt(Number(e.target.value)))}
                style={{
                  position: 'absolute',
                  inset: '-10px 0',
                  width: '100%',
                  margin: 0,
                  opacity: 0,
                  cursor: 'pointer',
                }}
              />
              <div
                aria-hidden="true"
                style={{
                  position: 'absolute',
                  top: '50%',
                  left: `${thumbPercent}%`,
                  width: 18,
                  height: 18,
                  marginTop: -9,
                  marginLeft: -9,
                  borderRadius: 9999,
                  background: '#fff',
                  border: '2px solid #F29964',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.18)',
                  pointerEvents: 'none',
                  transition: 'left 160ms ease',
                }}
              />
            </div>

            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                marginTop: 10,
                padding: '0 2px',
              }}
            >
              {AI_PROMPT_SLIDER_STEPS.map((s) => {
                const active = s.value === sliderValue;
                return (
                  <button
                    key={String(s.value)}
                    type="button"
                    onClick={() => setValue(s.value)}
                    style={{
                      border: 'none',
                      background: 'transparent',
                      padding: '2px 4px',
                      cursor: 'pointer',
                      fontSize: 13,
                      fontWeight: active ? 700 : 500,
                      color: active ? '#181225' : '#6A6772',
                      fontFamily: 'inherit',
                    }}
                  >
                    {s.label}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
          {features.map((f) => (
            <li key={f} style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
              <span style={{ marginTop: 2 }}>
                <Check />
              </span>
              <span style={{ fontSize: 13, color: '#302E36', lineHeight: 1.45 }}>{f}</span>
            </li>
          ))}
        </ul>
      </div>

      {/* Right: plan + price + CTAs */}
      <div
        style={{
          position: 'relative',
          zIndex: 1,
          background: '#FFFFFF',
          border: '1px solid #DAD9DE',
          borderRadius: 8,
          padding: '20px 20px 18px',
          display: 'flex',
          flexDirection: 'column',
          gap: 14,
          boxShadow: '0 1px 2px rgba(24,18,37,0.04)',
        }}
      >
        <div>
          <span style={{ fontSize: 12, fontWeight: 600, color: '#6A6772', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Recommended
          </span>
          <div style={{ fontSize: 20, fontWeight: 600, color: '#181225', marginTop: 4 }}>{plan.name}</div>
        </div>

        <div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
            <span style={{ fontSize: 28, fontWeight: 700, color: '#181225', letterSpacing: '-0.02em' }}>
              {formatEuro(price)}
            </span>
            <span style={{ fontSize: 13, color: '#6A6772' }}>/ month</span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 10, flexWrap: 'wrap' }}>
            <TogglePill
              on={billing === 'yearly'}
              onClick={() => onBillingChange(billing === 'yearly' ? 'monthly' : 'yearly')}
            />
            <span style={{ fontSize: 13, color: '#302E36' }}>Billed yearly</span>
            {billing === 'yearly' && savePercent > 0 && (
              <span
                style={{
                  fontSize: 11,
                  fontWeight: 600,
                  color: '#008900',
                  background: 'rgba(0,152,0,0.1)',
                  padding: '2px 8px',
                  borderRadius: 9999,
                }}
              >
                Save {savePercent}%
              </span>
            )}
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 'auto' }}>
          {isCurrent ? (
            <Button variant="secondary" size="sm" disabled style={{ width: '100%', opacity: 0.7 }}>
              Current plan
            </Button>
          ) : (
            <a href={checkoutHref} style={{ textDecoration: 'none', display: 'block' }}>
              <Button variant="primary" size="sm" style={{ width: '100%' }}>
                Start with {plan.name}
              </Button>
            </a>
          )}
          <Button
            type="button"
            variant="secondary"
            size="sm"
            style={{ width: '100%' }}
            onClick={() => onSeePlan(step.planSlug)}
          >
            See plan
          </Button>
        </div>
      </div>
    </section>
  );
};

export default PlanRecommenderBanner;
