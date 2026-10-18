import argon2 from 'argon2';

// Verified against when the email doesn't exist, so a failed login takes the same time either way
// and response timing can't reveal which emails are registered.
const dummyHash = argon2.hash('timing-equaliser-not-a-real-password');

export function hashPassword(password: string) {
  return argon2.hash(password, { type: argon2.argon2id });
}

export async function verifyPassword(hash: string | null | undefined, password: string) {
  if (!hash) {
    await argon2.verify(await dummyHash, password);
    return false;
  }
  return argon2.verify(hash, password);
}
