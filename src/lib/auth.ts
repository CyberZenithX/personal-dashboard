/** Single-user password gate. Works in the Edge runtime (middleware) and Node (routes) via Web Crypto. */

export const COOKIE = 'dl_session';
export const SESSION_DAYS = 60;

const enc = new TextEncoder();

function secret(): string {
  return process.env.AUTH_SECRET || (process.env.APP_PASSWORD ? `daylog:${process.env.APP_PASSWORD}` : '');
}

/** True when the deployment has no password configured (only allowed in local dev). */
export function authDisabled(): boolean {
  return !process.env.APP_PASSWORD && process.env.NODE_ENV !== 'production';
}

export function authConfigured(): boolean {
  return !!process.env.APP_PASSWORD;
}

function b64url(buf: ArrayBuffer): string {
  let s = '';
  new Uint8Array(buf).forEach((b) => (s += String.fromCharCode(b)));
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

async function hmac(message: string): Promise<string> {
  const key = await crypto.subtle.importKey('raw', enc.encode(secret()), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return b64url(await crypto.subtle.sign('HMAC', key, enc.encode(message)));
}

export async function makeToken(): Promise<string> {
  const exp = Date.now() + SESSION_DAYS * 86400000;
  return `${exp}.${await hmac('v1.' + exp)}`;
}

export async function verifyToken(token: string | undefined): Promise<boolean> {
  if (!token || !secret()) return false;
  const [exp, sig] = token.split('.');
  if (!exp || !sig || Number(exp) < Date.now()) return false;
  return safeEqual(sig, await hmac('v1.' + exp));
}

export function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let r = 0;
  for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return r === 0;
}

export async function checkPassword(input: string): Promise<boolean> {
  const pw = process.env.APP_PASSWORD;
  if (!pw) return false;
  // Compare HMACs so the length of the real password isn't leaked.
  return safeEqual(await hmac('pw.' + input), await hmac('pw.' + pw));
}
