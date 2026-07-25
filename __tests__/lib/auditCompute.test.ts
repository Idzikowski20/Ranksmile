import { buildAuditResult, auditContentScore, termCoverageFraction } from '../../lib/auditCompute';

const HTML = `<!doctype html><html><head>
  <title>Jak sprawdzić czy ktoś mnie śledzi — poradnik</title>
  <meta name="description" content="Dowiedz się jak sprawdzić czy ktoś Cię śledzi: podejrzane aplikacje, obserwacja i konkretne wskazówki bezpieczeństwa krok po kroku dla każdego.">
  <script>var x = 1;</script>
</head><body>
  <h1>Jak sprawdzić czy ktoś mnie śledzi</h1>
  <p>Jeśli podejrzewasz, że ktoś Cię śledzi, w tym poradniku znajdziesz konkretne wskazówki. Śledzenie bywa dyskretne.</p>
  <h2>Podejrzane aplikacje</h2>
  <p>Sprawdź <strong>podejrzane aplikacje</strong> na telefonie. Nieznane aplikacje mogą śledzić Twoją lokalizację.</p>
  <h3>Obserwacja</h3>
  <p>Uważaj na inny samochód jadący za Tobą i zmień <b>drugą stronę ulicy</b>.</p>
  <img src="/a.jpg" alt="śledzenie"><img src="/b.jpg" alt="telefon">
  <a href="https://prodetektyw.pl/cyberbezpieczenstwo">Cyberbezpieczeństwo</a>
  <a href="https://prodetektyw.pl/jak-sprawdzic-czy-ktos-mnie-sledzi">Ten sam artykuł</a>
  <a href="https://external.example.com/x">Zewnętrzny</a>
  <a href="#top">Kotwica</a>
</body></html>`;

const URL = 'https://prodetektyw.pl/jak-sprawdzic-czy-ktos-mnie-sledzi';
const KEYWORD = 'ktoś mnie śledzi';

describe('buildAuditResult', () => {
   const r = buildAuditResult(HTML, URL, KEYWORD, { ttfbMs: 120, loadMs: 340 });

   it('carries url + keyword + timings into factors', () => {
      expect(r.url).toBe(URL);
      expect(r.keyword).toBe(KEYWORD);
      expect(r.factors.find((f) => f.key === 'ttfb')?.you).toBe(120);
      expect(r.factors.find((f) => f.key === 'load_time')?.you).toBe(340);
   });

   it('computes real structural counts from the HTML', () => {
      const by = (k: string) => r.factors.find((f) => f.key === k)?.you;
      expect(by('h1_count')).toBe(1);
      expect(by('h2_h6_count')).toBe(2); // one h2 + one h3
      expect(by('p_count')).toBe(3);
      expect(by('img_count')).toBe(2);
      expect(by('strong_b_count')).toBe(2); // strong + b
      expect(by('title_chars')).toBe('Jak sprawdzić czy ktoś mnie śledzi — poradnik'.length);
   });

   it('counts exact + partial keyword occurrences', () => {
      const by = (k: string) => r.factors.find((f) => f.key === k)?.you ?? 0;
      expect(by('exact_kw_title')).toBeGreaterThanOrEqual(1);
      expect(by('exact_kw_h1')).toBeGreaterThanOrEqual(1);
      expect(by('exact_kw_body')).toBeGreaterThanOrEqual(1);
      expect(by('partial_kw_per100')).toBeGreaterThan(0);
   });

   it('excludes script text from body word count', () => {
      const body = r.factors.find((f) => f.key === 'word_count_body')?.you ?? 0;
      expect(body).toBeGreaterThan(20);
      // "var x = 1" must not leak into body words
      expect(JSON.stringify(r)).not.toContain('var x = 1');
   });

   it('collects same-site internal links, dedups, skips anchors/external, flags self-link', () => {
      const urls = r.internalLinks.map((l) => l.url);
      expect(urls).toContain('https://prodetektyw.pl/cyberbezpieczenstwo');
      expect(urls).toContain('https://prodetektyw.pl/jak-sprawdzic-czy-ktos-mnie-sledzi');
      expect(urls).not.toContain('https://external.example.com/x');
      expect(urls.some((u) => u.includes('#'))).toBe(false);
      const self = r.internalLinks.find((l) => l.url.endsWith('/jak-sprawdzic-czy-ktos-mnie-sledzi'));
      expect(self?.linked).toBe(true);
   });

   it('produces a content score in [0,100]', () => {
      expect(r.contentScore).toBeGreaterThanOrEqual(0);
      expect(r.contentScore).toBeLessThanOrEqual(100);
   });

   it('marks every factor placeholder with 3 stub competitors and a suggested range', () => {
      expect(r.factors.length).toBeGreaterThan(10);
      r.factors.forEach((f) => {
         expect(f.placeholder).toBe(true);
         expect(f.competitors).toHaveLength(3);
         expect(f.suggestedMin).not.toBeNull();
         expect(f.suggestedMax).not.toBeNull();
         expect((f.suggestedMax as number)).toBeGreaterThanOrEqual(f.suggestedMin as number);
      });
   });

   it('is deterministic — same HTML yields identical factor stubs', () => {
      const r2 = buildAuditResult(HTML, URL, KEYWORD, { ttfbMs: 120, loadMs: 340 });
      const strip = (x: typeof r) => ({ ...x, generatedAt: '' });
      expect(strip(r2)).toEqual(strip(r));
   });
});

