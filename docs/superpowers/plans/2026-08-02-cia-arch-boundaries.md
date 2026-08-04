# CIA Architecture Boundaries Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Enforce Content Intelligence Architecture folder boundaries and forbidden imports with Jest architecture tests + ESLint `no-restricted-imports`, so projections/planner/judge cannot take HTML/adapter shortcuts before CCM types exist.

**Architecture:** Introduce `lib/cia/` as the boundary kernel (zone map + static import scanner). Scaffold empty zone packages (`lib/ccm`, `lib/compiler`, `lib/projections`, `lib/planner`, `lib/intelligence`) with barrel placeholders. Tests fail CI if a file under a consumer zone imports banned modules. No Fact Engine, no PassManager runtime, no new npm dependencies.

**Tech Stack:** TypeScript, Jest (`test:ci`), existing ESLint `no-restricted-imports` pattern from `.eslintrc.json` (Koala overrides), Node `fs` recursive scan.

**Spec:** `docs/superpowers/specs/2026-08-02-content-intelligence-architecture/21-architecture-tests.md`, ADR-001/025/035/037, `FREEZE.md` Etap 4.

---

## File map

| File | Responsibility |
|------|----------------|
| `docs/superpowers/specs/.../BOUNDARIES.md` | Human zone map (who may import whom) |
| `lib/cia/zones.ts` | Zone id → glob roots + allow/deny rules |
| `lib/cia/scanImports.ts` | Parse `from '…'` / `from "…"` / `require('…')` from TS files |
| `lib/cia/checkBoundaries.ts` | Evaluate violations for a zone |
| `__tests__/architecture/cia-boundaries.test.ts` | Arch tests (fail on violations) |
| `lib/ccm/index.ts` | Scaffold barrel (re-export stub later filled by types plan) |
| `lib/compiler/index.ts` | Scaffold |
| `lib/projections/index.ts` | Scaffold |
| `lib/planner/index.ts` | Scaffold |
| `lib/intelligence/index.ts` | Scaffold |
| `.eslintrc.json` | Overrides for CIA zones |
| `package.json` | Optional script `test:arch` → jest arch file |

**Out of scope:** `lib/types/ccm.ts` full model (next plan `cia-types-ccm`), compiler pipeline, adapters, AO wiring.

---

### Task 1: BOUNDARIES.md

**Files:**
- Create: `docs/superpowers/specs/2026-08-02-content-intelligence-architecture/BOUNDARIES.md`

- [ ] **Step 1: Write the boundary map**

