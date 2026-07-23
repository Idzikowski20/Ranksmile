import type { CoverageSnapshot } from '../aiCoverage';
import type { ArticleContext } from '../articleContext';
import type { Feature, Observation } from './types';

export type FeatureContext = {
  snapshot?: CoverageSnapshot | null;
  articleContext?: ArticleContext | null;
  articleId?: string;
  observations?: Observation[];
  snapshotId?: string;
};

export type FeatureProducer = {
  id: string;
  produce: (ctx: FeatureContext) => Feature | null;
};

export type FeatureRegistration = {
  id: string;
  version: number;
  dependencies: string[];
  producer: FeatureProducer;
};

/**
 * Plugin-style registry so Coverage / Visibility / Audit / Entities / Links
 * register without changing the orchestrator.
 */
export class FeatureRegistry {
  private readonly byId = new Map<string, FeatureRegistration>();

  register(reg: FeatureRegistration): void {
    this.byId.set(reg.id, reg);
  }

  unregister(id: string): void {
    this.byId.delete(id);
  }

  has(id: string): boolean {
    return this.byId.has(id);
  }

  get(id: string): FeatureRegistration | undefined {
    return this.byId.get(id);
  }

  version(id: string): number | undefined {
    return this.byId.get(id)?.version;
  }

  dependencies(id: string): string[] {
    return this.byId.get(id)?.dependencies ?? [];
  }

  /** Topological-ish order: producers whose deps are already listed come first (simple pass). */
  list(): FeatureRegistration[] {
    const all = Array.from(this.byId.values());
    const ordered: FeatureRegistration[] = [];
    const seen = new Set<string>();
    let guard = all.length + 2;
    while (ordered.length < all.length && guard > 0) {
      guard -= 1;
      for (const reg of all) {
        if (seen.has(reg.id)) continue;
        if (reg.dependencies.every((d) => seen.has(d) || !this.byId.has(d))) {
          ordered.push(reg);
          seen.add(reg.id);
        }
      }
    }
    for (const reg of all) {
      if (!seen.has(reg.id)) ordered.push(reg);
    }
    return ordered;
  }

  producers(): FeatureProducer[] {
    return this.list().map((r) => r.producer);
  }
}

export const defaultFeatureRegistry = new FeatureRegistry();
