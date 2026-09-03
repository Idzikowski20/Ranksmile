/** @jest-environment node */
/**
 * A tracker prompt is only worth its model call if the answer NAMES BRANDS. These guard
 * the two halves of that: what we refuse to accept from Google, and what we accept back
 * from the generator. The rejected examples are real prompts the old template path
 * produced for a live project.
 */
import {
   AI_VIS_PROMPTS_PER_TOPIC,
   buildTrackerPromptRequest,
   isBrandElicitingPrompt,
   parseTrackerPrompts,
} from '@/src/core/domain/aiVisibility/trackerPrompts';

describe('isBrandElicitingPrompt', () => {
   it('accepts a question that asks for providers', () => {
      expect(isBrandElicitingPrompt('Jakie biuro detektywistyczne wybrać do sprawy rozwodowej?')).toBe(true);
      expect(isBrandElicitingPrompt('Which agencies handle corporate investigations?')).toBe(true);
   });

   it('rejects yes/no questions — the answer is a rule, and it names nobody', () => {
      expect(isBrandElicitingPrompt('Czy śledzenie kogoś jest karalne?')).toBe(false);
      expect(isBrandElicitingPrompt('Czy prywatny detektyw może wejść do domu?')).toBe(false);
      expect(isBrandElicitingPrompt('Is hiring a private investigator legal?')).toBe(false);
   });

   it('rejects keyword strings — nobody types those at an assistant', () => {
      expect(isBrandElicitingPrompt('Usługi detektywistyczne cennik')).toBe(false);
      expect(isBrandElicitingPrompt('Biuro Detektywistyczne Łódź')).toBe(false);
   });

   it('rejects price questions — they return a range, not a shortlist', () => {
      expect(isBrandElicitingPrompt('Ile kosztuje prywatny detektyw Łódź?')).toBe(false);
   });

   it('rejects fragments', () => {
      expect(isBrandElicitingPrompt('Kto?')).toBe(false);
      expect(isBrandElicitingPrompt('')).toBe(false);
   });
});

describe('buildTrackerPromptRequest', () => {
   const seed = {
      topic: 'Biuro detektywistyczne',
      brand: 'ProDetektyw',
      language: 'Polish (polski)',
      observedQuestions: [
         'Czy śledzenie kogoś jest karalne?',          // dropped: yes/no
         'Usługi detektywistyczne cennik',             // dropped: keyword string
         'Jakie biuro wybrać przy podejrzeniu zdrady?', // kept
      ],
   };

   it('passes only the eliciting questions as material', () => {
      const { user } = buildTrackerPromptRequest(seed);
      expect(user).toContain('Jakie biuro wybrać przy podejrzeniu zdrady?');
      expect(user).not.toContain('Czy śledzenie kogoś jest karalne?');
      expect(user).not.toContain('Usługi detektywistyczne cennik');
   });

   it('states the topic, the language and the count', () => {
      const { user } = buildTrackerPromptRequest(seed);
      expect(user).toContain('Biuro detektywistyczne');
      expect(user).toContain('Polish (polski)');
      expect(user).toContain(String(AI_VIS_PROMPTS_PER_TOPIC));
   });

   it('names the tracked brand only as context, with an explicit do-not-mention', () => {
      // A prompt naming our own brand would bias the answer we are trying to measure.
      const { user, system } = buildTrackerPromptRequest(seed);
      expect(user).toContain('do NOT mention it');
      expect(system).toContain('Never name the tracked brand');
   });

   it('says so when Google gave nothing usable', () => {
      const { user } = buildTrackerPromptRequest({ ...seed, observedQuestions: ['Czy to legalne?'] });
      expect(user).toContain('No observed questions available');
   });
});

describe('parseTrackerPrompts', () => {
   it('reads the documented object', () => {
      const out = parseTrackerPrompts('{"prompts":["Jakie biura A?","Jakie biura B?"]}');
      expect(out).toEqual(['Jakie biura A?', 'Jakie biura B?']);
   });

   it('reads a bare array and survives surrounding prose or fences', () => {
      expect(parseTrackerPrompts('```json\n["Jakie firmy X?"]\n```')).toEqual(['Jakie firmy X?']);
      expect(parseTrackerPrompts('Here you go: {"prompts":["Jakie firmy Y?"]}')).toEqual(['Jakie firmy Y?']);
   });

   it('drops non-questions, fragments and non-strings', () => {
      const out = parseTrackerPrompts('{"prompts":["Jakie biura A?","Nie pytanie.","Kto?",42]}');
      expect(out).toEqual(['Jakie biura A?']);
   });

   it('de-duplicates case-insensitively — one use case must not take two slots', () => {
      const out = parseTrackerPrompts('{"prompts":["Jakie biura A?","jakie biura a?","Jakie biura B?"]}');
      expect(out).toEqual(['Jakie biura A?', 'Jakie biura B?']);
   });

   it('caps at the limit and returns nothing for unusable output', () => {
      const many = JSON.stringify({ prompts: Array.from({ length: 9 }, (_, i) => `Jakie biura ${i}?`) });
      expect(parseTrackerPrompts(many)).toHaveLength(AI_VIS_PROMPTS_PER_TOPIC);
      expect(parseTrackerPrompts('sorry, I cannot help with that')).toEqual([]);
      expect(parseTrackerPrompts('{"prompts":"nope"}')).toEqual([]);
   });
});
