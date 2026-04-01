export interface WhitelistEntry {
  raw: string;
  regex: RegExp;
}

let cacheKey = '';
let cached: WhitelistEntry[] = [];

export function compileWhitelist(patterns: string[]): WhitelistEntry[] {
  const key = patterns.join('\n');
  if (key === cacheKey) return cached;
  cacheKey = key;
  cached = patterns.map((p) => ({ raw: p, regex: new RegExp(p) }));
  return cached;
}

export function matchesWhitelist(url: string, patterns: string[]): boolean {
  if (!patterns.length) return false;
  const list = compileWhitelist(patterns);
  return list.some(({ regex }) => regex.test(url));
}
