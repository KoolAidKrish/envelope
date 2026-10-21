import type { AstroCookies } from 'astro';

const KEY = 'envelope_flash';

export type Flash = { text: string; error?: boolean };

export function setFlash(cookies: AstroCookies, text: string, error = false) {
  cookies.set(KEY, JSON.stringify({ text, error }), { path: '/admin', maxAge: 60, sameSite: 'lax', httpOnly: true });
}

export function takeFlash(cookies: AstroCookies): Flash | null {
  const raw = cookies.get(KEY)?.value;
  if (!raw) return null;
  cookies.delete(KEY, { path: '/admin' });
  try {
    return JSON.parse(raw) as Flash;
  } catch {
    return null;
  }
}
