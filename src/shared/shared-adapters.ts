import { accessTokenIssuer } from "~/shared/infrastructure/access-token-issuer";
import { clock } from "~/shared/infrastructure/clock";
import { readCookieSettings } from "~/shared/infrastructure/cookie-settings";
import { EnvName } from "~/shared/infrastructure/env-name";
import { passwordHasher } from "~/shared/infrastructure/password-hasher";
import {
  type Environment,
  requireEnv,
} from "~/shared/infrastructure/require-env";
import { uuidGenerator } from "~/shared/infrastructure/uuid-generator";

/**
 * 横断ポートの実装。**合成ルートだけが呼ぶ。**
 *
 * 環境を受け取るのは、`accessTokenIssuer` と `cookieSettings` が**環境変数から
 * 組み立てる**ものだから。合成ルートの引数にポートを並べると、呼ぶ側 (main.ts) が
 * 「どの実装を使うか」を知ることになる — それは合成ルートの仕事なのでここへ寄せた。
 *
 * **`SharedDeps` (要求の型) より広い。** `passwordHasher` は user だけ、
 * `cookieSettings` は auth だけが要求するが、実装はどちらも横断の資材なので
 * ここで束ねる。要求の側を狭く保つことと、実装の置き場を揃えることは両立する。
 */
export const sharedAdapters = (env: Environment) => ({
  // 鍵の長さ検証はここで走る (短ければ throw する)。
  accessTokenIssuer: accessTokenIssuer(requireEnv(env, EnvName.JwtSecret)),
  cookieSettings: readCookieSettings(env),
  passwordHasher,
  uuidGenerator,
  clock,
});
