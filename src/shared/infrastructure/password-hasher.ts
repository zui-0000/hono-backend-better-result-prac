import type { PasswordHasher } from "~/shared/domain/password-hasher";

/**
 * 本番実装: Bun ネイティブの argon2id (`Bun.password` の既定)。
 */
export const passwordHasher: PasswordHasher = {
  hash: async (plainText) => await Bun.password.hash(plainText),
  verify: async (plainText, hashed) =>
    await Bun.password.verify(plainText, hashed),
};
