import { toDfsLanguageCode } from '../../lib/domainLanguagePrompts';
import { looksPolish, polishPromptTemplates } from '../../lib/domainLanguagePrompts';

describe('domainLanguage', () => {
  describe('toDfsLanguageCode', () => {
    it('maps ISO codes', () => {
      expect(toDfsLanguageCode('pl')).toBe('pl');
      expect(toDfsLanguageCode('en')).toBe('en');
    });

    it('maps full language names (not broken po from Polish)', () => {
      expect(toDfsLanguageCode('Polish')).toBe('pl');
      expect(toDfsLanguageCode('English')).toBe('en');
      expect(toDfsLanguageCode('German')).toBe('de');
    });

    it('falls back when unknown', () => {
      expect(toDfsLanguageCode('Klingon', 'pl')).toBe('pl');
    });
  });

  describe('looksPolish', () => {
    it('detects Polish diacritics', () => {
      expect(looksPolish('Jak wybrać detektywa?')).toBe(true);
      expect(looksPolish('Detective Services Warsaw')).toBe(false);
    });
  });

  describe('polishPromptTemplates', () => {
    it('returns Polish question templates for a topic', () => {
      const prompts = polishPromptTemplates('usługi detektywistyczne');
      expect(prompts.length).toBeGreaterThanOrEqual(5);
      expect(prompts.every((p) => looksPolish(p.text))).toBe(true);
      expect(prompts[0].text).toContain('usługi detektywistyczne');
    });
  });
});
