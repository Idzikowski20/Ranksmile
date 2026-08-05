import { readFileSync } from 'fs';
import { join } from 'path';

it('maps raw sidecar and terminal errors before writing Deep Analysis SSE', () => {
  const source = readFileSync(join(process.cwd(), 'pages/api/articles/deep-analysis.ts'), 'utf8');

  expect(source).toContain("import { publicDeepAnalysisError } from '../../../lib/deepAnalysisErrors';");
  expect(source).toContain("console.error('[deep-analysis] sidecar error:', errText);");
  expect(source).toContain('replacements: [errText, jobId]');
  expect(source).toContain("console.error('[deep-analysis] sidecar error:', errorMessage);");
  expect(source).toContain('replacements: [errorMessage, jobId]');
  expect(source).toContain("message: publicDeepAnalysisError(errText)");
  expect(source).toContain("message: publicDeepAnalysisError(errorMessage)");
  expect(source).not.toContain("message: errText");
  expect(source).not.toContain("message: errorMessage");
});
