import { createApp } from "~/app";
import { createAppDeps } from "~/app-deps";
import { createJwtAccessTokenIssuer } from "~/shared/infrastructure/access-token-issuer";
import { readCookieSettings } from "~/shared/infrastructure/cookie-settings";
import { createDatabase } from "~/shared/infrastructure/db/database-client";

/**
 * エントリ。**設定は起動時に読みきる。**
 *
 * `Bun.sql` は未設定の URL をエラーにせず既定の接続先へフォールバックするため、
 * 設定漏れが「起動しない」ではなく「**別の DB に繋がる**」に化ける。
 * 署名鍵も同じで、空のまま動くと**誰でも偽造できるトークンを発行しながら正常に見える**。
 * どちらも起動しないほうが圧倒的にましなので、ここで落とす。
 */
const requireEnv = (name: string): string => {
  const value = process.env[name];
  if (value === undefined || value === "") {
    throw new Error(`${name} が設定されていません。.env を確認してください。`);
  }
  return value;
};

const deps = createAppDeps({
  db: createDatabase(requireEnv("DATABASE_URL")),
  // 鍵の長さ検証はここで走る (短ければ throw する)。
  accessTokenIssuer: createJwtAccessTokenIssuer(requireEnv("JWT_SECRET")),
  cookieSettings: readCookieSettings(process.env),
});

export default createApp(deps);
