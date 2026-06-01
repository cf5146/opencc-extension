import type { DomainList } from './storage';

const REGEX_META_PATTERN = /[.+?^${}()|[\]\\]/g;

export function normalizeDomainPattern(pattern: string): string {
  return pattern.trim().toLowerCase();
}

export function domainPatternToRegExp(pattern: string): RegExp {
  const normalized = normalizeDomainPattern(pattern);
  const escaped = normalized.replace(REGEX_META_PATTERN, String.raw`\$&`).replaceAll('*', '.*');
  return new RegExp(`^${escaped}$`, 'i');
}

export function matchesDomain(hostname: string, patterns: string[]): boolean {
  const normalizedHostname = hostname.trim().toLowerCase();
  return patterns
    .map(normalizeDomainPattern)
    .filter(Boolean)
    .some((pattern) => domainPatternToRegExp(pattern).test(normalizedHostname));
}

export function isDomainBlocked(hostname: string, lists: DomainList): boolean {
  if (matchesDomain(hostname, lists.allowlist)) {
    return false;
  }
  return matchesDomain(hostname, lists.blocklist);
}
