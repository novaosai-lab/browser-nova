// Chrome-style omnibox: text the user types is either a URL to visit or a
// query to search for. We only treat something as a search when it clearly is
// not a host (contains whitespace, or is a single bare word with no dot).
const SEARCH_ENDPOINT = 'https://www.google.com/search?q=';

export function isProbablySearchQuery(input: string): boolean {
  const t = input.trim();
  if (!t) return false;
  // Explicit schemes and hosts we already recognise are never a search.
  if (/^[a-z][a-z0-9+.-]*:\/\//i.test(t)) return false;
  if (t.startsWith('localhost') || t.startsWith('127.0.0.1') || t.startsWith('0.0.0.0')) return false;
  if (/^(\d{1,3}\.){3}\d{1,3}(:\d+)?(\/.*)?$/.test(t)) return false;
  // Any whitespace → treat as a search phrase ("weather today").
  if (/\s/.test(t)) return true;
  // A single token with no dot is not a hostname ("แมว", "intranet") → search.
  if (!t.includes('.')) return true;
  return false;
}

export function normalizeUrl(rawUrl: string, preferHttp = false): string {
  const trimmed = rawUrl.trim();
  if (!trimmed) return 'about:blank';

  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
    return trimmed;
  }

  if (trimmed.startsWith('localhost') || trimmed.startsWith('127.0.0.1') || trimmed.startsWith('0.0.0.0')) {
    return `http://${trimmed}`;
  }

  // If user entered IP like 192.168.x.x or 10.x.x.x
  if (/^(\d{1,3}\.){3}\d{1,3}(:\d+)?(\/.*)?$/.test(trimmed)) {
    return `http://${trimmed}`;
  }

  // Not a host → run a web search, just like Chrome's omnibox.
  if (isProbablySearchQuery(trimmed)) {
    return `${SEARCH_ENDPOINT}${encodeURIComponent(trimmed)}`;
  }

  // If user prefers HTTP for this host/request
  if (preferHttp) {
    return `http://${trimmed}`;
  }

  // Default web URL to https
  return `https://${trimmed}`;
}

export function evaluateSecurityStatus(urlStr: string): {
  isHttp: boolean;
  isSecure: boolean;
  securityStatus: 'http' | 'https' | 'internal' | 'error';
  badgeText: string;
} {
  try {
    const parsed = new URL(urlStr);
    if (parsed.protocol === 'http:') {
      const isLocal =
        parsed.hostname === 'localhost' ||
        parsed.hostname === '127.0.0.1' ||
        parsed.hostname === '0.0.0.0' ||
        parsed.hostname.startsWith('192.168.') ||
        parsed.hostname.startsWith('10.');
      return {
        isHttp: true,
        isSecure: false,
        securityStatus: 'http',
        badgeText: isLocal ? 'HTTP — เครื่องในเครื่อง/วงใน' : 'HTTP — ไม่เข้ารหัส',
      };
    } else if (parsed.protocol === 'https:') {
      return {
        isHttp: false,
        isSecure: true,
        securityStatus: 'https',
        badgeText: 'HTTPS — ปลอดภัย',
      };
    } else {
      return {
        isHttp: false,
        isSecure: true,
        securityStatus: 'internal',
        badgeText: 'Nova — ภายในระบบ',
      };
    }
  } catch {
    return {
      isHttp: false,
      isSecure: false,
      securityStatus: 'error',
      badgeText: 'ข้อผิดพลาด URL',
    };
  }
}
