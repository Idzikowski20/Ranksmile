/**
 * Client helpers for persisting / clearing New-Content wizard progress so an
 * unfinished draft can be resumed from the Content Editor. No-ops without an id.
 */
export async function saveWizardState(articleId: string, patch: Record<string, unknown>): Promise<void> {
   if (!articleId) return;
   try {
      await fetch(`/api/articles/${articleId}/wizard-state`, {
         method: 'POST',
         headers: { 'Content-Type': 'application/json' },
         body: JSON.stringify({ patch }),
      });
   } catch { /* best-effort */ }
}

export async function clearWizardState(articleId: string): Promise<void> {
   if (!articleId) return;
   try {
      await fetch(`/api/articles/${articleId}/wizard-state`, {
         method: 'POST',
         headers: { 'Content-Type': 'application/json' },
         body: JSON.stringify({ clear: true }),
      });
   } catch { /* best-effort */ }
}
