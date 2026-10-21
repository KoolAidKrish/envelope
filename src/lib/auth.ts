import { createHmac, randomBytes, scrypt as scryptCb, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';
import type { AstroCookies } from 'astro';
import { env } from './env';

const scrypt = promisify(scryptCb) as (pw: string, salt: Buffer, len: number) => Promise<Buffer>;

// ---------- Normalizing what guests type ----------

function fold(text: string): string {
  return text.normalize('NFKD').replace(/[̀-ͯ]/g, '').toLowerCase();
}

/** "  Priya   Shah " and "priya shah" are the same guest. */
export function nameKey(name: string): string {
  return fold(name).replace(/\s+/g, ' ').trim();
}

/** "The Blue Whale!" and "the blue whale" are the same answer. */
export function normalizeAnswer(answer: string): string {
  return fold(answer)
    .replace(/[^\p{L}\p{N}\s]/gu, '')
    .replace(/\s+/g, ' ')
    .trim();
}

// ---------- Answer hashing ----------

export async function hashAnswer(answer: string): Promise<string> {
  const salt = randomBytes(16);
  const hash = await scrypt(normalizeAnswer(answer), salt, 32);
  return `scrypt$${salt.toString('base64url')}$${hash.toString('base64url')}`;
}

export async function checkAnswer(answer: string, stored: string): Promise<boolean> {
  const [kind, saltB64, hashB64] = stored.split('$');
  if (kind !== 'scrypt' || !saltB64 || !hashB64) return false;
  const expected = Buffer.from(hashB64, 'base64url');
  const actual = await scrypt(normalizeAnswer(answer), Buffer.from(saltB64, 'base64url'), expected.length);
  return timingSafeEqual(actual, expected);
}

export function checkAdminPassword(input: string): boolean {
  const a = createHmac('sha256', 'envelope-admin').update(input).digest();
  const b = createHmac('sha256', 'envelope-admin').update(env('ADMIN_PASSWORD')).digest();
  return timingSafeEqual(a, b);
}

// ---------- Signed session cookies ----------

export type GuestSession = { guestId: string; eventId: string };

const GUEST_COOKIE = 'envelope_guest';
const ADMIN_COOKIE = 'envelope_admin';
const GUEST_DAYS = 60;
const ADMIN_DAYS = 7;

function secret(): string {
  const s = env('SESSION_SECRET');
  if (s.length < 32) throw new Error('SESSION_SECRET must be at least 32 characters.');
  return s;
}

function sign(payload: object): string {
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const mac = createHmac('sha256', secret()).update(body).digest('base64url');
  return `${body}.${mac}`;
}

function verify<T>(token: string | undefined): T | null {
  if (!token) return null;
  const [body, mac] = token.split('.');
  if (!body || !mac) return null;
  const expected = createHmac('sha256', secret()).update(body).digest();
  const given = Buffer.from(mac, 'base64url');
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) return null;
  try {
    const data = JSON.parse(Buffer.from(body, 'base64url').toString()) as T & { exp: number };
    return data.exp > Date.now() ? data : null;
  } catch {
    return null;
  }
}

function cookieOptions(days: number, secure: boolean) {
  return { path: '/', httpOnly: true, sameSite: 'lax' as const, secure, maxAge: days * 86400 };
}

export function setGuestSession(cookies: AstroCookies, s: GuestSession, secure: boolean) {
  cookies.set(GUEST_COOKIE, sign({ ...s, exp: Date.now() + GUEST_DAYS * 86400e3 }), cookieOptions(GUEST_DAYS, secure));
}

export function getGuestSession(cookies: AstroCookies): GuestSession | null {
  return verify<GuestSession>(cookies.get(GUEST_COOKIE)?.value);
}

export function clearGuestSession(cookies: AstroCookies) {
  cookies.delete(GUEST_COOKIE, { path: '/' });
}

export function setAdminSession(cookies: AstroCookies, secure: boolean) {
  cookies.set(ADMIN_COOKIE, sign({ admin: true, exp: Date.now() + ADMIN_DAYS * 86400e3 }), cookieOptions(ADMIN_DAYS, secure));
}

export function isAdmin(cookies: AstroCookies): boolean {
  return verify<{ admin: boolean }>(cookies.get(ADMIN_COOKIE)?.value)?.admin === true;
}

export function clearAdminSession(cookies: AstroCookies) {
  cookies.delete(ADMIN_COOKIE, { path: '/' });
}

export function isSecure(url: URL): boolean {
  return url.protocol === 'https:';
}