```markdown
# CIA import boundaries (v1)

Frozen with RFC v1.0. Enforced by `__tests__/architecture/cia-boundaries.test.ts`.

## Zones

| Zone | Path prefix | May import | Must NOT import |
|------|-------------|------------|-----------------|
| `ccm` | `lib/ccm/` | `lib/cia/`, `lib/types/` (future ccm types) | `cheerio`, `jsdom`, `lib/engines/coverageEngine`, adapter helpers |
| `compiler` | `lib/compiler/` | `lib/ccm/`, `lib/cia/`, TipTap types, heuristics | `lib/ao/`, `lib/wie/` (consumers) |
| `projections` | `lib/projections/` | `lib/ccm/`, `lib/cia/` | HTML parsers, `lib/engines/coverageEngine` as SoT, `coverageSnapshotToKg` |
| `planner` | `lib/planner/` | `lib/ccm/`, `lib/cia/`, projections types only | adapter `coverageSnapshot*`, HTML parsers |
| `intelligence` | `lib/intelligence/` | `lib/ccm/`, `lib/cia/`, `lib/projections/` (peer results) | compiler adapter, HTML fact extract |
| `legacy-bridge` | *(none yet)* | migration tests only | production planner/projections |

## Allowlisted HTML touch (ADR-001)

Only outside these zones (or future `lib/compiler/lexer/`): renderer, export, editor, presentation-policy allowlist. Not projections/planner/intelligence.

## Adapter rule (ADR-025)

Any `coverageSnapshotToKg` / snapshot→CCM helper lives under `lib/ccm/migration/` and may be imported only from `__tests__/**` and migration scripts — never from `lib/projections|planner|intelligence|ao|wie`.
```

- [ ] **Step 2: Link from CIA README**

In `docs/superpowers/specs/2026-08-02-content-intelligence-architecture/README.md` add under Read order:

```markdown
- [BOUNDARIES.md](./BOUNDARIES.md) — import firewall
```

- [ ] **Step 3: Commit** (only if user asked)

```bash
git add docs/superpowers/specs/2026-08-02-content-intelligence-architecture/BOUNDARIES.md docs/superpowers/specs/2026-08-02-content-intelligence-architecture/README.md
git commit -m "docs(cia): add import BOUNDARIES map for arch tests"
```

---

### Task 2: Zone constants + import scanner (TDD)

**Files:**
- Create: `lib/cia/zones.ts`
- Create: `lib/cia/scanImports.ts`
- Create: `__tests__/architecture/cia-boundaries.test.ts`

- [ ] **Step 1: Write failing tests for scanner + forbidden pattern helpers**

```ts
/** @jest-environment node */
import path from 'path';
import { extractImportSpecifiers } from '../../../lib/cia/scanImports';
import { CIA_ZONES, isForbiddenImport } from '../../../lib/cia/zones';

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
```

- [ ] **Step 2: Run — expect FAIL**

Run: `npx jest __tests__/architecture/cia-boundaries.test.ts --ci`

Expected: FAIL — modules missing

- [ ] **Step 3: Implement `lib/cia/scanImports.ts`**

```ts
const IMPORT_RE =
  /(?:import\s+(?:type\s+)?(?:[\s\S]*?)\s+from\s*|export\s+[\s\S]*?\s+from\s*|require\s*\(\s*)['"]([^'"]+)['"]/g;

export function extractImportSpecifiers(source: string): string[] {
  const out = new Set<string>();
  // Strip block comments lightly to reduce false positives
  const stripped = source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
  let m: RegExpExecArray | null;
  const re = new RegExp(IMPORT_RE.source, 'g');
  while ((m = re.exec(stripped)) !== null) {
    out.add(m[1]);
  }
  return [...out];
}
```

- [ ] **Step 4: Implement `lib/cia/zones.ts`**

```ts
export type CiaZoneId = 'ccm' | 'compiler' | 'projections' | 'planner' | 'intelligence';

export type CiaZone = {
  readonly id: CiaZoneId;
  /** Repo-relative path prefix using forward slashes, e.g. lib/projections/ */
  readonly root: string;
  readonly forbiddenSubstrings: readonly string[];
};

export const CIA_ZONES: readonly CiaZone[] = [
  {
    id: 'ccm',
    root: 'lib/ccm/',
    forbiddenSubstrings: ['cheerio', 'jsdom', 'engines/coverageEngine', 'coverageSnapshotToKg'],
  },
  {
    id: 'compiler',
    root: 'lib/compiler/',
    forbiddenSubstrings: ['cheerio', 'jsdom', '/lib/ao/', '/lib/wie/', 'engines/coverageEngine'],
  },
  {
    id: 'projections',
    root: 'lib/projections/',
    forbiddenSubstrings: [
      'cheerio',
      'jsdom',
      'engines/coverageEngine',
      'coverageSnapshotToKg',
      'coverageSnapshotToCcm',
      'buildCoverageSnapshot',
      'aiCoverageJudge',
    ],
  },
  {
    id: 'planner',
    root: 'lib/planner/',
    forbiddenSubstrings: [
      'cheerio',
      'jsdom',
      'coverageSnapshotToKg',
      'coverageSnapshotToCcm',
      'engines/coverageEngine',
      'aiCoverageJudge',
    ],
  },
  {
    id: 'intelligence',
    root: 'lib/intelligence/',
    forbiddenSubstrings: [
      'cheerio',
      'jsdom',
      'coverageSnapshotToKg',
      'coverageSnapshotToCcm',
      'engines/coverageEngine',
      'aiCoverageJudge',
    ],
  },
] as const;

function normalizeSpec(spec: string): string {
  return spec.replace(/\\/g, '/');
}

/** True if this import specifier is banned for the zone. */
export function isForbiddenImport(zoneId: CiaZoneId, specifier: string): boolean {
  const zone = CIA_ZONES.find((z) => z.id === zoneId);
  if (!zone) return false;
  const s = normalizeSpec(specifier);
  return zone.forbiddenSubstrings.some((frag) => s.includes(frag));
}
```

- [ ] **Step 5: Run tests — expect PASS for unit cases** (filesystem scan may be empty still)

Run: `npx jest __tests__/architecture/cia-boundaries.test.ts --ci`

Expected: PASS for the tests above

- [ ] **Step 6: Commit** (only if user asked)

```bash
git add lib/cia/zones.ts lib/cia/scanImports.ts __tests__/architecture/cia-boundaries.test.ts
git commit -m "feat(cia): zone rules and import scanner for architecture tests"
```

---

### Task 3: Filesystem boundary check

**Files:**
- Create: `lib/cia/checkBoundaries.ts`
- Modify: `__tests__/architecture/cia-boundaries.test.ts`

- [ ] **Step 1: Add failing test for repo scan API**

```ts
import { findCiaBoundaryViolations } from '../../../lib/cia/checkBoundaries';

describe('findCiaBoundaryViolations', () => {
  it('returns an array (empty while zone dirs only have barrels)', () => {
    const violations = findCiaBoundaryViolations(process.cwd());
    expect(Array.isArray(violations)).toBe(true);
    // Each violation shape
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

  it('detects a synthetic violation when given inline fixture via checkSource', () => {
    const { checkSourceAgainstZone } = require('../../../lib/cia/checkBoundaries') as typeof import('../../../lib/cia/checkBoundaries');
    const hits = checkSourceAgainstZone('projections', 'import x from "cheerio";\n');
    expect(hits).toEqual([{ specifier: 'cheerio' }]);
  });
});
```

Prefer named export only (no require) — use:

```ts
import { findCiaBoundaryViolations, checkSourceAgainstZone } from '../../../lib/cia/checkBoundaries';
```

- [ ] **Step 2: Run — expect FAIL**

Run: `npx jest __tests__/architecture/cia-boundaries.test.ts --ci`

Expected: FAIL — `checkBoundaries` missing

- [ ] **Step 3: Implement `lib/cia/checkBoundaries.ts`**

```ts
import fs from 'fs';
import path from 'path';
import { extractImportSpecifiers } from './scanImports';
import { CIA_ZONES, isForbiddenImport, type CiaZoneId } from './zones';

export type BoundaryViolation = {
  readonly zoneId: CiaZoneId;
  readonly file: string;
  readonly specifier: string;
};

export function checkSourceAgainstZone(
  zoneId: CiaZoneId,
  source: string,
): readonly { specifier: string }[] {
  return extractImportSpecifiers(source)
    .filter((spec) => isForbiddenImport(zoneId, spec))
    .map((specifier) => ({ specifier }));
}

function walkTsFiles(dir: string, acc: string[]): void {
  if (!fs.existsSync(dir)) return;
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, ent.name);
    if (ent.isDirectory()) {
      if (ent.name === 'node_modules' || ent.name === 'migration') {
        // migration/ under ccm allowed to exist; still scanned unless we skip:
        // Skip only lib/ccm/migration for consumer rules — still scan it for ccm zone denylist.
      }
      walkTsFiles(p, acc);
      continue;
    }
    if (/\.(ts|tsx)$/.test(ent.name) && !ent.name.endsWith('.d.ts')) acc.push(p);
  }
}

export function findCiaBoundaryViolations(repoRoot: string): BoundaryViolation[] {
  const out: BoundaryViolation[] = [];
  for (const zone of CIA_ZONES) {
    const abs = path.join(repoRoot, ...zone.root.split('/').filter(Boolean));
    const files: string[] = [];
    walkTsFiles(abs, files);
    for (const file of files) {
      const source = fs.readFileSync(file, 'utf8');
      for (const { specifier } of checkSourceAgainstZone(zone.id, source)) {
        out.push({
          zoneId: zone.id,
          file: path.relative(repoRoot, file).replace(/\\/g, '/'),
          specifier,
        });
      }
    }
  }
  return out;
}
```

- [ ] **Step 4: Assert zero violations in CI test**

Add:

```ts
  it('has zero boundary violations in lib cia zones', () => {
    const violations = findCiaBoundaryViolations(process.cwd());
    expect(violations).toEqual([]);
  });
```

- [ ] **Step 5: Run — expect PASS**

Run: `npx jest __tests__/architecture/cia-boundaries.test.ts --ci`

Expected: PASS

- [ ] **Step 6: Commit** (only if user asked)

```bash
git add lib/cia/checkBoundaries.ts __tests__/architecture/cia-boundaries.test.ts
git commit -m "feat(cia): filesystem boundary checker with zero-violation gate"
```

---

### Task 4: Scaffold zone packages

**Files:**
- Create: `lib/ccm/index.ts`
- Create: `lib/compiler/index.ts`
- Create: `lib/projections/index.ts`
- Create: `lib/planner/index.ts`
- Create: `lib/intelligence/index.ts`
- Create: `lib/cia/index.ts`

- [ ] **Step 1: Write barrels (no `any`)**

`lib/cia/index.ts`:

```ts
export { CIA_ZONES, isForbiddenImport } from './zones';
export type { CiaZone, CiaZoneId } from './zones';
export { extractImportSpecifiers } from './scanImports';
export {
  checkSourceAgainstZone,
  findCiaBoundaryViolations,
} from './checkBoundaries';
export type { BoundaryViolation } from './checkBoundaries';
```

Each zone `index.ts`:

```ts
/**
 * CIA zone scaffold — types/impl land in follow-up plans (cia-types-ccm, compiler skeleton).
 * Do not put HTML parsers or coverageSnapshot adapters here.
 */
export {};
```

- [ ] **Step 2: Re-run arch tests**

Run: `npx jest __tests__/architecture/cia-boundaries.test.ts --ci`

Expected: PASS

- [ ] **Step 3: Commit** (only if user asked)

```bash
git add lib/cia/index.ts lib/ccm/index.ts lib/compiler/index.ts lib/projections/index.ts lib/planner/index.ts lib/intelligence/index.ts
git commit -m "chore(cia): scaffold ccm/compiler/projections/planner/intelligence zones"
```

---

### Task 5: ESLint overrides for CIA zones

**Files:**
- Modify: `.eslintrc.json`

- [ ] **Step 1: Add override block** (same style as Koala) after existing overrides array entries:

```json
{
  "files": [
    "lib/projections/**/*.{ts,tsx}",
    "lib/planner/**/*.{ts,tsx}",
    "lib/intelligence/**/*.{ts,tsx}"
  ],
  "rules": {
    "no-restricted-imports": ["error", {
      "patterns": [
        {
          "group": ["cheerio", "cheerio/*", "jsdom", "jsdom/*"],
          "message": "CIA ADR-001: projections/planner/intelligence must not parse HTML — use CCM + GraphQuery."
        },
        {
          "group": [
            "**/engines/coverageEngine",
            "**/engines/coverageEngine.*",
            "**/coverageSnapshotToKg*",
            "**/coverageSnapshotToCcm*",
            "**/aiCoverageJudge*",
            "**/buildCoverageSnapshot*"
          ],
          "message": "CIA ADR-025/035: no coverage engine/adapter/judge SoT imports in consumer zones."
        }
      ]
    }]
  }
}
```

Also for `lib/compiler/**/*` restrict imports from `**/lib/ao/**` and `**/lib/wie/**` via patterns:

```json
{
  "files": ["lib/compiler/**/*.{ts,tsx}"],
  "rules": {
    "no-restricted-imports": ["error", {
      "patterns": [
        {
          "group": ["**/lib/ao/**", "**/ao/**", "**/lib/wie/**", "**/wie/**"],
          "message": "CIA: compiler must not depend on AO/WIE consumers."
        }
      ]
    }]
  }
}
```

- [ ] **Step 2: Sanity lint on scaffold**

Run: `npx eslint lib/projections/index.ts lib/planner/index.ts lib/compiler/index.ts`

Expected: exit 0

- [ ] **Step 3: Commit** (only if user asked)

```bash
git add .eslintrc.json
git commit -m "chore(eslint): restrict HTML/adapter imports in CIA consumer zones"
```

---

### Task 6: npm script + CI hook documentation

**Files:**
- Modify: `package.json` scripts
- Modify: `docs/superpowers/specs/2026-08-02-content-intelligence-architecture/21-architecture-tests.md`
- Modify: `docs/superpowers/specs/2026-08-02-content-intelligence-architecture/FREEZE.md` (mark Etap 4 in progress / done when plan executed)

- [ ] **Step 1: Add script**

In `package.json` `"scripts"`:

```json
"test:arch": "jest __tests__/architecture/cia-boundaries.test.ts --ci"
```

- [ ] **Step 2: Update 21-architecture-tests.md freeze gate checkboxes to done after implementation**

```markdown
## Freeze gate

