import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useGscAccount } from '../../services/gscAccount';
import { createInitialJobs } from '../../lib/local/localSetupJobs';
import { suggestKeywordsForBusiness } from '../../lib/local/onboardingConfig';
import {
  findMatchingGbp,
  gbpToBusinessDetails,
  MOCK_GBP_PROFILES,
  placeToBusinessDetails,
} from '../../lib/local/mockPlaces';
import {
  INITIAL_SETUP_STATE,
  isLocalSetupComplete,
  loadLocalSetup,
  saveLocalSetup,
} from '../../lib/local/localSetupStorage';
import type {
  AiRepliesSettings,
  BusinessDetails,
  BusinessPlace,
  GrowthActionLogEntry,
  LocalSetupJobs,
  LocalSetupState,
  LocalUserRole,
} from '../../lib/local/types';
import type { GrowthTaskId } from '../../lib/local/growthActions';
import LocalOverviewDashboard from './LocalOverviewDashboard';
import ConfirmBusinessDetails from './setup/ConfirmBusinessDetails';
import LocalConnectStep from './setup/LocalConnectStep';
import LocalSearchHero from './setup/LocalSearchHero';
import SelectGbpModal from './setup/SelectGbpModal';
import AiRepliesEnabledStep from './setup/onboarding/AiRepliesEnabledStep';
import AiRepliesStep from './setup/onboarding/AiRepliesStep';
import CreatingLocationStep from './setup/onboarding/CreatingLocationStep';
import CustomizingFlowStep from './setup/onboarding/CustomizingFlowStep';
import GreatStartStep from './setup/onboarding/GreatStartStep';
import MapRankTrackerStep from './setup/onboarding/MapRankTrackerStep';
import UserRoleStep from './setup/onboarding/UserRoleStep';

type LocalOverviewContentProps = {
  slug: string;
};

