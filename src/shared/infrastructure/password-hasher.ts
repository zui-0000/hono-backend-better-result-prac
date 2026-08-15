import type { PasswordHasher } from "~/shared/domain/password-hasher";

/**
 * 本番実装: Bun ネイティブの argon2id (`Bun.password` の既定)。
 */
export const passwordHasher: PasswordHasher = {
  hash: (plainText) => Bun.password.hash(plainText),
  verify: (plainText, hashed) => Bun.password.verify(plainText, hashed),
};
