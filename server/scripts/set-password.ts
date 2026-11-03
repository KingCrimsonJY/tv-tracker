import crypto from 'node:crypto';
import { hashPassword, MIN_PASSWORD_LENGTH } from '../auth.ts';

function main(): void {
  const argPassword = process.argv[2]?.trim();
  if (argPassword !== undefined && argPassword.length < MIN_PASSWORD_LENGTH) {
    console.error(`Error: Password must be at least ${MIN_PASSWORD_LENGTH} characters long.`);
    process.exit(1);
  }

  const password = argPassword || crypto.randomBytes(12).toString('base64url');
  const hash = hashPassword(password);

  if (!argPassword) {
    console.log(`Generated password: ${password}`);
  }
  console.log(`APP_PASSWORD_HASH="${hash}"`);
}

main();
