# Background deep analysis wizard — design

## Goal

Let users continue through the New Content wizard as soon as the deep-analysis article and job exist, while the analysis continues in the background. Replace the current animated pipeline presentation with a compact vertical list of job steps that matches Koala UI.

## Decisions

- Deep Analysis is no longer a blocking wizard step.
- The primary footer action becomes available only after both `articleId` and `jobId` are known.
- The action opens `/articles/content-type?articleId=<id>`; the existing wizard flow remains unchanged after that point.
- The analysis request and job continue in the background after navigation.
- The Content Editor remains locked while `useBackgroundDeepAnalysis` reports an active analysis and unlocks on completion.
- Reuse `WizardShell`, `WizardNextButton`, Koala `Spinner`, and Koala icons. Do not add a generic job-progress abstraction.
- Preserve the existing automatic transition to Content Type when a user stays on the page until completion.
- Preserve retry behavior after failure.

## Deep Analysis layout

The page contains:

1. The `Deep analysis` heading and short explanatory subtitle.
2. A vertical list of eight full-width status rows.
3. The standard New Content wizard footer with the `Content type` primary action.

Remove:

- the top status badge,
- the pipeline title and percentage,
- the circuit-board animation,
- the current-step caption,
- the progress bar,
- the completion alert.

There is no outer progress panel. Each step is its own bordered row, approximately 56 px high, with Koala semantic background, border, spacing, typography, and radius tokens. Rows have no Accept or Close actions.

## Step states

Each row contains one status glyph followed by the step label:

| State | Presentation |
|---|---|
| Pending | Neutral outlined circle |
| Running | Existing Koala `Spinner` from Figma node `3950:179134` |
| Complete | Green filled check-circle |
| Failed | Red filled error icon and inline error text |

The eight existing step labels and the current API stage-to-step mapping remain unchanged.

## Navigation and background behavior

The footer action is disabled before the backend emits the `created` event. Once the event provides `articleId` and `jobId`, the page persists the run as it does today and enables navigation.

Navigating away does not cancel the server-side job. Later wizard steps use the same article ID. When the user reaches the editor, its existing `useBackgroundDeepAnalysis` integration discovers and polls the active job. The editor remains read-only until the job reaches a terminal state, then refreshes the article and unlocks.

No new worker, queue, persistence format, or API endpoint is required.

## Failure handling

- Mark the failed row red when the API identifies a step.
- Show the existing error alert and `Try again` action beneath the list.
- Keep the footer action disabled when job creation failed and no resumable job exists.
- Retry clears the stored run and restores all rows to pending before starting a new request.
- Network errors during polling remain recoverable through the existing polling behavior.

## Accessibility

- The running spinner retains its accessible status label and reduced-motion behavior.
- Step status is not communicated by color alone; every state has a distinct icon.
- Failure text remains visible next to the affected step and in the error alert.
- The disabled footer button communicates that the article job has not been created yet.

## Verification

- A page-level test proves the footer action is disabled before the `created` event, enabled afterward, and navigates to Content Type with the created article ID.
- A rendering test proves the status list uses pending, running, complete, and failed glyphs without the circuit board, status badge, percentage, or progress bar.
- Existing background-analysis hook tests continue to prove that the editor remains locked while the job is active and unlocks when it completes.
- TypeScript checks pass for all touched files.

## Out of scope

- Changing deep-analysis stages or their backend progress semantics.
- Allowing edits in the Content Editor before analysis finishes.
- Canceling a deep-analysis job when the user leaves the page.
- Building a reusable job-progress framework.
