#!/usr/bin/env node
// Usage: node deploy/generate-password-hash.js 'YourPassword'
import bcrypt from 'bcryptjs';

const pw = process.argv[2];
if (!pw) {
  console.error('Usage: node deploy/generate-password-hash.js <password>');
  process.exit(1);
}
console.log(bcrypt.hashSync(pw, 12));