- [x] Boundary map written (`BOUNDARIES.md`)
- [x] Arch tests: `__tests__/architecture/cia-boundaries.test.ts` + `npm run test:arch`
```

- [ ] **Step 3: Run full arch script**

Run: `npm run test:arch`

Expected: PASS

- [ ] **Step 4: Commit** (only if user asked)

```bash
git add package.json docs/superpowers/specs/2026-08-02-content-intelligence-architecture/21-architecture-tests.md docs/superpowers/specs/2026-08-02-content-intelligence-architecture/FREEZE.md
git commit -m "chore(cia): add test:arch script and mark architecture-test gate"
```

---

## Self-review

| Spec (21 / ADR) | Task |
|-----------------|------|
| Boundary map | Task 1 |
| coverage/visibility/planner no HTML | Tasks 2–3, 5 |
| planner no adapter | Tasks 2–3, 5 |
| no coverageEngine SoT in consumers | Tasks 2–3, 5 |
| arch test file path | Tasks 2–3 |
| Folder ownership scaffold | Task 4 |
| No Fact Engine / types yet | Out of scope ✓ |

**Placeholder scan:** clean.  
**Next plan:** `docs/superpowers/plans/2026-08-02-cia-types-ccm.md` — CCM/IR/DSL TypeScript types + serialize round-trip (empty graphs), still no Fact extraction.

---

## Execution handoff

Plan saved to `docs/superpowers/plans/2026-08-02-cia-arch-boundaries.md`.

**1. Subagent-Driven (recommended)** — fresh subagent per task  
**2. Inline Execution** — this session with executing-plans  

Which approach?
