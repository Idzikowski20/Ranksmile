/** @jest-environment node */
import {
  checkSourceAgainstZone,
  findCiaBoundaryViolations,
} from '../../lib/cia/checkBoundaries';
import { findIndexAccessViolations } from '../../lib/cia/checkIndexAccess';
import { extractImportSpecifiers } from '../../lib/cia/scanImports';
import { CIA_ZONES, isForbiddenImport } from '../../lib/cia/zones';

describe('extractImportSpecifiers', () => {
  it('extracts esm and require specifiers', () => {
    const src = `
      import x from 'cheerio';
      import { y } from "../ccm/foo";
      const z = require('jsdom');
    `;
    expect(extractImportSpecifiers(src).sort()).toEqual(['../ccm/foo', 'cheerio', 'jsdom'].sort());
  });
});

describe('isForbiddenImport', () => {
  it('flags cheerio inside projections', () => {
    expect(isForbiddenImport('projections', 'cheerio')).toBe(true);
    expect(isForbiddenImport('projections', 'lib/ccm/index')).toBe(false);
  });

  it('flags coverageEngine as SoT inside projections', () => {
    expect(isForbiddenImport('projections', '../../engines/coverageEngine')).toBe(true);
  });

  it('flags adapter name inside planner', () => {
    expect(isForbiddenImport('planner', '../ccm/migration/coverageSnapshotToCcm')).toBe(true);
  });
});

describe('CIA_ZONES', () => {
  it('defines required zone roots', () => {
    expect(CIA_ZONES.map((z) => z.id).sort()).toEqual(
      ['ccm', 'compiler', 'intelligence', 'planner', 'projections'].sort(),
    );
  });
});

describe('findCiaBoundaryViolations', () => {
  it('returns an array (empty while zone dirs only have barrels)', () => {
    const violations = findCiaBoundaryViolations(process.cwd());
    expect(Array.isArray(violations)).toBe(true);
    for (const v of violations) {
      expect(v).toEqual(
        expect.objectContaining({
          zoneId: expect.any(String),
          file: expect.any(String),
          specifier: expect.any(String),
        }),
      );
    }
  });

  it('detects a synthetic violation via checkSourceAgainstZone', () => {
    const hits = checkSourceAgainstZone('projections', 'import x from "cheerio";\n');
    expect(hits).toEqual([{ specifier: 'cheerio' }]);
  });

  it('has zero boundary violations in lib cia zones', () => {
    const violations = findCiaBoundaryViolations(process.cwd());
    expect(violations).toEqual([]);
  });
});

describe('GraphQuery index access firewall', () => {
  it('consumers must not touch knowledge.indexes directly', () => {
    expect(findIndexAccessViolations(process.cwd())).toEqual([]);
  });
});
