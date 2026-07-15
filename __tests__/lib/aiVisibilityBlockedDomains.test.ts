import { filterCitations, isBlockedCitationDomain } from '../../lib/aiVisibilityBlockedDomains';

describe('aiVisibilityBlockedDomains', () => {
  it('blocks vertexaisearch.cloud.google.com', () => {
    expect(isBlockedCitationDomain('vertexaisearch.cloud.google.com')).toBe(true);
    expect(isBlockedCitationDomain('www.vertexaisearch.cloud.google.com')).toBe(true);
  });

  it('filterCitations removes blocked domains', () => {
    const out = filterCitations([
      { url: 'https://vertexaisearch.cloud.google.com/grounding-api-redirect/AUZIYQ', domain: 'vertexaisearch.cloud.google.com', title: '' },
      { url: 'https://oracle.com/a', domain: 'oracle.com', title: 'Oracle' },
    ]);
    expect(out).toHaveLength(1);
    expect(out[0].domain).toBe('oracle.com');
  });

  it('filterCitations blocks by URL when domain field is empty', () => {
    const out = filterCitations([
      { url: 'https://vertexaisearch.cloud.google.com/x', domain: '', title: '' },
    ]);
    expect(out).toHaveLength(0);
  });
});
