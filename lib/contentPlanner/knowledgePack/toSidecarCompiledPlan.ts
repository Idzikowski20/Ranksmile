import type { CompiledWritePlan } from './types';

function toSnakeCase(key: string): string {
  return key.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`);
}

function deepSnakeCase(value: unknown): unknown {
  if (value === null || typeof value !== 'object') {
    return value;
  }
  if (Array.isArray(value)) {
    return value.map(deepSnakeCase);
  }
  const obj = value as Record<string, unknown>;
  const out: Record<string, unknown> = {};
  for (const [key, val] of Object.entries(obj)) {
    out[toSnakeCase(key)] = deepSnakeCase(val);
  }
  return out;
}

// eslint-disable-next-line import/prefer-default-export
export function toSidecarCompiledPlan(plan: CompiledWritePlan): Record<string, unknown> {
  return deepSnakeCase(plan) as Record<string, unknown>;
}
