export type Params = Record<string, string>;
export const p = (params: Params, key: string, fallback = '—') => params[key] || fallback;
