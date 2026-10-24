export const USER_AGENT =
  'NomadCountryFactsGame/0.1 (https://github.com/dobostamas333/Nomad; dataset builder)';

/** fetch with a descriptive User-Agent (required by Wikimedia) and retries with backoff. */
export async function fetchWithRetry(
  url: string,
  init: RequestInit = {},
  { retries = 3, timeoutMs = 90_000 } = {},
): Promise<Response> {
  let lastError: unknown;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const res = await fetch(url, {
        ...init,
        headers: { 'User-Agent': USER_AGENT, ...(init.headers ?? {}) },
        signal: AbortSignal.timeout(timeoutMs),
      });
      if (res.ok) return res;
      // 4xx other than rate limiting will not get better by retrying.
      if (res.status < 500 && res.status !== 429) {
        throw new Error(`HTTP ${res.status} for ${url}: ${(await res.text()).slice(0, 300)}`);
      }
      lastError = new Error(`HTTP ${res.status} for ${url}`);
    } catch (err) {
      lastError = err;
      if (err instanceof Error && err.message.startsWith('HTTP 4')) throw err;
    }
    if (attempt < retries) await new Promise((r) => setTimeout(r, 2000 * 2 ** attempt));
  }
  throw lastError;
}

export async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  return (await fetchWithRetry(url, init)).json() as Promise<T>;
}

export async function fetchText(url: string, init?: RequestInit): Promise<string> {
  return (await fetchWithRetry(url, init)).text();
}

/** Minimal RFC 4180 CSV parser (quoted fields, escaped quotes). */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else quoted = false;
      } else field += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ',') {
      row.push(field);
      field = '';
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && text[i + 1] === '\n') i++;
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
    } else field += ch;
  }
  if (field !== '' || row.length) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}
