import { getVisiblePages } from '../../components/koala/core/pagination';

describe('getVisiblePages', () => {
  it('lists all pages when count is small', () => {
    expect(getVisiblePages(1, 5)).toEqual([1, 2, 3, 4, 5]);
  });

  it('inserts ellipsis for long ranges', () => {
    expect(getVisiblePages(10, 24)).toEqual([1, 'ellipsis', 9, 10, 11, 'ellipsis', 24]);
  });
});
