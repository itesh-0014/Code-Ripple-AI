import crypto from 'crypto';

export function createStableHash(value, length = 32) {
  return crypto
    .createHash('sha256')
    .update(value)
    .digest('hex')
    .slice(0, length);
}
