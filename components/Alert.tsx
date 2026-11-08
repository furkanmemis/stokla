export type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export function param(v: string | string[] | undefined): string | undefined {
  return Array.isArray(v) ? v[0] : v;
}

export function Alert({ error, info }: { error?: string; info?: string }) {
  if (error) return <div className="alert err" role="alert">{error}</div>;
  if (info) return <div className="alert ok" role="status">{info}</div>;
  return null;
}
