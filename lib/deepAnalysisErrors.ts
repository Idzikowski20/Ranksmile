export function publicDeepAnalysisError(
  rawError: string | null | undefined,
  currentStage?: string | null,
): string {
  if (rawError === 'superseded') return 'Analysis was superseded by a newer run.';
  if (rawError === 'Pipeline timed out after 180s' || rawError === 'finalizing timed out') {
    return 'Analysis timed out. Please try again.';
  }
  if (currentStage === 'fetch_page') return "Couldn't fetch this page. Check the URL and try again.";
  if (currentStage === 'scrape_serp') return "Couldn't analyze search results. Please try again.";
  if (currentStage === 'finalizing') return "Couldn't save the analysis results. Please try again.";
  return 'Deep analysis failed. Please try again.';
}
