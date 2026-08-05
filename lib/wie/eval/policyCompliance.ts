/**
 * Policy Compliance — Expected (WIE decisions) vs Observed (HTML output).
 * Catches Writer/prompt gaps when Explainability says problem_first but lead is definition_first.
 */
import type { ExplainabilityRecord } from '../explainability';

export type ComplianceStatus = 'passed' | 'failed' | 'unknown';

export type PolicyComplianceRow = {
  rule: string;
  expected: string;
  observed: string;
  status: ComplianceStatus;
};

export type PolicyComplianceResult = {
  rows: PolicyComplianceRow[];
  passed: number;
  failed: number;
  unknown: number;
  /** True when any policy decision was violated by output */
  has_violations: boolean;
};

function stripTags(html: string): string {
  return html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
}

export type OpeningStyle = 'problem_first' | 'definition_first' | 'mixed' | 'unknown';

/** Detect how the article actually opens (first body paragraph / ~280 chars). */
export function detectOpeningStyle(html: string): OpeningStyle {
  const plain = stripTags(html);
  // Prefer first <p> body after optional H1
  const firstP = html.match(/<p\b[^>]*>([\s\S]*?)<\/p>/i)?.[1];
  const leadSource = firstP ? stripTags(firstP) : plain;
  const lead = leadSource.slice(0, 320);
  const head = lead.slice(0, 140);

  const defHead =
    /^(?:\S+\s+){0,8}(to|jest|oznacza)\b/i.test(head)
    || /^(?:definicj|słownik)/i.test(head)
    || /\bw znaczeniu\b/i.test(head);
  const problemHead =
    /^(?:padł|ofiar|nie wiesz|co robić|wyobraź|czujesz|otrzymałeś|dostałeś|strach)/i.test(head)
    || /\b(padłeś ofiarą|nie jesteś sam|co robić|wyobraź sobie|czujesz,?\s+że)\b/i.test(head);

  if (problemHead) return 'problem_first';
  if (defHead) return 'definition_first';

  const defLater = /\bdefinicj|słownik|oznacza to\b/i.test(lead);
  const problemLater = /\b(padł|ofiar|co robić|czujesz|wyobraź)\b/i.test(lead);
  if (problemLater && defLater) return 'mixed';
  if (problemLater) return 'problem_first';
  if (defLater) return 'definition_first';
  return 'unknown';
}

export function countConcreteExamples(html: string): number {
  const plain = stripTags(html);
  const hits = plain.match(/\b(np\.|na przykład|przykład|for example|Messenger|WhatsApp|Bitcoin)\b/gi);
  return hits?.length ?? 0;
}

export function detectExpertMarkers(html: string): boolean {
  return /w praktyce|z doświadczenia|jako (prawnik|psycholog|detektyw)|nasz zespół|in my practice|typically we/i.test(
    stripTags(html),
  );
}

export type CtaStrength = 'strong' | 'soft' | 'weak' | 'none';

export function detectCtaStrength(html: string): CtaStrength {
  const tail = stripTags(html).slice(-1500);
  if (/skontaktuj się|umów|zadzwoń|napisz do nas|book a|call us now/i.test(tail)) return 'strong';
  if (/zgłoś|policj|112|prokuratur|może warto|rozważ/i.test(tail)) return 'soft';
  if (/kontakt|pomoc/i.test(tail)) return 'weak';
  return 'none';
}

function expectedFromExplainability(
  explainability: ExplainabilityRecord[],
): {
  opening?: string;
  examplesMin?: number;
  expertVoice?: string;
  cta?: string;
} {
  const out: {
    opening?: string;
    examplesMin?: number;
    expertVoice?: string;
    cta?: string;
  } = {};
  for (const r of explainability) {
    const [id, value] = r.decision.split(':');
    if (id === 'opening' && value) out.opening = value;
    if (id === 'examples_min' && value) {
      const n = parseInt(value, 10);
      if (Number.isFinite(n)) out.examplesMin = n;
    }
    if (id === 'expert_voice' && value) out.expertVoice = value;
    if (id === 'cta' && value) out.cta = value;
  }
  return out;
}

/** Build Expected→Observed compliance table from WIE decisions + HTML. */
export function evaluatePolicyCompliance(opts: {
  html: string;
  explainability: ExplainabilityRecord[];
}): PolicyComplianceResult {
  const expected = expectedFromExplainability(opts.explainability);
  const openingObs = detectOpeningStyle(opts.html);
  const examplesN = countConcreteExamples(opts.html);
  const expertOk = detectExpertMarkers(opts.html);
  const cta = detectCtaStrength(opts.html);

  const rows: PolicyComplianceRow[] = [];

  if (expected.opening) {
    const ok =
      expected.opening === 'problem_first'
        ? openingObs === 'problem_first'
        : expected.opening === 'definition_first'
          ? openingObs === 'definition_first'
          : openingObs !== 'unknown';
    rows.push({
      rule: 'Opening',
      expected: expected.opening,
      observed: openingObs,
      status: ok ? 'passed' : 'failed',
    });
  } else {
    rows.push({
      rule: 'Opening',
      expected: '(no policy)',
      observed: openingObs,
      status: 'unknown',
    });
  }

  const minEx = expected.examplesMin ?? 1;
  rows.push({
    rule: 'Examples',
    expected: `≥${minEx}`,
    observed: String(examplesN),
    status: examplesN >= minEx ? 'passed' : 'failed',
  });

  if (expected.expertVoice && /marker|use_markers|required/i.test(expected.expertVoice)) {
    rows.push({
      rule: 'Expert markers',
      expected: expected.expertVoice,
      observed: expertOk ? 'present' : 'missing',
      status: expertOk ? 'passed' : 'failed',
    });
  } else {
    rows.push({
      rule: 'Expert markers',
      expected: expected.expertVoice || 'optional',
      observed: expertOk ? 'present' : 'missing',
      status: expected.expertVoice ? (expertOk ? 'passed' : 'failed') : (expertOk ? 'passed' : 'unknown'),
    });
  }

  const ctaExpected = expected.cta || 'soft_or_strong';
  const ctaOk =
    cta === 'strong'
    || cta === 'soft'
    || (ctaExpected === 'soft' && cta !== 'none');
  rows.push({
    rule: 'CTA',
    expected: ctaExpected,
    observed: cta,
    status: cta === 'none' || cta === 'weak' ? 'failed' : ctaOk ? 'passed' : 'failed',
  });

  const passed = rows.filter((r) => r.status === 'passed').length;
  const failed = rows.filter((r) => r.status === 'failed').length;
  const unknown = rows.filter((r) => r.status === 'unknown').length;

  return {
    rows,
    passed,
    failed,
    unknown,
    has_violations: failed > 0,
  };
}

export function formatPolicyComplianceMarkdown(c: PolicyComplianceResult): string {
  const icon = (s: ComplianceStatus) => (s === 'passed' ? '✅' : s === 'failed' ? '❌' : '—');
  const lines = [
    '## Policy Compliance',
    '',
    '_Expected = WIE policy decision · Observed = detected in final HTML (Writer output)._',
    '',
    '| Rule | Expected | Observed | Status |',
    '| --- | --- | --- | --- |',
  ];
  for (const r of c.rows) {
    lines.push(`| ${r.rule} | ${r.expected} | ${r.observed} | ${icon(r.status)} ${r.status} |`);
  }
  lines.push(
    '',
    `Summary: **${c.passed} passed** · **${c.failed} failed** · ${c.unknown} unknown`
    + (c.has_violations ? ' · ⚠️ policy violated by output' : ''),
  );
  return lines.join('\n');
}
