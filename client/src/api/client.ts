const TOKEN_KEY = "ft.token";

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string | null) {
  if (token) localStorage.setItem(TOKEN_KEY, token);
  else localStorage.removeItem(TOKEN_KEY);
}

export async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers);
  if (!headers.has("Content-Type") && init.body) headers.set("Content-Type", "application/json");

  const token = getToken();
  if (token) headers.set("Authorization", `Bearer ${token}`);

  const apiBase = import.meta.env.VITE_API_URL ?? "";
  const res = await fetch(`${apiBase}/api${path}`, { ...init, headers });
  if (!res.ok) {
    let message = `HTTP ${res.status}`;
    try {
      const body = await res.json();
      message = body.error?.message ?? body.error ?? message;
      if (typeof message === "object") message = JSON.stringify(message);
    } catch {
      // ignore
    }
    if (res.status === 401) setToken(null);
    throw new Error(String(message));
  }
  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}
