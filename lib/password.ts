import bcrypt from "bcryptjs";

const SALT_ROUNDS = 10;

export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, SALT_ROUNDS);
}

export async function verifyPassword(
  plain: string,
  stored: string | null | undefined,
): Promise<boolean> {
  if (!stored) return false;

  // bcrypt hashes start with $2a$ / $2b$ / $2y$
  if (stored.startsWith("$2")) {
    return bcrypt.compare(plain, stored);
  }

  // Legacy plaintext rows: accept once, then caller should re-hash.
  return stored === plain;
}

export function isBcryptHash(value: string | null | undefined): boolean {
  return Boolean(value && value.startsWith("$2"));
}
