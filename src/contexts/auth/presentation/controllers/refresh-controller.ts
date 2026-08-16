import { Result } from "better-result";

import { Refresh200Response } from "~/generated/auth";
import { SuccessResponse } from "~/shared/presentation/success-response";

import {
  refreshCommand,
  type RefreshCommandInput,
} from "../../application/refresh-command";
import type { AuthDeps } from "../../auth-deps";
import {
  type RefreshCookie,
  refreshTokenOf,
  setRefreshCookie,
} from "../refresh-cookie";

type RefreshControllerInput = { readonly cookie: RefreshCookie };

/**
 * アクセストークンを再発行する (POST /auth/refresh)。
 *
 * **券は本文ではなく Cookie から受け取る。** ブラウザが自動で送るので、
 * クライアントの JS は `credentials: 'include'` を付ける以外に何もしない。
 * ローテーションで発行した新しい券も同じ名前を上書きして返す。
 */
export const refreshController = (deps: AuthDeps) => {
  const command = refreshCommand(deps);
  return ({ cookie }: RefreshControllerInput) =>
    Result.gen(async function* () {
      const input: RefreshCommandInput = {
        refreshToken: refreshTokenOf(cookie),
      };
      const { accessToken, refreshToken } = yield* Result.await(command(input));
      return setRefreshCookie(
        deps.cookieSettings,
        refreshToken,
      )(SuccessResponse.Ok(Refresh200Response)(Result.ok({ accessToken })));
    });
};
