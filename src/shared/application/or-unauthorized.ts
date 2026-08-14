import { Result } from "better-result";

import { UnauthorizedError } from "~/shared/errors/unauthorized-error";

/**
 * 「引き当てられなければ 401」というユースケースの方針に名前を与える。
 *
 * `orNotFound` と対だが**使う場面は正反対**。404 は「対象が無い」と正直に言う出口、
 * 401 は**なぜ失敗したかを言わない**出口。
 *
 * 認証経路で `undefined` に畳まれているのは、「利用者が居ない」と「パスワードが違う」を
 * 書き分けるとアカウント列挙ができてしまうため。手で `if` を書くと、その分岐に
 * 「片方だけ別のエラーにする」余地が残る。
 */
export const orUnauthorized = <A, E>(
  result: Result<A | undefined, E>,
): Result<A, E | UnauthorizedError> =>
  result.andThen((value) =>
    value === undefined
      ? Result.err(new UnauthorizedError())
      : Result.ok(value),
  );
