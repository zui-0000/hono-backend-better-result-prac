import * as z from "zod";

/** SHA-256 の 16 進表現 (小文字 64 桁)。 */
const SHA256_HEX_PATTERN = /^[0-9a-f]{64}$/u;

/**
 * 券のハッシュ (値オブジェクト / branded string)。券そのものは保存しない。
 *
 * 防ぎたいのは**券とハッシュの取り違え**。`RefreshTokenIssuer.issue()` が返すのは
 * `{ token, hash }` という隣り合った 2 つの `string` で、型では区別が付かない。
 * 誤って `token` を渡すと**平文の券がそのまま DB に入り**、ハッシュ化した意味が消える
 * (実測: 券は `rt_` 始まりの base64url 46 文字で、この正規表現が弾く)。
 *
 * `z.hash("sha256")` はほぼ同じだが**大文字を通す**(実測)。`tokenHash` は一意制約の
 * 張られたキーで `findByTokenHash` が素の一致で引くため、同じダイジェストに 2 通りの
 * 綴りが生まれうる形は避ける。`Uuid` で `z.uuidv7()` を採らなかったのと同じ理由。
 *
 * なお契約 (`schema/`) にこの型は無い。ハッシュは API に出ないため、
 * 他の値オブジェクトと違って契約との突き合わせは不要。
 */
export const RefreshTokenHash = z
  .string()
  .regex(SHA256_HEX_PATTERN)
  .brand<"Auth.RefreshTokenHash">();
export type RefreshTokenHash = z.infer<typeof RefreshTokenHash>;