describe('buildAuditResult with real competitor data (phase 2)', () => {
   const real = {
      competitors: [
         { domain: 'detektywsigma.pl', rank: 1, contentScore: 80, values: { word_count_body: 2000, h1_count: 1, img_count: 6 } },
         { domain: 'www.infor.pl', rank: 4, contentScore: 50, values: { word_count_body: 1400, h1_count: 1, img_count: 2 } },
      ],
      terms: [
         { term: 'podejrzane aplikacje', target_count: 3 },
         { term: 'inny samochód', target_count: 1 },
      ],
   };
   const r = buildAuditResult(HTML, URL, KEYWORD, { ttfbMs: 100, loadMs: 300 }, real);

   it('flips every factor to real (placeholder:false) with the given competitor values', () => {
      r.factors.forEach((f) => expect(f.placeholder).toBe(false));
      const body = r.factors.find((f) => f.key === 'word_count_body');
      expect(body?.competitors).toEqual([
         { label: 'detektywsigma.pl', rank: 1, value: 2000 },
         { label: 'www.infor.pl', rank: 4, value: 1400 },
      ]);
      // suggested range spans the competitor spread
      expect(body?.suggestedMin).toBe(1400);
      expect(body?.suggestedMax).toBe(2000);
   });

   it('derives the content-score competitors + range from real data', () => {
      expect(r.contentScoreCompetitors).toEqual([
         { label: 'detektywsigma.pl', rank: 1, value: 80 },
         { label: 'www.infor.pl', rank: 4, value: 50 },
      ]);
      expect(r.contentScoreSuggestedMin).toBe(50);
      expect(r.contentScoreSuggestedMax).toBe(80);
   });

   it('maps NLP terms with a real "you" count + add/ok action', () => {
      expect(r.terms.length).toBe(2);
      const t = r.terms.find((x) => x.term === 'podejrzane aplikacje');
      expect(t?.nlp).toBe(true);
      expect(t?.suggested).toBe('3');
      expect(t?.you).toBeGreaterThanOrEqual(1); // appears in the fixture body
      expect(['add', 'ok', 'remove']).toContain(t?.action);
   });

   it('builds Ranksmile-exact description suffixes per factor style', () => {
      const msg = (key: string) => r.factors.find((f) => f.key === key)?.message || '';
      // range style: competitor spread 1400–2000 with the unit noun "words"
      expect(msg('word_count_body')).toContain('while the suggested range is 1400 - 2000 words.');
      // single style: fixed target 1, singular noun
      expect(msg('exact_kw_title')).toContain('while the suggested is 1 exact keyword.');
      // optimal style: meta description
      expect(msg('meta_desc_chars')).toContain('while the optimal range is 130 - 150 characters.');
      // atLeast style: paragraph elements
      expect(msg('p_count')).toContain('while the suggested range is at least');
      // info factors carry no description line
      expect(msg('exact_kw_h2h6')).toBe('');
   });

   it('falls back to a competitor value of 0 for factors the competitor lacks', () => {
      const strong = r.factors.find((f) => f.key === 'strong_b_words');
      expect(strong?.competitors.every((c) => c.value === 0)).toBe(true);
   });
});

describe('Ranksmile-style factor parity', () => {
   const r = buildAuditResult(HTML, URL, KEYWORD, { ttfbMs: 120, loadMs: 340 });
   const by = (k: string) => r.factors.find((f) => f.key === k);

   it('breaks exact + partial keywords out per content zone (body/h2-h6/paragraphs/img-alt)', () => {
      const keys = [
         'exact_kw_h2h6', 'exact_kw_h2h6_per100', 'exact_kw_p', 'exact_kw_p_per100', 'exact_kw_img', 'exact_kw_img_per100',
         'partial_kw_h2h6', 'partial_kw_h2h6_per100', 'partial_kw_p', 'partial_kw_p_per100', 'partial_kw_img', 'partial_kw_img_per100',
      ];
      keys.forEach((k) => expect(by(k)).toBeDefined());
   });

   it('marks the sub-zone keyword factors as informational (blue)', () => {
      expect(by('exact_kw_h2h6')?.verdict).toBe('info');
      expect(by('partial_kw_p')?.verdict).toBe('info');
   });

   it('applies fixed optimal ranges to title/meta/h1/img factors', () => {
      expect([by('title_chars')?.suggestedMin, by('title_chars')?.suggestedMax]).toEqual([55, 70]);
      expect([by('meta_desc_chars')?.suggestedMin, by('meta_desc_chars')?.suggestedMax]).toEqual([130, 150]);
      expect([by('img_count')?.suggestedMin, by('img_count')?.suggestedMax]).toEqual([3, 6]);
      expect([by('exact_kw_title')?.suggestedMin, by('exact_kw_title')?.suggestedMax]).toEqual([1, 1]);
   });

   it('covers all Ranksmile sections in order', () => {
      const sections = r.factors.map((f) => f.section).filter((s, i, a) => a.indexOf(s) === i);
      expect(sections).toEqual([
         'Word count', 'Exact keywords', 'Partial keywords', 'Page structure',
         'Title and meta description length', 'Time to first byte', 'Load time (ms)',
      ]);
   });
});

describe('audit content score (Ranksmile calibration)', () => {
   it('is coverage-dominated: low term coverage → mid score even with good length', () => {
      // 20% coverage, full length, 70% structure → ~48 (Ranksmile-like, not the inflated ~90)
      expect(auditContentScore(0.2, 1, 0.7)).toBe(48);
   });
   it('bounds: full coverage → 100, none → 0', () => {
      expect(auditContentScore(1, 1, 1)).toBe(100);
      expect(auditContentScore(0, 0, 0)).toBe(0);
   });
   it('termCoverageFraction counts distinct terms present (inflection-tolerant)', () => {
      const body = 'prywatny detektyw sprawdza podejrzane aplikacje na telefonie';
      expect(termCoverageFraction(body, [{ term: 'prywatny detektyw' }, { term: 'nieznane aplikacje' }])).toBeCloseTo(0.5);
   });
});
