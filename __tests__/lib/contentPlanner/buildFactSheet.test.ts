import { buildFactSheet } from '@/src/infrastructure/contentPlanner/briefWriter';
import type { TargetClaim } from '@/src/core/domain/contentPlanner/types';

function claim(over: Partial<TargetClaim> & { id: string }): TargetClaim {
  return {
    statement: `Statement ${over.id}`,
    topic: 'Koszty',
    type: 'fact',
    importance: 'required',
    gainClass: 'expected',
    priority: 'medium',
    sources: [],
    ...over,
  } as TargetClaim;
}

/** Sheet line -> the facts it lists, so assertions read as data not string matching. */
function parse(sheet: string): Array<[string, string[]]> {
  return sheet.split('\n').filter(Boolean).map((line) => {
    const at = line.indexOf(': ');
    return [line.slice(0, at), line.slice(at + 2).split(' | ')] as [string, string[]];
  });
}

describe('buildFactSheet ordering and cap', () => {
  /**
   * Without the sort, upstream profile iteration order decided which claims survived
   * the cut, so the same claims in a different order produced a different sheet.
   */
  it('puts stats first, then priority, then id — regardless of input order', () => {
    const claims: TargetClaim[] = [
      claim({ id: 'z-low', priority: 'low' }),
      claim({ id: 'b-critical', priority: 'critical' }),
      claim({ id: 'a-stat-low', type: 'stat', priority: 'low' }),
      claim({ id: 'a-critical', priority: 'critical' }),
      claim({ id: 'z-stat-critical', type: 'stat', priority: 'critical' }),
    ];

    const facts = parse(buildFactSheet(claims))[0][1];

    expect(facts).toEqual([
      'Statement z-stat-critical', // stat beats everything, critical beats low
      'Statement a-stat-low', // still a stat, so ahead of every non-stat
      'Statement a-critical', // critical before medium/low; id breaks the tie
      'Statement b-critical',
      'Statement z-low',
    ]);
  });

  it('reordering the input does not change the sheet', () => {
    const claims: TargetClaim[] = [
      claim({ id: 'c3', priority: 'high' }),
      claim({ id: 'c1', type: 'stat', priority: 'low' }),
      claim({ id: 'c2', priority: 'high' }),
    ];

    expect(buildFactSheet(claims)).toBe(buildFactSheet([...claims].reverse()));
  });

  it('caps the sheet at 30 facts, keeping the highest-ranked ones', () => {
    const claims: TargetClaim[] = Array.from({ length: 40 }, (_, i) => claim({
      id: `c${String(i).padStart(2, '0')}`,
      priority: i === 39 ? 'critical' : 'low',
    }));

    const facts = parse(buildFactSheet(claims))[0][1];

    expect(facts).toHaveLength(30);
    // The one critical claim sits last in input order but must survive the slice.
    expect(facts[0]).toBe('Statement c39');
    expect(facts).not.toContain('Statement c38');
  });
});

describe('buildFactSheet topic grouping', () => {
  it('keeps topics that several facts share', () => {
    const sheet = parse(buildFactSheet([
      claim({ id: 'a', topic: 'Koszty', statement: 'Licencja kosztuje 600 zl.' }),
      claim({ id: 'b', topic: 'Koszty', statement: 'Egzamin kosztuje 400 zl.' }),
      claim({ id: 'c', topic: 'Wymagania', statement: 'Wymagana jest niekaralnosc.' }),
      claim({ id: 'd', topic: 'Wymagania', statement: 'Wymagany jest wiek 21 lat.' }),
    ]));

    expect(sheet.map(([topic]) => topic)).toEqual(['Koszty', 'Wymagania']);
  });

  /**
   * On the legacy knowledge path `topic` is a prefix of the claim's own statement, so
   * every claim became its own one-fact heading and the sheet read as a list of labels
   * each repeating the first words of the line below it.
   */
  it('folds one-fact groups whose label is just the head of their own statement', () => {
    const sheet = parse(buildFactSheet([
      claim({ id: 'a', topic: 'Licencja detektywistyczna wymaga', statement: 'Licencja detektywistyczna wymaga egzaminu panstwowego.' }),
      claim({ id: 'b', topic: 'Wpis do rejestru', statement: 'Wpis do rejestru trwa 30 dni.' }),
      claim({ id: 'c', topic: 'Koszty', statement: 'Oplata wynosi 600 zl.' }),
      claim({ id: 'd', topic: 'Koszty', statement: 'Egzamin kosztuje 400 zl.' }),
    ]));

    // Only the genuinely shared topic stays a group; the two prefix labels merge.
    expect(sheet.map(([topic]) => topic)).toEqual(['Koszty', 'inne']);
    expect(sheet.find(([t]) => t === 'inne')?.[1]).toEqual([
      'Licencja detektywistyczna wymaga egzaminu panstwowego.',
      'Wpis do rejestru trwa 30 dni.',
    ]);
  });

  it('claims without a topic land in inne', () => {
    const sheet = parse(buildFactSheet([
      claim({ id: 'a', topic: '', statement: 'Fakt bez tematu.' }),
      claim({ id: 'b', topic: 'Koszty', statement: 'Oplata wynosi 600 zl.' }),
      claim({ id: 'c', topic: 'Koszty', statement: 'Egzamin kosztuje 400 zl.' }),
    ]));

    expect(sheet.map(([topic]) => topic)).toEqual(['Koszty', 'inne']);
    expect(sheet.find(([t]) => t === 'inne')?.[1]).toEqual(['Fakt bez tematu.']);
  });
});
