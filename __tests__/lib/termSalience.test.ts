import {
  computeTermSalienceScore,
  enrichTermsWithSalienceFromZones,
  termSalienceWeight,
  type SalienceZones,
} from '../../lib/termSalienceCore';
import { extractSalienceZones } from '../../lib/termSalience';

describe('termSalience', () => {
  const competitorHtml = `
    <html><body>
      <h1>Detektyw Warszawa</h1>
      <h2>Prywatny detektyw w stolicy</h2>
      <p>Biuro detektywistyczne oferuje uslugi.</p>
      <p><strong>prywatny detektyw</strong> moze pomoc w sprawach cywilnych.</p>
      <span style="font-weight: 700">biuro detektywistyczne</span>
    </body></html>
  `;

  it('extracts heading and bold zones from competitor HTML', () => {
    const zones = extractSalienceZones(competitorHtml);
    expect(zones.headings.toLowerCase()).toContain('prywatny detektyw');
    expect(zones.bold.toLowerCase()).toContain('prywatny detektyw');
    expect(zones.bold.toLowerCase()).toContain('biuro detektywistyczne');
    expect(zones.body.toLowerCase()).toContain('detektyw');
  });

  it('scores higher salience for terms in H2/bold vs body-only', () => {
    const zones: SalienceZones = {
      headings: 'prywatny detektyw warszawa',
      bold: 'prywatny detektyw',
      body: 'prywatny detektyw prywatny detektyw biuro detektywistyczne',
    };
    const prominent = computeTermSalienceScore('prywatny detektyw', [zones]);
    const bodyOnly = computeTermSalienceScore('biuro detektywistyczne', [{
      headings: '',
      bold: '',
      body: 'biuro detektywistyczne biuro detektywistyczne',
    }]);
    expect(prominent).toBeGreaterThan(bodyOnly);
    expect(prominent).toBeGreaterThanOrEqual(50);
  });

  it('boosts target_count for high-salience terms', () => {
    const zones: SalienceZones = {
      headings: 'prywatny detektyw prywatny detektyw',
      bold: 'prywatny detektyw',
      body: 'prywatny detektyw prywatny detektyw prywatny detektyw',
    };
    const [enriched] = enrichTermsWithSalienceFromZones(
      [{ term: 'prywatny detektyw', target_count: 4, suggested_min: 2, suggested_max: 6 }],
      [zones],
    );
    expect(enriched.salience).toBeGreaterThanOrEqual(70);
    expect(enriched.target_count).toBeGreaterThanOrEqual(5);
    expect(enriched.relevance).toBeGreaterThan(0.6);
  });

  it('weights high-salience terms more in scoring', () => {
    expect(termSalienceWeight({ salience: 90 })).toBeGreaterThan(termSalienceWeight({ salience: 20 }));
    expect(termSalienceWeight({ salience: 50 })).toBe(1);
  });
});
