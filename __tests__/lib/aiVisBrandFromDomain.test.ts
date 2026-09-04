/** @jest-environment node */
/**
 * The wizard's first guess at a brand name. It used to save the domain itself, which never
 * matched the name the AI answers write — the scan then reported 0% visibility for a brand
 * its answers had named eleven times.
 */
import { brandFromDomain } from '@/src/core/domain/aiVisibility/config';

describe('brandFromDomain', () => {
   it('takes the first label and capitalises it', () => {
      expect(brandFromDomain('prodetektyw.pl')).toBe('Prodetektyw');
      expect(brandFromDomain('example.co.uk')).toBe('Example');
   });

   it('reads hyphens and underscores as spaces', () => {
      expect(brandFromDomain('abd-group.pl')).toBe('Abd group');
      expect(brandFromDomain('my_shop.com')).toBe('My shop');
   });

   it('is empty for nothing usable, so the caller can require a real answer', () => {
      expect(brandFromDomain('')).toBe('');
      expect(brandFromDomain('.pl')).toBe('');
   });
});

describe('brandFromDomain and the www prefix', () => {
   it('does not offer "Www" as the brand', () => {
      expect(brandFromDomain('www.example.com')).toBe('Example');
      expect(brandFromDomain('WWW.Example.COM')).toBe('Example');
   });

   it('leaves a label that merely starts with w alone', () => {
      expect(brandFromDomain('wwwild.pl')).toBe('Wwwild');
   });
});
