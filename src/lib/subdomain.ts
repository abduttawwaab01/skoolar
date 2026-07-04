export const ROOT_DOMAIN = process.env.NEXT_PUBLIC_ROOT_DOMAIN || 'skoolar.org';

export function getSubdomain(hostname: string): string | null {
  const cleaned = hostname.replace(/:\d+$/, '').toLowerCase();
  const parts = cleaned.split('.');

  if (cleaned === 'localhost' || cleaned === '127.0.0.1') return null;

  if (parts.length <= 2) return null;

  if (parts.length === 3 && parts.slice(1).join('.') === ROOT_DOMAIN) {
    const sub = parts[0];
    if (sub === 'www') return null;
    if (sub.length === 0) return null;
    return sub;
  }

  if (parts.length > 3) {
    const rest = parts.slice(1).join('.');
    if (rest.endsWith(ROOT_DOMAIN)) {
      const sub = parts.slice(0, parts.length - 2).join('.');
      if (sub === 'www') return null;
      return sub;
    }
  }

  return null;
}

export function isRootDomain(hostname: string): boolean {
  const cleaned = hostname.replace(/:\d+$/, '').toLowerCase();
  return cleaned === ROOT_DOMAIN || cleaned === `www.${ROOT_DOMAIN}` || cleaned === 'localhost';
}
