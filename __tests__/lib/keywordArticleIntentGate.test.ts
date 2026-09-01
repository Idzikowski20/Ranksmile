import { checkKeywordArticleIntent } from '../../lib/harvest/keywordArticleIntentGate';

describe('checkKeywordArticleIntent', () => {
  it('flags military keyword on business hybrid-war article', () => {
    const r = checkKeywordArticleIntent({
      keyword: 'wojna hybrydowa',
      articleTitle: 'Wojna hybrydowa w firmie — jak zmienić strategię i szkolenia',
      articleExcerpt: 'Resilience organizacji, zarządzanie zmianą, szkolenia pracowników.',
    });
    expect(r.onTopic).toBe(false);
    expect(r.suggestedAngle).toBe('business_strategy');
  });

  it('allows aligned military article', () => {
    const r = checkKeywordArticleIntent({
      keyword: 'wojna hybrydowa',
      articleTitle: 'Wojna hybrydowa — konflikt zbrojny i geopolityka',
      articleExcerpt: 'NATO, Ukraina, broń, armia.',
    });
    expect(r.onTopic).toBe(true);
  });
});
