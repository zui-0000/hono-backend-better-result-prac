import { Result } from "better-result";
import type * as z from "zod";

import { Login200Response, type LoginBody } from "~/generated/auth";
import { decodeInput } from "~/shared/presentation/decode-input";
import { SuccessResponse } from "~/shared/presentation/success-response";

import {
  loginCommand,
  LoginCommandInput,
} from "../../application/login-command";
import type { AuthDeps } from "../../auth-deps";
import { setRefreshCookie } from "../refresh-cookie";

type Input = { readonly body: z.infer<typeof LoginBody> };

/**
 * メールアドレスとパスワードで券を発行する (POST /auth/login)。
 *
 * **券の組を 2 つの経路に振り分ける。** アクセストークンは本文、
 * リフレッシュトークンは HttpOnly Cookie。後者を本文に載せると JS から読めてしまい、
 * XSS を踏んだ瞬間に 2 週間有効な券が漏れる。
 */
export const loginController = (deps: AuthDeps) => {
  const command = loginCommand(deps);
  return async ({ body }: Input) =>
    await Result.gen(async function* () {
      const input = yield* decodeInput(LoginCommandInput)(body);
      const { accessToken, refreshToken } = yield* Result.await(command(input));
      return setRefreshCookie(
        deps.cookieSettings,
        refreshToken,
      )(SuccessResponse.Ok(Login200Response)(Result.ok({ accessToken })));
    });
};
