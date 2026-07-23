import { useRouter } from 'next/router';
import React, { useCallback, useEffect, useState } from 'react';
import Button from '../../core/button/button';
import {
  INITIAL_SETUP_STATE,
  isLocalSetupComplete,
  loadLocalSetup,
} from '../../../lib/local/localSetupStorage';
import type { ReviewItem, ReviewProgressMonth } from '../../../lib/local/reviewsData';
import type { LocalSetupState } from '../../../lib/local/types';
import ReviewManagementDashboard from './ReviewManagementDashboard';

type ReviewManagementContentProps = {
  slug: string;
};

type ReviewsPayload = {
  reviews: ReviewItem[];
  totalReviews: number;
  averageRating: number;
  progress: ReviewProgressMonth[];
  source: string;
};

type LoadErrorCode = 'no_account' | 'needs_reconnect' | 'forbidden' | 'not_found' | 'upstream' | null;

function ReviewsGate({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action: React.ReactNode;
}) {
  return (
    <div className="local-reviews-gate">
      <img
        className="local-reviews-gate-image"
        src="/images/GBP.webp"
        alt=""
        width={220}
        height={160}
        loading="lazy"
        decoding="async"
      />
      <h2>{title}</h2>
      <p>{description}</p>
      <div className="local-reviews-gate-actions">{action}</div>
    </div>
  );
}

export default function ReviewManagementContent({ slug }: ReviewManagementContentProps) {
  const router = useRouter();
  const [state, setState] = useState<LocalSetupState>(INITIAL_SETUP_STATE);
  const [hydrated, setHydrated] = useState(false);
  const [payload, setPayload] = useState<ReviewsPayload | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [errorCode, setErrorCode] = useState<LoadErrorCode>(null);

  const overviewHref = `/sites/${slug}/local/overview`;
  const googleConnectHref = `/api/gsc/connect?redirect=${encodeURIComponent(`/sites/${slug}/local/review-management`)}`;

  const goToOverview = useCallback(() => {
    void router.push(overviewHref);
  }, [overviewHref, router]);

  const loadReviews = useCallback(async (setup: LocalSetupState) => {
    if (!setup.businessDetails || !setup.gbpAccountId || !setup.gbpLocationId) return;
    setLoading(true);
    setError(null);
    setErrorCode(null);
    try {
      const params = new URLSearchParams({
        accountId: setup.gbpAccountId,
        locationId: setup.gbpLocationId,
        businessName: setup.businessDetails.name,
      });
      const res = await fetch(`/api/local/reviews?${params.toString()}`);
      const data = (await res.json()) as ReviewsPayload | { error: string; code?: LoadErrorCode };
      if (!res.ok || 'error' in data) {
        const code = 'code' in data ? (data.code ?? null) : null;
        setErrorCode(code);
        throw new Error('error' in data ? data.error : `reviews ${res.status}`);
      }
      setPayload(data);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load reviews';
      setError(message);
      setPayload(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!slug) return;
    const setup = loadLocalSetup(slug);
    setState(setup);
    setHydrated(true);
    if (
      isLocalSetupComplete(setup)
      && setup.businessDetails
      && setup.gbpAccountId
      && setup.gbpLocationId
    ) {
      void loadReviews(setup);
    }
  }, [slug, loadReviews]);

  if (!hydrated) {
    return <div className="local-reviews-loading">Loading…</div>;
  }

  if (!isLocalSetupComplete(state) || !state.businessDetails) {
    return (
      <ReviewsGate
        title="Complete Local setup first"
        description="Review Management tracks Google reviews and AI replies for your location. Finish setup on the Local overview to unlock this tool."
        action={(
          <Button type="button" variant="primary" size="md" onClick={goToOverview}>
            Go to Local Overview
          </Button>
        )}
      />
    );
  }

  if (!state.gbpAccountId || !state.gbpLocationId) {
    return (
      <ReviewsGate
        title="Connect a Google Business Profile"
        description="This location was set up without a linked GBP account/location. Re-select your profile on Local overview after connecting Google."
        action={(
          <Button type="button" variant="primary" size="md" onClick={goToOverview}>
            Go to Local Overview
          </Button>
        )}
      />
    );
  }

  if (errorCode === 'no_account' || errorCode === 'needs_reconnect') {
    return (
      <ReviewsGate
        title="Connect Google"
        description="Connect Google with Business Profile access to load reviews and edit owner replies."
        action={(
          <Button
            type="button"
            variant="primary"
            size="md"
            onClick={() => {
              window.location.href = googleConnectHref;
            }}
          >
            Connect Google
          </Button>
        )}
      />
    );
  }

  return (
    <ReviewManagementDashboard
      business={state.businessDetails}
      aiRepliesSettings={state.aiReplies}
      gbpAccountId={state.gbpAccountId}
      gbpLocationId={state.gbpLocationId}
      reviews={payload?.reviews ?? []}
      totalReviews={payload?.totalReviews ?? 0}
      averageStarRating={payload?.averageRating ?? 0}
      progress={payload?.progress ?? []}
      loading={loading}
      error={error}
      onRefresh={() => {
        void loadReviews(state);
      }}
    />
  );
}
