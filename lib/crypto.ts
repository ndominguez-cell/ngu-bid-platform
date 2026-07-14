import { createCipheriv, createDecipheriv, randomBytes, createHash } from 'crypto';

// Application-level encryption for secrets at rest (Google OAuth tokens). Uses
// AES-256-GCM with a key derived from the TOKEN_ENC_KEY env var. This is a
// defense-in-depth layer on top of the RLS/column-grant restrictions — even a
// direct DB dump or a service-role leak doesn't expose usable refresh tokens.
//
// Migration-friendly: values are tagged with a version prefix. Anything without
// the prefix is treated as legacy plaintext and passed through, so existing
// tokens keep working and get re-encrypted the next time they're written.

const PREFIX = 'enc:v1:';

function key(): Buffer | null {
  const raw = process.env.TOKEN_ENC_KEY;
  if (!raw) return null;
  // Derive a stable 32-byte key from whatever the operator supplies (any length).
  return createHash('sha256').update(raw).digest();
}

let warned = false;
function warnOnce() {
  if (!warned) {
    warned = true;
    console.warn('[crypto] TOKEN_ENC_KEY not set — Google tokens are stored UNENCRYPTED. Set TOKEN_ENC_KEY to enable encryption at rest.');
  }
}

/** Encrypt a secret for storage. Returns plaintext unchanged if no key is set. */
export function encryptSecret(plain: string | null | undefined): string | null {
  if (plain == null) return null;
  const k = key();
  if (!k) { warnOnce(); return plain; }
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', k, iv);
  const ct = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return PREFIX + Buffer.concat([iv, tag, ct]).toString('base64');
}

/** Decrypt a stored secret. Passes through legacy (unprefixed) plaintext. */
export function decryptSecret(stored: string | null | undefined): string | null {
  if (stored == null) return null;
  if (!stored.startsWith(PREFIX)) return stored; // legacy plaintext
  const k = key();
  if (!k) {
    // Value is encrypted but the key is gone — can't recover.
    throw new Error('TOKEN_ENC_KEY is not set but an encrypted token was found');
  }
  const buf = Buffer.from(stored.slice(PREFIX.length), 'base64');
  const iv = buf.subarray(0, 12);
  const tag = buf.subarray(12, 28);
  const ct = buf.subarray(28);
  const decipher = createDecipheriv('aes-256-gcm', k, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(ct), decipher.final()]).toString('utf8');
}
