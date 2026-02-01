/**
 * Phone number utilities for secure friend search.
 * All numbers stored and hashed as 10 digits (no leading 1). Display: (xxx) xxx-xxxx.
 */

const DIGITS_ONLY = /^\d+$/;

/** Normalize to 10 digits only: strip non-digits; if 11 digits and leading 1, drop it; else take first 10. */
export function normalizePhoneNumber(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  if (digits.length === 11 && digits.startsWith('1')) {
    return digits.slice(1);
  }
  return digits.slice(0, 10);
}

/** Format up to 10 digits as (xxx) xxx-xxxx. */
export function formatPhoneDisplay(digits: string): string {
  const d = digits.replace(/\D/g, '').slice(0, 10);
  if (d.length <= 3) return d;
  if (d.length <= 6) return `(${d.slice(0, 3)}) ${d.slice(3)}`;
  return `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}`;
}

/** Parse displayed (xxx) xxx-xxxx or pasted input to 10 digits (max). Drops leading 1 if 11 digits. */
export function parsePhoneDisplay(formatted: string): string {
  const digits = formatted.replace(/\D/g, '');
  if (digits.length === 11 && digits.startsWith('1')) return digits.slice(1);
  return digits.slice(0, 10);
}

/** SHA-256 hash of normalized 10-digit phone (hex). Uses Web Crypto API. */
export async function hashPhoneNumber(phone: string): Promise<string> {
  const normalized = normalizePhoneNumber(phone);
  const encoder = new TextEncoder();
  const data = encoder.encode(normalized);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}

/** Valid if we have exactly 10 digits (after normalizing). */
export function validatePhoneNumber(phone: string): boolean {
  const digits = normalizePhoneNumber(phone);
  return digits.length === 10 && DIGITS_ONLY.test(digits);
}
