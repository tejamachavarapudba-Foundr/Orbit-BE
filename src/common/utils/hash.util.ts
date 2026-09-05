import * as bcrypt from 'bcrypt';
import { createHash } from 'crypto';

export const hash = (s: string) => bcrypt.hash(s, 10);
export const compare = (s: string, h: string) => bcrypt.compare(s, h);

// Refresh tokens are high-entropy random JWTs, not low-entropy guessable
// secrets like passwords — bcrypt's deliberately slow, salted hashing
// defends against offline brute-force guessing, which doesn't apply here
// and was adding a full bcrypt round-trip (~70-100ms) to every login,
// register, and token refresh. A fast SHA-256 digest still means a raw
// token never sits in the DB in plaintext.
export const fastHash = (s: string) => createHash('sha256').update(s).digest('hex');

// Existing stored hashes were created with bcrypt (recognizable by the
// "$2" prefix) — keep verifying those the slow way so already-issued
// refresh tokens aren't invalidated by this change; every new token gets
// hashed with fastHash and compared via the cheap path from then on.
export const compareTokenHash = (token: string, storedHash: string) =>
  storedHash.startsWith('$2') ? bcrypt.compare(token, storedHash) : Promise.resolve(fastHash(token) === storedHash);
