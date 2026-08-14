import type { RefreshTokenIssuer } from "../domain/refresh-token-issuer";

/** 32 バイトの暗号論的乱数。接頭辞は運用でログから見分けるため。 */
const TOKEN_BYTES = 32;
const TOKEN_PREFIX = "rt_";

const toBase64Url = (bytes: Uint8Array): string =>
  btoa(String.fromCharCode(...bytes))
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replaceAll("=", "");

const sha256Hex = (token: string): string =>
  new Bun.CryptoHasher("sha256").update(token).digest("hex");

/**
 * 本番実装。**採番に uuid を使わない** — 券に要るのは予測できないことで、
 * 時刻順に並ぶ uuidv7 は逆の性質を持つ。
 *
 * ハッシュが SHA-256 で足りるのは、券が高エントロピーな乱数だから
 * (パスワードのように推測されうる値ではないので argon2 は要らない)。
 */
export const refreshTokenIssuer: RefreshTokenIssuer = {
  issue: async () => {
    const token =
      TOKEN_PREFIX +
      toBase64Url(crypto.getRandomValues(new Uint8Array(TOKEN_BYTES)));
    return { token, hash: sha256Hex(token) };
  },
  hash: async (token) => sha256Hex(token),
};
