import { Result } from "better-result";

import type { AuthenticatedCaller } from "~/shared/domain/model/authenticated-caller";
import { SuccessResponse } from "~/shared/presentation/success-response";

import { logoutCommand } from "../../application/logout-command";
import type { AuthDeps } from "../../auth-deps";
import { clearRefreshCookie } from "../refresh-cookie";

type Input = { readonly auth: AuthenticatedCaller };

/**
 * セッションを終了する (POST /auth/logout)。
 *
 * 入力は **Bearer から得た `AuthenticatedCaller` だけ**。素の Uuid のまま渡し、
 * `SessionId` への変換は command が行う
 * (shared は contexts を知れないので branded な型で受け取れない)。
 *
 * **Cookie も消す。** サーバ側で失効させるだけでは、ブラウザが 2 日送り続ける。
 */
export const logoutController = (deps: AuthDeps) => {
  const command = logoutCommand(deps);
  return ({ auth }: Input) =>
    Result.gen(async function* () {
      const input = {
        sessionId: auth.sessionId,
      };
      yield* Result.await(command(input));
      return clearRefreshCookie(deps.cookieSettings)(
        SuccessResponse.NoContent(Result.ok()),
      );
    });
};
