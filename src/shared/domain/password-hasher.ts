/**
 * パスワードのハッシュ化・照合を行うポート。実装は実行環境依存 (Bun.password)。
 *
 * ドメインは平文を持たず、ハッシュ済みの値 (UserHashedPassword) だけを扱う。
 * このポートが平文とハッシュの境界を担う。
 */
export type PasswordHasher = {
  readonly hash: (plainText: string) => Promise<string>;
  readonly verify: (plainText: string, hashed: string) => Promise<boolean>;
};
