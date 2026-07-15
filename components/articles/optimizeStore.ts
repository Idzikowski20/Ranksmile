import type { StepFocus, EditMode } from '../../lib/optimizationPlanner';

export type SectionResult = {
   oldHtml: string;
   newHtml: string;
   changed: boolean;
   scores?: { seo: number; overall: number; ai: number };
   adjustments?: Array<{ type: string; snippet: string; sourceDomains: string[] }>;
   focus?: StepFocus;
   mode?: EditMode;
   reason?: string;
};

const store = new Map<string, SectionResult>();
let onDocSync: (() => void) | null = null;
let runController: AbortController | null = null;

/** App-side store for Auto-Optimize section old/new HTML — keeps the ProseMirror doc light. */
export const optimizeStore = {
   set: (id: string, r: SectionResult) => { store.set(id, r); },
   get: (id: string): SectionResult | undefined => store.get(id),
   has: (id: string) => store.has(id),
   /** Start a new AO run — aborts any previous in-flight request. */
   beginRun: (): AbortSignal => {
      if (runController) runController.abort();
      runController = new AbortController();
      return runController.signal;
   },
   cancelRun: () => {
      if (runController) {
         runController.abort();
         runController = null;
      }
   },
   getRunSignal: (): AbortSignal | undefined => runController?.signal,
   isRunAborted: (): boolean => runController?.signal.aborted ?? false,
   clear: () => {
      store.clear();
      onDocSync = null;
      if (runController) {
         runController.abort();
         runController = null;
      }
   },
   setOnDocSync: (fn: (() => void) | null) => { onDocSync = fn; },
   notifyDocChange: () => { onDocSync?.(); },
};
