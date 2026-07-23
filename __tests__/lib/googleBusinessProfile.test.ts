import { hasGbpManageScope, GBP_MANAGE_SCOPE } from '../../lib/googleOAuthScopes';
import {
  mapGbpLocationToProfile,
  mapGbpReviewToItem,
  parseAccountId,
  parseLocationId,
  parseReviewId,
} from '../../lib/local/googleBusinessProfile';

describe('hasGbpManageScope', () => {
  it('detects business.manage in space-separated scopes', () => {
    expect(hasGbpManageScope(`openid email ${GBP_MANAGE_SCOPE}`)).toBe(true);
  });

  it('detects legacy plus.business.manage', () => {
    expect(hasGbpManageScope('https://www.googleapis.com/auth/plus.business.manage')).toBe(true);
  });

  it('returns false without GBP scope', () => {
    expect(hasGbpManageScope('openid email https://www.googleapis.com/auth/webmasters.readonly')).toBe(false);
    expect(hasGbpManageScope('')).toBe(false);
  });
});

describe('GBP resource id parsers', () => {
  it('parses account and location ids from resource names', () => {
    expect(parseAccountId('accounts/12345')).toBe('12345');
    expect(parseLocationId('locations/67890')).toBe('67890');
    expect(parseLocationId('accounts/12345/locations/67890')).toBe('67890');
    expect(parseReviewId('accounts/1/locations/2/reviews/abc-xyz')).toBe('abc-xyz');
    expect(parseReviewId('plain-id')).toBe('plain-id');
  });

  it('does not treat locations/{id} as an account id', () => {
    expect(parseAccountId('locations/998877')).toBe('');
    expect(parseAccountId('locations/998877')).not.toBe('locations');
  });
});

describe('mapGbpLocationToProfile', () => {
  it('maps Business Information location to GbpProfile', () => {
    const profile = mapGbpLocationToProfile(
      {
        name: 'locations/998877',
        title: 'Test Shop',
        storefrontAddress: {
          addressLines: ['Main 1'],
          locality: 'Warszawa',
          postalCode: '00-001',
        },
        phoneNumbers: { primaryPhone: '+48111111111' },
        websiteUri: 'https://example.com',
        profile: { description: 'Hello' },
        categories: {
          primaryCategory: { displayName: 'Store' },
          additionalCategories: [{ displayName: 'Retail' }],
        },
        metadata: { hasVoiceOfMerchant: true },
      },
      '111',
    );

    expect(profile).toEqual(expect.objectContaining({
      id: '998877',
      accountId: '111',
      locationId: '998877',
      name: 'Test Shop',
      phone: '+48111111111',
      website: 'https://example.com',
      hasEditAccess: true,
    }));
    expect(profile?.address).toContain('Main 1');
  });

  it('extracts accountId from full resource name when not passed', () => {
    const profile = mapGbpLocationToProfile({
      name: 'accounts/555/locations/998877',
      title: 'Shop',
    });
    expect(profile?.accountId).toBe('555');
    expect(profile?.locationId).toBe('998877');
  });

  it('returns null for locations/{id} without accountId (BI API shape)', () => {
    // Business Information list returns name=locations/{id}; without the parent
    // account id from the request path, the profile is unusable for reviews API.
    expect(mapGbpLocationToProfile({
      name: 'locations/998877',
      title: 'Orphan',
    })).toBeNull();
  });
});

describe('mapGbpReviewToItem', () => {
  it('maps review + owner reply into ReviewItem', () => {
    const item = mapGbpReviewToItem(
      {
        name: 'accounts/1/locations/2/reviews/rev-1',
        reviewId: 'rev-1',
        reviewer: { displayName: 'Anna' },
        starRating: 'FIVE',
        comment: 'Great service and team.',
        createTime: '2024-06-15T12:00:00Z',
        reviewReply: {
          comment: 'Thank you Anna!',
          updateTime: '2024-06-16T09:00:00Z',
        },
      },
      'AODC Sp. z o.o.',
      0,
    );

    expect(item.id).toBe('rev-1');
    expect(item.author).toBe('Anna');
    expect(item.rating).toBe(5);
    expect(item.dateIso).toBe('2024-06-15');
    expect(item.reply).toEqual(expect.objectContaining({
      author: 'AODC Sp. z o.o.',
      text: 'Thank you Anna!',
      source: 'manual',
    }));
  });

  it('returns null reply when owner has not answered', () => {
    const item = mapGbpReviewToItem(
      {
        reviewId: 'rev-2',
        reviewer: { isAnonymous: true },
        starRating: 'THREE',
        comment: 'Ok',
      },
      'Biz',
      1,
    );
    expect(item.author).toBe('Anonymous');
    expect(item.rating).toBe(3);
    expect(item.reply).toBeNull();
  });
});
