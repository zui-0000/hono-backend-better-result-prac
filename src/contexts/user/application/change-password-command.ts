import { Result } from "better-result";
import * as z from "zod";

import { SessionId } from "~/contexts/auth/domain/model/value-objects/session-id";
import type { SessionRevoker } from "~/contexts/auth/public/session-revoker";
import type { Clock } from "~/shared/domain/clock";
import { Password } from "~/shared/domain/model/value-objects/password";
import type { PasswordHasher } from "~/shared/domain/password-hasher";
import type { ForbiddenError } from "~/shared/errors/forbidden-error";
import type { PasswordMismatchError } from "~/shared/errors/password-mismatch-error";
import type { RepositoryError } from "~/shared/errors/repository-error";
import { ResourceNotFoundError } from "~/shared/errors/resource-not-found-error";

import { changeUserPassword, verifyUserPassword } from "../domain/model/user";
import { UserHashedPassword } from "../domain/model/value-objects/user-hashed-password";
import { UserId } from "../domain/model/value-objects/user-id";
import { checkUserIsSelf } from "../domain/services/check-user-is-self";
import type { UserRepository } from "../domain/user-repository";

/**
 * `actorSession` は操作中のセッション (JWT の sid)。**残す 1 つを名指すために要る。**
 *
 * auth の値オブジェクトをそのまま受けるのは、claims の sid が素の Uuid で届くから
 * (`logout-command.ts` と同じ経路)。ここで brand に落としておくと、形式が壊れた
 * 値は decodeInput が 400 で弾き、内側に素の文字列が流れ込まない。
 */
export type ChangePasswordCommandInput = {
  readonly id: string;
  readonly actor: string;
  readonly actorSession: string;
  readonly currentPassword: string;
  readonly newPassword: string;
};

const ChangePasswordCommandValues = z.object({
  id: UserId,
  actor: UserId,
  actorSession: SessionId,
  currentPassword: Password,
  newPassword: Password,
});

export type ChangePasswordCommandError =
  | ForbiddenError
  | ResourceNotFoundError
  | PasswordMismatchError
  | RepositoryError;

/**
 * パスワードを変更する。
 * 認可 → 引き当て → **現在のパスワードを確認** → 他端末を切る → 差し替え。
 *
 * 現在のパスワードを求めるので、**トークンを盗まれてもパスワードは変えられない**。
 *
 * **他の端末を切るところまでが「パスワードを変える」。** 変えたい動機の大半は
 * 「漏れたかもしれない」なので、盗んだ側のセッションが生き残るなら意味が薄い。
 * 操作中の端末 (`actorSession`) だけ残すのは、変えた本人を追い出さないため。
 *
 * **失効が先、差し替えが後。** 逆順だと、差し替えは通ったのに失効で落ちたとき
 * 盗まれた券が生き残り、しかも再試行できない (currentPassword が既に古く 401 になる)。
 * この順なら失敗しても他端末がログアウトされるだけで、パスワードは元のまま入り直せる。
 */
export const changePasswordCommand =
  (deps: {
    readonly userRepository: UserRepository;
    readonly passwordHasher: PasswordHasher;
    readonly sessionRevoker: SessionRevoker;
    readonly clock: Clock;
  }) =>
  (
    input: ChangePasswordCommandInput,
  ): Promise<Result<void, ChangePasswordCommandError>> =>
    Result.gen(async function* () {
      const { id, actor, actorSession, currentPassword, newPassword } =
        ChangePasswordCommandValues.parse(input);

      yield* checkUserIsSelf(id, actor);

      const user = yield* Result.await(deps.userRepository.findById(id));
      if (user === undefined) {
        return Result.err(new ResourceNotFoundError());
      }

      yield* Result.await(verifyUserPassword(deps, user, currentPassword));

      const hashedPassword = UserHashedPassword.parse(
        await deps.passwordHasher.hash(newPassword),
      );

      yield* Result.await(
        deps.sessionRevoker.revokeUserSessions({
          userId: id,
          excluding: actorSession,
        }),
      );

      const updated = changeUserPassword(deps, user, hashedPassword);
      yield* Result.await(deps.userRepository.updatePassword(updated));
      return Result.ok();
    });
