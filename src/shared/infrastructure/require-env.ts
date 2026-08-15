/** 環境変数の入れ物。`process.env` をそのまま渡せる形にしておく (差し替え可能に)。 */
export type Environment = Readonly<Record<string, string | undefined>>;

/**
 * 環境変数を読む。**未設定なら起動時に落とす。**
 *
 * `Bun.sql` は未設定の URL をエラーにせず既定の接続先へフォールバックするため、
 * 設定漏れが「起動しない」ではなく「**別の DB に繋がる**」に化ける。
 * 署名鍵も同じで、空のまま動くと**誰でも偽造できるトークンを発行しながら正常に見える**。
 * どちらも起動しないほうが圧倒的にましなので、ここで落とす。
 *
 * 空文字も未設定として扱う。`.env` に `KEY=` と書いた状態を通すと、
 * 上と同じ壊れ方をする。
 */
export const requireEnv = (env: Environment, name: string): string => {
  const value = env[name];
  if (value === undefined || value === "") {
    throw new Error(`${name} が設定されていません。.env を確認してください。`);
  }
  return value;
};
