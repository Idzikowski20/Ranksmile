import dotenv from 'dotenv';
import axios from 'axios';

dotenv.config({ path: '.env.local' });
dotenv.config({ path: '.env' });

const keyword = 'detektyw warszawa';
const urls = [
  'https://expertus.pl/',
  'https://agencjatemida.pl/prywatny-detektyw-warszawa/',
  'https://sprawdzonydetektyw.pl/',
  'https://grupa-alert.pl/',
  'https://pl.jooble.org/praca-detektyw/Warszawa',
  'https://detektywzyna.pl/sprawy-rozwodowe/warszawa/',
  'https://www.detektywipl.pl/',
  'https://prodetektyw.pl/detektyw-kryminalny-warszawa-skuteczne-dzialania-operacyjne/',
  'https://dbsdetektyw.pl/oddzialy/prywatny-detektyw-warszawa/',
  'https://www.facebook.com/dobrydetektywwarszawa/',
];

const sidecarUrl = (process.env.PYTHON_SIDECAR_URL || 'http://127.0.0.1:8001').replace('localhost', '127.0.0.1');
const res = await axios.post(
  `${sidecarUrl}/extract-terms-from-urls`,
  { keyword, urls },
  { timeout: 180000, headers: { 'x-internal-token': process.env.INTERNAL_PIPELINE_TOKEN || '' } },
);
const raw = res.data?.terms || [];
console.log('raw:', raw.length);

const { filterUsefulNlpTerms } = await import('../lib/competitorTermCalibration.ts');
const useful = filterUsefulNlpTerms(raw.map((t) => ({ term: t.term, target_count: t.target_count ?? 1 })));
console.log('useful:', useful.length);
console.log('useful sample:', useful.slice(0, 30).map((t) => t.term));

const { mergeNlpTerms } = await import('../lib/pickArticleTerms.ts');
const existing = [
  { term: 'detektyw warszawa', target_count: 4 },
  { term: 'detektyw', target_count: 36 },
  { term: 'warszawa', target_count: 8 },
];
const merged = mergeNlpTerms(existing, useful);
console.log('merged:', merged.length);
