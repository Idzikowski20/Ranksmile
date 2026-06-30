// Thin logging facade. Today it delegates to console; swapping in Sentry / Logtail /
// Datadog later is a ONE-file change instead of a codebase-wide console.* find-replace.
type Fields = Record<string, unknown>;
const fmt = (msg: string, fields?: Fields) => (fields ? `${msg} ${JSON.stringify(fields)}` : msg);

export const logger = {
  info: (msg: string, fields?: Fields) => console.info(fmt(msg, fields)),
  warn: (msg: string, fields?: Fields) => console.warn(fmt(msg, fields)),
  error: (msg: string, fields?: Fields) => console.error(fmt(msg, fields)),
};
