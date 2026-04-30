import { pbkdf2Sync, randomBytes } from 'node:crypto';

const secret = process.argv.slice(2).join(' ');

if (!secret) {
  console.error('Usage: node scripts/hash-secret.mjs "your secret"');
  process.exit(1);
}

const iterations = 100000;
const salt = randomBytes(16).toString('base64url');
const hash = pbkdf2Sync(secret, salt, iterations, 32, 'sha256').toString('base64url');

console.log(`pbkdf2_sha256$${iterations}$${salt}$${hash}`);
