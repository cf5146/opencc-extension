/** Whitelist pattern utilities with simple caching. */

export interface WhitelistEntry {
  raw: string;
  regex: RegExp;
}

let cacheKey = '';
let cached: WhitelistEntry[] = [];

export function compileWhitelist(patterns: string[]): WhitelistEntry[] {
  const key = JSON.stringify(patterns);
  if (key === cacheKey) return cached;
  cacheKey = key;
  cached = patterns.flatMap((raw) => {
    try {
      return [{ raw, regex: new RegExp(raw) }];
    } catch {
      return [];
    }
  });
  return cached;
}

export function matchesWhitelist(url: string, patterns: string[]): boolean {
  if (!patterns.length) return false;
  const list = compileWhitelist(patterns);
  return list.some(({ regex }) => regex.test(url));
}
