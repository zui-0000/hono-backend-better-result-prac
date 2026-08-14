import type { PasswordHasher } from "~/shared/domain/password-hasher";

/**
 * 本番実装: Bun ネイティブの argon2id (`Bun.password` の既定)。
 *
 * ポートと別ファイルにしているのは、ポートを import する domain / application が
 * 実装まで引きずり込まないため。同居させると実装ライブラリを替えた瞬間、
 * ドメインのモジュールグラフがそこへ到達する。
 */
export const bunPasswordHasher: PasswordHasher = {
  hash: async (plainText) => await Bun.password.hash(plainText),
  verify: async (plainText, hashed) =>
    await Bun.password.verify(plainText, hashed),
};
