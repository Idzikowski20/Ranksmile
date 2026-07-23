/**
 * Regression: pipeline workers must not load database/database.ts before DATABASE_URL
 * is set — otherwise Sequelize falls back to SQLite while Next writes Neon jobs.
 */
describe('pipeline-workers env bootstrap', () => {
  it('documents that database.ts binds dialect at module load from DATABASE_URL', () => {
    // Static contract — if this file is refactored, keep dotenv BEFORE db imports.
    // scripts/pipeline-workers.ts uses dynamic import() after dotenv.config().
    const fs = require('fs') as typeof import('fs');
    const path = require('path') as typeof import('path');
    const src = fs.readFileSync(
      path.join(__dirname, '../../scripts/pipeline-workers.ts'),
      'utf8',
    );
    const dotenvIdx = src.indexOf("dotenv.config({ path: '.env.local' })");
    const dynamicDbIdx = src.indexOf("await import('../lib/ensurePipelineJobsTables')");
    const staticDbImport = /import\s+\{[^}]*insertPipelineJob[^}]*\}\s+from\s+['"]\.\.\/lib\/ensurePipelineJobsTables['"]/.test(
      src,
    );

    expect(dotenvIdx).toBeGreaterThan(-1);
    expect(dynamicDbIdx).toBeGreaterThan(dotenvIdx);
    expect(staticDbImport).toBe(false);
    expect(src).toMatch(/DATABASE_URL is missing/);
  });
});
