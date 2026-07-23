import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useGscAccount } from '../../services/gscAccount';
import { createInitialJobs } from '../../lib/local/localSetupJobs';
import { suggestKeywordsForBusiness } from '../../lib/local/onboardingConfig';
import {
  gbpToBusinessDetails,
} from '../../lib/local/mockPlaces';
import {
  INITIAL_SETUP_STATE,
  isGbpConfigured,
  isLocalSetupComplete,
  loadLocalSetup,
  loadLocalSetupByGbp,
  saveLocalSetup,
} from '../../lib/local/localSetupStorage';
import type {
  AiRepliesSettings,
  BusinessDetails,
  GbpProfile,
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

  const profileConfigured = useCallback(
    (gbpId: string) => isGbpConfigured(slug, gbpId),
    [slug, state.completedAt, state.selectedGbpId, state.step],
  );

  const importGbpDetails = useCallback(async (profile: GbpProfile): Promise<BusinessDetails> => {
    const params = new URLSearchParams({
      name: profile.name,
      address: profile.address,
      phone: profile.phone,
    });
    if (profile.website) params.set('website', profile.website);

    try {
      const res = await fetch(`/api/local/gbp-import?${params.toString()}`);
      if (!res.ok) throw new Error(`gbp-import ${res.status}`);
      const data = (await res.json()) as { details?: BusinessDetails };
      if (data.details) return data.details;
    } catch (err) {
      console.error('[LocalOverview] GBP import failed:', err);
    }
    return gbpToBusinessDetails(profile);
  }, []);

  // Re-import if confirm still has local placeholder images from an older session.
  useEffect(() => {
    if (!hydrated || !slug || state.step !== 'confirm' || !state.selectedGbpId || !state.businessDetails) {
      return undefined;
    }
    const details = state.businessDetails;
    const hasLocalAssets = [details.logoUrl, details.coverUrl, ...details.photoUrls]
      .some((url) => Boolean(url?.startsWith('/images/')));
    if (!hasLocalAssets) return undefined;

    const profile: GbpProfile = {
      id: state.selectedGbpId,
      accountId: state.gbpAccountId || '',
      locationId: state.gbpLocationId || state.selectedGbpId,
      name: details.name,
      address: details.address,
      phone: details.phone,
      website: details.website,
      description: details.description,
      hasEditAccess: true,
    };

    let cancelled = false;
    void (async () => {
      const imported = await importGbpDetails(profile);
      if (cancelled) return;
      persist((prev) => (
        prev.step === 'confirm' ? { ...prev, businessDetails: imported } : prev
      ));
    })();

    return () => {
      cancelled = true;
    };
  }, [
    hydrated,
    importGbpDetails,
    persist,
    slug,
    state.businessDetails,
    state.gbpAccountId,
    state.gbpLocationId,
    state.selectedGbpId,
    state.step,
  ]);

  const googleConnectHref = `/api/gsc/connect?redirect=${encodeURIComponent(`/sites/${slug}/local/overview`)}`;

  const handleGbpProfileSelect = useCallback(async (profile: GbpProfile) => {
    const googleEmail = gscAccount?.email ?? null;
    const existing = loadLocalSetupByGbp(slug, profile.id);

    if (existing && isLocalSetupComplete(existing)) {
      persist({
        ...existing,
        gbpAccountId: profile.accountId || existing.gbpAccountId,
        gbpLocationId: profile.locationId || existing.gbpLocationId,
      });
      return;
    }

    // Resume only mid-onboarding after confirm; otherwise re-import GBP details.
    if (
      existing
      && existing.step !== 'search'
      && existing.step !== 'connect'
      && existing.step !== 'confirm'
    ) {
      persist({
        ...existing,
        googleAccountEmail: existing.googleAccountEmail ?? googleEmail,
        gbpAccountId: profile.accountId || existing.gbpAccountId,
        gbpLocationId: profile.locationId || existing.gbpLocationId,
      });
      return;
    }

    const place = {
      id: `gbp-place-${profile.id}`,
      name: profile.name,
      address: profile.address,
      phone: profile.phone,
    };

    const businessDetails = await importGbpDetails(profile);

    // Profile already chosen on hero — skip connect + GBP modal and go to confirm.
    persist({
      ...INITIAL_SETUP_STATE,
      step: 'confirm',
      selectedPlace: place,
      selectedGbpId: profile.id,
      gbpAccountId: profile.accountId,
      gbpLocationId: profile.locationId,
      businessDetails,
      googleAccountEmail: googleEmail ?? existing?.googleAccountEmail ?? null,
    });
  }, [gscAccount?.email, importGbpDetails, persist, slug]);

  const handleChangePlace = useCallback(() => {
    persist({ ...INITIAL_SETUP_STATE, step: 'search' });
  }, [persist]);

  const handleAddLocation = useCallback(() => {
    persist({ ...INITIAL_SETUP_STATE, step: 'search' });
  }, [persist]);

  const handleChangeAccount = useCallback(() => {
    window.location.href = googleConnectHref;
  }, [googleConnectHref]);

  const handleSetupWithGoogle = useCallback(() => {
    if (!state.selectedPlace) return;
    if (!gscAccount?.email) {
      window.location.href = googleConnectHref;
      return;
    }
    const email = gscAccount.email;
    persist((prev) => ({ ...prev, googleAccountEmail: email }));
    setGbpModalOpen(true);
  }, [gscAccount?.email, googleConnectHref, persist, state.selectedPlace]);

  const handleGbpContinue = useCallback((profile: GbpProfile) => {
    setGbpModalOpen(false);
    persist((prev) => ({
      ...prev,
      step: 'confirm',
      selectedGbpId: profile.id,
      gbpAccountId: profile.accountId,
      gbpLocationId: profile.locationId,
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
        onAddLocation={handleAddLocation}
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
    return (
      <LocalSearchHero
        googleEmail={state.googleAccountEmail ?? gscAccount?.email ?? null}
        connectHref={googleConnectHref}
        isConfigured={profileConfigured}
        onSelectProfile={handleGbpProfileSelect}
        onChangeAccount={handleChangeAccount}
      />
    );
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
          onChangeAccount={handleChangeAccount}
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

  return (
    <LocalSearchHero
      googleEmail={state.googleAccountEmail ?? gscAccount?.email ?? null}
      connectHref={googleConnectHref}
      isConfigured={profileConfigured}
      onSelectProfile={handleGbpProfileSelect}
      onChangeAccount={handleChangeAccount}
    />
  );
}
