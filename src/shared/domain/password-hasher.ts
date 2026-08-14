/**
 * パスワードのハッシュ化・照合を行うポート。実装は実行環境依存 (Bun.password)。
 *
 * ドメインは平文を持たず、ハッシュ済みの値 (UserHashedPassword) だけを扱う。
 * このポートが平文とハッシュの境界を担う。
 *
 * 失敗を型に出さないのは、**ハッシュ計算が失敗したらそれは実装のバグ**だから。
 * 握り潰す先が無いので実装側で throw する。
 */
export type PasswordHasher = {
  readonly hash: (plainText: string) => Promise<string>;
  readonly verify: (plainText: string, hashed: string) => Promise<boolean>;
};
