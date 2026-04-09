import {
  createCipheriv,
  createDecipheriv,
  randomBytes,
  createHash,
} from 'node:crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_BYTES = 12;
const AUTH_TAG_BYTES = 16;

export interface EncryptedValue {
  ciphertext: string; // hex
  iv: string;         // hex
  tag: string;        // hex
}

/**
 * Derives a 32-byte key from the raw hex ENCRYPTION_KEY env var.
 * Accepts exactly 64-char hex strings (32 bytes).
 */
export function getEncryptionKey(): Buffer {
  const raw = process.env['ENCRYPTION_KEY'];
  if (!raw || raw.length !== 64) {
    throw new Error(
      'ENCRYPTION_KEY must be a 64-character hex string (32 bytes). ' +
        'Generate with: node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'hex\'))"',
    );
  }
  return Buffer.from(raw, 'hex');
}

/**
 * Encrypts plaintext using AES-256-GCM.
 * @param plaintext  The string to encrypt (e.g. a Shopify access token).
 * @param key        32-byte Buffer from getEncryptionKey().
 */
export function encrypt(plaintext: string, key: Buffer): EncryptedValue {
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([
    cipher.update(plaintext, 'utf8'),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();
  return {
    ciphertext: encrypted.toString('hex'),
    iv: iv.toString('hex'),
    tag: tag.toString('hex'),
  };
}

/**
 * Decrypts a value produced by `encrypt`.
 * Throws if authentication fails (tampered ciphertext).
 */
export function decrypt(value: EncryptedValue, key: Buffer): string {
  const iv = Buffer.from(value.iv, 'hex');
  const tag = Buffer.from(value.tag, 'hex');
  const ciphertext = Buffer.from(value.ciphertext, 'hex');
  const decipher = createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(tag);
  const decrypted = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
  return decrypted.toString('utf8');
}

/**
 * Hashes a password using scrypt for admin credential storage.
 * Format: "<salt_hex>:<hash_hex>"
 */
export async function hashPassword(password: string): Promise<string> {
  const { scrypt, randomBytes: rb } = await import('node:crypto');
  const { promisify } = await import('node:util');
  const scryptAsync = promisify(scrypt);
  const salt = rb(16).toString('hex');
  const hash = (await scryptAsync(password, salt, 64)) as Buffer;
  return `${salt}:${hash.toString('hex')}`;
}

/**
 * Verifies a password against a stored "<salt>:<hash>" string.
 */
export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const { scrypt, timingSafeEqual: tse } = await import('node:crypto');
  const { promisify } = await import('node:util');
  const scryptAsync = promisify(scrypt);
  const [salt, storedHash] = stored.split(':');
  if (!salt || !storedHash) return false;
  const incoming = (await scryptAsync(password, salt, 64)) as Buffer;
  const expected = Buffer.from(storedHash, 'hex');
  if (incoming.length !== expected.length) return false;
  return tse(incoming, expected);
}
