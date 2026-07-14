// Input validation / sanitization for untrusted data — especially fields that
// originate from inbound email or LLM extraction and later become outbound
// trust decisions (proposal recipients) or clickable links in our own UI.

/**
 * Return the URL only if it is a well-formed http(s) URL, else null.
 * Rejects javascript:, data:, and other schemes that could execute or phish
 * when rendered as an <a href>. Use at every point a URL is stored OR rendered.
 */
export function safeHttpUrl(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  try {
    const u = new URL(trimmed);
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return null;
    return u.toString();
  } catch {
    return null;
  }
}

/**
 * Basic email-shape validation. Not RFC-exhaustive — enough to reject
 * injection payloads and obviously malformed addresses before we send mail to
 * them or store them as a proposal recipient.
 */
export function isValidEmail(value: unknown): value is string {
  if (typeof value !== 'string') return false;
  const v = value.trim();
  if (v.length > 254) return false;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
}

/** Coerce to a trimmed, length-capped string or null (for LLM-extracted text fields). */
export function cleanString(value: unknown, maxLen = 2000): string | null {
  if (typeof value !== 'string') return null;
  const v = value.trim();
  if (!v) return null;
  return v.slice(0, maxLen);
}
