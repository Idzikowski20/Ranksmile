const i18n = { translate: (s: string) => s };
let _i18n: typeof i18n | null = i18n;

export function setLocale(_data: unknown) {
  _i18n = i18n;
}

export function t(str: string, ..._args: unknown[]): string {
  return str;
}

export function tn(singular: string, _plural: string, ..._args: unknown[]): string {
  return singular;
}

export function tct(template: string, _components?: Record<string, React.ReactNode>): string {
  return template;
}

export function td(str: string): string {
  return str;
}
