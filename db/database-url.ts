/**
 * 接続情報を環境変数から読む。未設定なら throw する。
 *
 * **非 null 断言 (`process.env.DATABASE_URL!`) では足りない。** 未設定のまま Bun へ渡すと、
 * Bun.sql はエラーにせず**既定の接続先へフォールバックする** — localhost:5432 に
 * OS ユーザー名で繋ぎにいく (実測: `password authentication failed for user "zui"`)。
 * つまり設定漏れが「起動しない」ではなく「**別の DB に繋がる**」に化ける。
 * ローカルに trust 認証の Postgres が居れば、意図しない DB にマイグレーションが当たる。
 * しかも表に出るのは `Failed query: CREATE SCHEMA IF NOT EXISTS "drizzle"` で、
 * 環境変数の話が一言も出てこない。
 *
 * アプリ側 (src/main.ts) も起動時に同じ検証をする。機構が 2 つに分かれるのは、
 * こちらが drizzle-kit と migrate スクリプトから呼ばれ、アプリの合成ルートを
 * 通らないため。どちらも「依存を揃えられないなら動かさない」で揃っている。
 */
export const databaseUrl = (): string => {
  const url = process.env.DATABASE_URL;
  if (url === undefined || url === "") {
    throw new Error(
      "DATABASE_URL が設定されていません。" +
        ".env を確認してください (未設定のまま進むと既定の接続先へ繋ぎにいきます)。",
    );
  }
  return url;
};
