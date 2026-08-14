import { Result } from "better-result";

import type { AccessTokenClaims } from "~/shared/domain/access-token-issuer";
import { decodeInput } from "~/shared/presentation/decode-input";
import { SuccessResponse } from "~/shared/presentation/success-response";

import {
  createLogoutCommand,
  LogoutCommandInput,
} from "../../application/logout-command";
import type { AuthDeps } from "../../auth-deps";
import { clearRefreshCookie } from "../refresh-cookie";

type Input = { readonly auth: AccessTokenClaims };

/**
 * セッションを終了する (POST /auth/logout)。
 *
 * 入力は **Bearer の claims だけ**。`decodeInput` を通すのは claims の sid が
 * 素の Uuid だから (shared は contexts を知れないので branded にできない)。
 *
 * **Cookie も消す。** サーバ側で失効させるだけでは、ブラウザが 2 週間送り続ける。
 */
export const createLogoutController = (deps: AuthDeps) => {
  const command = createLogoutCommand(deps);
  return async ({ auth }: Input) =>
    await Result.gen(async function* () {
      const input = yield* decodeInput(LogoutCommandInput)({
        sessionId: auth.sid,
      });
      yield* Result.await(command(input));
      return clearRefreshCookie(deps.cookieSettings)(
        SuccessResponse.NoContent(Result.ok()),
      );
    });
};
