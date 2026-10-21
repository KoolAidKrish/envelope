import { isUuid } from './queries';

export function str(form: FormData, key: string, max = 500): string {
  const v = form.get(key);
  return typeof v === 'string' ? v.trim().slice(0, max) : '';
}

export function int(form: FormData, key: string, min: number, max: number, fallback = min): number {
  const n = Number.parseInt(str(form, key, 12), 10);
  return Number.isFinite(n) ? Math.min(Math.max(n, min), max) : fallback;
}

export function bool(form: FormData, key: string): boolean {
  const v = str(form, key, 8);
  return v === 'on' || v === 'true' || v === '1';
}

export function uuid(form: FormData, key: string): string | null {
  const v = str(form, key, 40);
  return isUuid(v) ? v : null;
}

/** Only allow http(s) links so nobody can store a javascript: URL. */
export function safeUrl(form: FormData, key: string): string {
  const v = str(form, key, 2000);
  if (!v) return '';
  try {
    const u = new URL(/^[a-z]+:\/\//i.test(v) ? v : `https://${v}`);
    return u.protocol === 'http:' || u.protocol === 'https:' ? u.toString() : '';
  } catch {
    return '';
  }
}
