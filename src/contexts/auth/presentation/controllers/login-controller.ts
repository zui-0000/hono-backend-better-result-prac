import { Result } from "better-result";
import type * as z from "zod";

import type { LoginBody } from "~/generated/auth";
import { SuccessResponse } from "~/shared/presentation/success-response";

import {
  loginCommand,
  type LoginCommandInput,
} from "../../application/login-command";
import type { AuthDeps } from "../../auth-deps";
import { setRefreshCookie } from "../refresh-cookie";

type LoginControllerInput = { readonly body: z.infer<typeof LoginBody> };

/**
 * メールアドレスとパスワードで券を発行する (POST /auth/login)。
 *
 * **券の組を 2 つの経路に振り分ける。** アクセストークンは本文、
 * リフレッシュトークンは HttpOnly Cookie。後者を本文に載せると JS から読めてしまい、
 * XSS を踏んだ瞬間に 2 日有効な券が漏れる。
 */
export const loginController = (deps: AuthDeps) => {
  const command = loginCommand(deps);
  return ({ body }: LoginControllerInput) =>
    Result.gen(async function* () {
      const input: LoginCommandInput = body;
      const { accessToken, refreshToken } = yield* Result.await(command(input));
      const response = SuccessResponse.Ok({ accessToken });
      return Result.ok(
        setRefreshCookie(deps.cookieSettings, refreshToken)(response),
      );
    });
};
