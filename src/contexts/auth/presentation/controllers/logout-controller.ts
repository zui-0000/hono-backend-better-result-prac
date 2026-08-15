import { Result } from "better-result";

import type { AccessTokenClaims } from "~/shared/domain/model/access-token-claims";
import { SuccessResponse } from "~/shared/presentation/success-response";

import { logoutCommand } from "../../application/logout-command";
import type { AuthDeps } from "../../auth-deps";
import { clearRefreshCookie } from "../refresh-cookie";

type Input = { readonly auth: AccessTokenClaims };

/**
 * セッションを終了する (POST /auth/logout)。
 *
 * 入力は **Bearer の claims だけ**。素の Uuid のまま渡し、`SessionId` への変換は
 * command が行う (shared は contexts を知れないので claims を branded にできない)。
 *
 * **Cookie も消す。** サーバ側で失効させるだけでは、ブラウザが 2 週間送り続ける。
 */
export const logoutController = (deps: AuthDeps) => {
  const command = logoutCommand(deps);
  return ({ auth }: Input) =>
    Result.gen(async function* () {
      const input = {
        sessionId: auth.sid,
      };
      yield* Result.await(command(input));
      return clearRefreshCookie(deps.cookieSettings)(
        SuccessResponse.NoContent(Result.ok()),
      );
    });
};
