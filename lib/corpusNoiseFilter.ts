/** Drop scraped SERP-corpus sentences that are not real topical facts. */
const CORPUS_NOISE: RegExp[] = [
  /\blubimyczytac\b/i,
  /\bporównywark/i,
  /\bksiążk/i,
  /\bcreative commons\b/i,
  /\bparsoid\b/i,
  /\bcookie/i,
  /\bprivacy policy\b/i,
  /\bwyrażam zgodę\b/i,
  /\bwszelkie prawa zastrzeżone\b/i,
  /\bdowiedz się więcej\b/i,
  /\binfolinia\b/i,
  /\bjooble\b/i,
  /\bofert pracy\b/i,
  /\bpraca\b.*\bpilne\b/i,
  /\bfacebook\b/i,
  /\blinkedin\b/i,
  /\bwikipedia\b/i,
  /\bzgłoszenie jej na adres\b/i,
  /\bstrona została wyrenderowana\b/i,
  /\btekst udostępniany na licencji\b/i,
  /\bthis website uses cookies\b/i,
  /\bnecessary always enabled\b/i,
  /\badmin@/i,
  /\b\+\d{2}[\s-]?\d{3}/,
  /\bul\.\s*[A-ZĄĆĘŁŃÓŚŹŻ]/i,
  /\bformularz\b/i,
  /\btwoja wiadomość\b/i,
  /\bimie\b.*\bnazwa firmy\b/i,
  /\bo nas\s*-->/i,
  /\bpolecane księgarnie\b/i,
  /\boferta dnia\b/i,
];

const BOILERPLATE_STARTS = [
  'answer the main question',
  'set expectations',
  'identify who',
  'explain why',
  'poniżej znajdują się różne znaczenia',
  'mimo że dokładamy starań',
];

export function isCorpusNoiseSentence(text: string): boolean {
  const t = text.replace(/\s+/g, ' ').trim();
  if (t.length < 20 || t.length > 200) return true;
  if (CORPUS_NOISE.some((re) => re.test(t))) return true;
  const low = t.toLowerCase();
  if (BOILERPLATE_STARTS.some((p) => low.startsWith(p))) return true;
  const words = low.split(/\s+/);
  if (words.length < 4) return true;
  const upperRatio = (t.match(/[A-ZĄĆĘŁŃÓŚŹŻ]/g) || []).length / t.length;
  if (upperRatio > 0.35) return true;
  return false;
}
