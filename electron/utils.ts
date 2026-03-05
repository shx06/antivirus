import * as crypto from 'crypto';

/**
 * Generate a short cryptographically random ID.
 */
export function generateId(): string {
  return crypto.randomBytes(8).toString('hex');
}
