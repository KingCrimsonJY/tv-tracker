import crypto from 'node:crypto';
import { hashPassword } from '../auth.ts';

function main(): void {
  const argPassword = process.argv[2]?.trim();
  const password = argPassword || crypto.randomBytes(12).toString('base64url');
  const hash = hashPassword(password);

  if (!argPassword) {
    console.log(`Generated password: ${password}`);
  }
  console.log(`APP_PASSWORD_HASH="${hash}"`);
}

main();
