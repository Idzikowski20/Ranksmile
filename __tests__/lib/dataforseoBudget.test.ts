import { stopCrawlOnDomain, serpCrawlBudget, DFS_SERP_PAA, DFS_SERP_AI_ELEMENT } from '../../lib/dataforseoBudget';

describe('dataforseoBudget', () => {
   it('PAA uses single-page shallow crawl', () => {
      expect(DFS_SERP_PAA).toEqual({
         depth: 10,
         max_crawl_pages: 1,
         people_also_ask_click_depth: 1,
      });
   });

   it('AI element SERP uses single page', () => {
      expect(DFS_SERP_AI_ELEMENT).toEqual({ depth: 10, max_crawl_pages: 1 });
   });

   it('stopCrawlOnDomain strips protocol and www', () => {
      expect(stopCrawlOnDomain('https://www.example.com/path')).toEqual([
         { match_value: 'example.com', match_type: 'domain' },
      ]);
   });

   it('serpCrawlBudget adds stop_crawl_on_match when ownDomain given', () => {
      const task = serpCrawlBudget({ ownDomain: 'blog.example.com', withSubdomains: true });
      expect(task.max_crawl_pages).toBe(1);
      expect(task.stop_crawl_on_match).toEqual([
         { match_value: 'blog.example.com', match_type: 'with_subdomains' },
      ]);
   });

   it('serpCrawlBudget omits stop when domain empty', () => {
      expect(serpCrawlBudget({ ownDomain: '' })).not.toHaveProperty('stop_crawl_on_match');
   });
});
