export type JsonInit = Omit<RequestInit, 'cache'> & { cache?: 'no-store' | 'force-cache' };

export type JsonResponse<T = any> = {
  ok: boolean;
  status: number;
  data: T;
  headers: Headers;
};

export async function fetchJson<T = any>(url: string, init: JsonInit = {}): Promise<JsonResponse<T>> {
  const response = await fetch(url, { cache: 'no-store', ...init } as RequestInit);
  const data = (await response.json().catch(() => null)) as T;
  return { ok: response.ok, status: response.status, data, headers: response.headers };
}
