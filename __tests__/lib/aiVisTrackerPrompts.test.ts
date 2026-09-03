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

   it('tells the model the sample does not define its coverage', () => {
      // With infidelity-only seeds, every prompt collapsed onto infidelity — the model read
      // the sample as the spec. Reproduced 2/2 with such seeds, 0/2 without them.
      const { system } = buildTrackerPromptRequest(seed);
      expect(system).toContain('ONE SAMPLE of demand');
      expect(system).toContain('never define your coverage');
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

describe('sibling topics', () => {
   const base = {
      topic: 'Agencja detektywistyczna',
      brand: 'ProDetektyw',
      language: 'Polish (polski)',
      observedQuestions: [] as string[],
   };

   it('names the siblings and tells the topic to claim its own slice', () => {
      // Measured: three synonymous topics produced 5 distinct jobs between them without
      // this, about 12 with it. The requests stay parallel; naming the siblings is enough.
      const { user } = buildTrackerPromptRequest({
         ...base,
         siblingTopics: ['Biuro detektywistyczne', 'Prywatny detektyw Warszawa'],
      });
      expect(user).toContain('"Biuro detektywistyczne"');
      expect(user).toContain('"Prywatny detektyw Warszawa"');
      expect(user).toContain('leave that ground to it');
      // Not asserted as synonyms: tracked topics are sometimes distinct intents, and
      // saying otherwise makes the model hand away use cases that belong here.
      expect(user).toContain('Ignore the ones that do not overlap');
   });

   it('says nothing when the topic has no siblings', () => {
      expect(buildTrackerPromptRequest(base).user).not.toContain('Other topics tracked');
      expect(buildTrackerPromptRequest({ ...base, siblingTopics: [] }).user).not.toContain('Other topics tracked');
   });

   it('never lists the topic as its own sibling, whatever the casing or length', () => {
      const long = 'x'.repeat(300);
      const listed = (siblingTopics: string[], topic = base.topic): string => buildTrackerPromptRequest({ ...base, topic, siblingTopics })
         .user.split('\n').find((l) => l.startsWith('Other topics tracked')) ?? '';
      // Case-only difference: comparing raw strings kept it, telling the topic to avoid
      // its own subject.
      expect(listed(['agencja DETEKTYWISTYCZNA'])).toBe('');
      // Longer than the truncation cap: comparing after slicing also kept it.
      expect(listed([long], long)).toBe('');
   });

   it('drops the topic itself, blanks, and anything past the cap', () => {
      const { user } = buildTrackerPromptRequest({
         ...base,
         siblingTopics: ['Agencja detektywistyczna', '  ', ...Array.from({ length: 12 }, (_, i) => `Temat ${i}`)],
      });
      // Check the list line itself: the topic is quoted again further down, in the
      // "claim your slice" sentence, where it belongs.
      const listed = user.split('\n').find((l) => l.startsWith('Other topics tracked')) ?? '';
      expect(listed).not.toContain('"Agencja detektywistyczna"'); // never avoid itself
      expect(listed).toContain('"Temat 0"');
      expect(listed).not.toContain('"Temat 8"'); // capped
   });

   it('truncates an overlong title rather than letting it run into the prompt', () => {
      const { user } = buildTrackerPromptRequest({ ...base, siblingTopics: ['x'.repeat(300)] });
      expect(user).not.toContain('x'.repeat(100));
   });
});
