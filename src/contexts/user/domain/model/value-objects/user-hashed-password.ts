import * as z from "zod";

/**
 * PHC 文字列形式 (Password Hashing Competition) の頭。`$<識別子>$...` で始まる。
 * argon2id も bcrypt も scrypt も共通で従う規約なので、特定のアルゴリズムを
 * 名指しせずに「ハッシュの形をしているか」だけを見られる。
 */
const PHC_PATTERN = /^\$[a-z0-9-]+\$/u;

/**
 * ハッシュ済みパスワード (値オブジェクト / 不透明な branded string)。
 *
 * 防ぎたいのは**平文がこの欄に入る事故** (ハッシュ化を挟み忘れる)。長さでは
 * 分離できない — 平文は 12〜128 文字で、argon2id は 118 文字、bcrypt は 60 文字と
 * どちらも平文の許容範囲に収まる。だから長さではなく形式で見る。
 */
export const UserHashedPassword = z
  .string()
  .regex(PHC_PATTERN)
  .brand<"User.HashedPassword">();
export type UserHashedPassword = z.infer<typeof UserHashedPassword>;
