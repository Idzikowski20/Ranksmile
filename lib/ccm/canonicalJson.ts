/** Deterministic JSON: sorted object keys recursively. Maps → sorted-key objects. */
export function canonicalJsonStringify(value: unknown): string {
  return JSON.stringify(sortKeys(value));
}

function sortKeys(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortKeys);
  if (value && typeof value === 'object') {
    if (value instanceof Map) {
      const obj: Record<string, unknown> = {};
      for (const k of [...value.keys()].sort()) {
        obj[String(k)] = sortKeys(value.get(k));
      }
      return obj;
    }
    const o = value as Record<string, unknown>;
    const out: Record<string, unknown> = {};
    for (const k of Object.keys(o).sort()) out[k] = sortKeys(o[k]);
    return out;
  }
  return value;
}
