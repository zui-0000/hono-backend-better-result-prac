import type { CookieSettings } from "~/shared/domain/cookie-settings";

/**
 * 環境変数から Cookie の属性を読む。
 *
 * `COOKIE_SECURE` の既定を `true` にしてあるのが要点。**設定を忘れた環境が
 * 安全側に倒れる**ようにするため。外すのは `http://` のローカルだけ。
 */
export const readCookieSettings = (
  env: Readonly<Record<string, string | undefined>>,
): CookieSettings => ({
  secure: env["COOKIE_SECURE"] !== "false",
  domain:
    env["COOKIE_DOMAIN"] === undefined || env["COOKIE_DOMAIN"] === ""
      ? undefined
      : env["COOKIE_DOMAIN"],
});
