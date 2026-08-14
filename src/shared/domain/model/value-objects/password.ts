import * as z from "zod";

/**
 * 平文パスワード (値オブジェクト / branded string)。12〜128 文字。
 *
 * NIST SP 800-63B に沿い、構成ルール (記号必須等) は課さず長さで強度を担保する。
 * ハッシュ化するための一時的な値であり、集約が保持することはない
 * (= 平文はドメインの内側に留まらない)。
 */
export const Password = z.string().min(12).max(128).brand<"Password">();
export type Password = z.infer<typeof Password>;
