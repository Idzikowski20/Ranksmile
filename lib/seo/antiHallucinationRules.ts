export const ANTI_HALLUCINATION_RULES = `
CRITICAL — DO NOT INVENT OR FABRICATE ANY OF THE FOLLOWING:
- Author names, credentials, bios, or qualifications
- Dates of publication, updates, or events
- Statistics, percentages, study results, or survey data
- Citations, references, or quotes from specific sources
- Company names, revenue figures, or business metrics
- Expert opinions or third-party endorsements
- Any factual claim that is not present in the input data

WHERE FACTS ARE MISSING, USE NEUTRAL PLACEHOLDERS:
- Author: <p><strong>Author:</strong> [Editor: insert author name and qualifications]</p>
- Date: <p><strong>Last updated:</strong> [Editor: insert update date]</p>
- Sources: <!-- [Editor: add 2-3 authoritative external links] -->
- Statistics: Instead of "According to a 2025 study by X..." write "Industry best practices suggest..."

DO NOT transform placeholders into real-sounding claims. Placeholders are REQUIRED when input data is missing.
`;