export default function LocalOverviewContent({ slug }: LocalOverviewContentProps) {
  const { data: gscAccount } = useGscAccount();
  const [state, setState] = useState<LocalSetupState>(INITIAL_SETUP_STATE);
  const [hydrated, setHydrated] = useState(false);
  const [gbpModalOpen, setGbpModalOpen] = useState(false);

  useEffect(() => {
    if (!slug) return;
    setState(loadLocalSetup(slug));
    setHydrated(true);
  }, [slug]);

  const persist = useCallback((next: LocalSetupState | ((prev: LocalSetupState) => LocalSetupState)) => {
    setState((prev) => {
      const resolved = typeof next === 'function' ? next(prev) : next;
      if (slug) saveLocalSetup(slug, resolved);
      return resolved;
    });
  }, [slug]);

  const keywordSuggestions = useMemo(() => {
    if (!state.businessDetails) return [];
    return suggestKeywordsForBusiness(
      state.businessDetails.name,
      state.businessDetails.directoryCategories,
    );
  }, [state.businessDetails]);

  const defaultKeyword = keywordSuggestions[0];

  const withDefaultKeywords = useCallback((prev: LocalSetupState): LocalSetupState => {
    if (prev.mapRankKeywords.length > 0 || !defaultKeyword) return prev;
    return { ...prev, mapRankKeywords: [defaultKeyword] };
  }, [defaultKeyword]);

  const handlePlaceSelect = useCallback((place: BusinessPlace) => {
    const googleEmail = gscAccount?.email ?? null;
    const matched = googleEmail ? findMatchingGbp(place) : null;

    if (matched && matched.hasEditAccess) {
      persist({
        ...INITIAL_SETUP_STATE,
        step: 'confirm',
        selectedPlace: place,
        selectedGbpId: matched.id,
        businessDetails: gbpToBusinessDetails(matched),
        googleAccountEmail: googleEmail,
      });
      return;
    }

    if (matched && !matched.hasEditAccess) {
      persist({
        ...INITIAL_SETUP_STATE,
        step: 'connect',
        selectedPlace: place,
        selectedGbpId: null,
        businessDetails: placeToBusinessDetails(place),
        googleAccountEmail: googleEmail,
      });
      return;
    }

    persist({
      ...INITIAL_SETUP_STATE,
      step: 'connect',
      selectedPlace: place,
      selectedGbpId: null,
      businessDetails: placeToBusinessDetails(place),
      googleAccountEmail: googleEmail,
    });
  }, [gscAccount?.email, persist]);

  const handleChangePlace = useCallback(() => {
    persist({ ...INITIAL_SETUP_STATE, step: 'search' });
  }, [persist]);

  const handleSetupWithGoogle = useCallback(() => {
    if (!state.selectedPlace) return;
    const email = gscAccount?.email ?? 'demo@google.com';
    persist((prev) => ({ ...prev, googleAccountEmail: email }));
    setGbpModalOpen(true);
  }, [gscAccount?.email, persist, state.selectedPlace]);

  const handleGbpContinue = useCallback((profileId: string) => {
    const profile = MOCK_GBP_PROFILES.find((p) => p.id === profileId);
    if (!profile) return;
    setGbpModalOpen(false);
    persist((prev) => ({
      ...prev,
      step: 'confirm',
      selectedGbpId: profileId,
      businessDetails: gbpToBusinessDetails(profile),
    }));
  }, [persist]);

  const handleDetailsChange = useCallback((details: BusinessDetails) => {
    persist((prev) => ({ ...prev, businessDetails: details }));
  }, [persist]);

  const handleDistribute = useCallback(() => {
    persist((prev) => {
      if (!prev.businessDetails) return prev;
      return {
        ...prev,
        step: 'creating-location',
        locationCreatedAt: new Date().toISOString(),
      };
    });
  }, [persist]);

  const handleUserRoleSelect = useCallback((role: LocalUserRole) => {
    persist((prev) => ({ ...prev, userRole: role, step: 'ai-replies' }));
  }, [persist]);

  const handleUserRoleSkip = useCallback(() => {
    persist((prev) => ({ ...prev, step: 'ai-replies' }));
  }, [persist]);

  const handleAiRepliesChange = useCallback((aiReplies: AiRepliesSettings) => {
    persist((prev) => ({ ...prev, aiReplies }));
  }, [persist]);

  const handleAiRepliesContinue = useCallback(() => {
    persist((prev) => ({
      ...prev,
      aiReplies: { ...prev.aiReplies, skipped: false },
      step: 'ai-replies-enabled',
    }));
  }, [persist]);

  const handleAiRepliesSkip = useCallback(() => {
    persist((prev) => withDefaultKeywords({
      ...prev,
      aiReplies: { ...prev.aiReplies, positiveEnabled: false, negativeEnabled: false, skipped: true },
      step: 'map-rank-tracker',
    }));
  }, [persist, withDefaultKeywords]);

  const handleAiRepliesEnabledContinue = useCallback(() => {
    persist((prev) => withDefaultKeywords({ ...prev, step: 'map-rank-tracker' }));
  }, [persist, withDefaultKeywords]);

  const handleKeywordsChange = useCallback((mapRankKeywords: string[]) => {
    persist((prev) => ({ ...prev, mapRankKeywords }));
  }, [persist]);

  const enterGreatStart = useCallback((keywords: string[]) => {
    persist((prev) => ({
      ...prev,
      mapRankKeywords: keywords,
      setupJobs: createInitialJobs(prev.aiReplies, keywords),
      step: 'great-start',
    }));
  }, [persist]);

  const handleCreateCampaign = useCallback(() => {
    enterGreatStart(state.mapRankKeywords);
  }, [enterGreatStart, state.mapRankKeywords]);

  const handleMrtSkip = useCallback(() => {
    enterGreatStart([]);
  }, [enterGreatStart]);

  const handleMrtBack = useCallback(() => {
    persist((prev) => {
      const hadAiReplies = !prev.aiReplies.skipped
        && (prev.aiReplies.positiveEnabled || prev.aiReplies.negativeEnabled);
      return { ...prev, step: hadAiReplies ? 'ai-replies-enabled' : 'ai-replies' };
    });
  }, [persist]);

  const handleJobsChange = useCallback((setupJobs: LocalSetupJobs) => {
    persist((prev) => ({ ...prev, setupJobs }));
  }, [persist]);

  const handleGrowthProgressChange = useCallback((patch: {
    growthActionsDay: string;
    growthActionsCompletedIds: GrowthTaskId[];
    growthActionsLog: GrowthActionLogEntry[];
  }) => {
    persist((prev) => ({ ...prev, ...patch }));
  }, [persist]);

  const handleFinishOnboarding = useCallback(() => {
    persist((prev) => {
      if (!prev.businessDetails) return prev;
      return {
        ...prev,
        step: 'complete',
        completedAt: new Date().toISOString(),
      };
    });
  }, [persist]);

  if (!hydrated) {
    return (
      <div style={{ minHeight: 320, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <span style={{ color: '#6A6772', fontFamily: 'var(--font-family-primary)' }}>Loading…</span>
      </div>
    );
  }

  if (isLocalSetupComplete(state) && state.businessDetails) {
    return (
      <LocalOverviewDashboard
        slug={slug}
        details={state.businessDetails}
        jobs={state.setupJobs}
        aiReplies={state.aiReplies}
        mapRankKeywords={state.mapRankKeywords}
        hasUserRole={state.userRole !== null}
        onAddLocation={() => persist({ ...INITIAL_SETUP_STATE })}
        onJobsChange={handleJobsChange}
        onDetailsChange={handleDetailsChange}
        locationCreatedAt={state.locationCreatedAt ?? state.completedAt}
        growthActionsDay={state.growthActionsDay}
        growthActionsCompletedIds={state.growthActionsCompletedIds}
        growthActionsLog={state.growthActionsLog}
        onGrowthProgressChange={handleGrowthProgressChange}
      />
    );
  }

  if (state.step === 'search') {
    return <LocalSearchHero onSelect={handlePlaceSelect} />;
  }

  if (state.step === 'connect' && state.selectedPlace) {
    return (
      <>
        <LocalConnectStep
          place={state.selectedPlace}
          onSetupWithGoogle={handleSetupWithGoogle}
          onChangePlace={handleChangePlace}
        />
        <SelectGbpModal
          open={gbpModalOpen}
          place={state.selectedPlace}
          googleEmail={state.googleAccountEmail ?? gscAccount?.email ?? ''}
          onClose={() => setGbpModalOpen(false)}
          onContinue={handleGbpContinue}
          onChangeAccount={() => {
            window.location.href = '/api/auth/login?returnTo=' + encodeURIComponent(window.location.pathname);
          }}
        />
      </>
    );
  }

  if (state.step === 'confirm' && state.businessDetails) {
    return (
      <ConfirmBusinessDetails
        details={state.businessDetails}
        onChange={handleDetailsChange}
        onComplete={handleDistribute}
      />
    );
  }

  if (state.step === 'creating-location') {
    return (
      <CreatingLocationStep
        onComplete={() => persist((prev) => ({ ...prev, step: 'customizing-flow' }))}
      />
    );
  }

  if (state.step === 'customizing-flow') {
    return (
      <CustomizingFlowStep
        onComplete={() => persist((prev) => ({ ...prev, step: 'user-role' }))}
      />
    );
  }

  if (state.step === 'user-role') {
    return (
      <UserRoleStep
        selected={state.userRole}
        onSelect={handleUserRoleSelect}
        onSkip={handleUserRoleSkip}
      />
    );
  }

  if (state.step === 'ai-replies') {
    return (
      <AiRepliesStep
        settings={state.aiReplies}
        onChange={handleAiRepliesChange}
        onContinue={handleAiRepliesContinue}
        onSkip={handleAiRepliesSkip}
      />
    );
  }

  if (state.step === 'ai-replies-enabled' && state.businessDetails) {
    return (
      <AiRepliesEnabledStep
        businessName={state.businessDetails.name}
        onContinue={handleAiRepliesEnabledContinue}
      />
    );
  }

  if (state.step === 'map-rank-tracker' && state.businessDetails) {
    return (
      <MapRankTrackerStep
        businessName={state.businessDetails.name}
        keywords={state.mapRankKeywords}
        suggestions={keywordSuggestions}
        onChangeKeywords={handleKeywordsChange}
        onCreateCampaign={handleCreateCampaign}
        onSkip={handleMrtSkip}
        onBack={handleMrtBack}
      />
    );
  }

  if (state.step === 'great-start' && state.businessDetails && state.setupJobs) {
    return (
      <GreatStartStep
        details={state.businessDetails}
        jobs={state.setupJobs}
        onJobsChange={handleJobsChange}
        onContinue={handleFinishOnboarding}
      />
    );
  }

  return <LocalSearchHero onSelect={handlePlaceSelect} />;
}
