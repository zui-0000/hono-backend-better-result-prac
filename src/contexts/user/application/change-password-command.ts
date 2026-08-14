import { Result } from "better-result";
import * as z from "zod";

import { orNotFound } from "~/shared/application/or-not-found";
import type { Clock } from "~/shared/domain/clock";
import { Password } from "~/shared/domain/model/value-objects/password";
import type { PasswordHasher } from "~/shared/domain/password-hasher";
import type { ForbiddenError } from "~/shared/errors/forbidden-error";
import type { PasswordMismatchError } from "~/shared/errors/password-mismatch-error";
import type { RepositoryError } from "~/shared/errors/repository-error";
import type { ResourceNotFoundError } from "~/shared/errors/resource-not-found-error";

import { changeUserPassword, verifyUserPassword } from "../domain/model/user";
import { UserHashedPassword } from "../domain/model/value-objects/user-hashed-password";
import { UserId } from "../domain/model/value-objects/user-id";
import { checkUserIsSelf } from "../domain/services/check-user-is-self";
import type { UserRepository } from "../domain/user-repository";

export const ChangePasswordCommandInput = z.object({
  id: UserId,
  actor: UserId,
  currentPassword: Password,
  newPassword: Password,
});
export type ChangePasswordCommandInput = z.infer<
  typeof ChangePasswordCommandInput
>;

/**
 * パスワードを変更する。認可 → 引き当て → **現在のパスワードを確認** → 差し替え。
 *
 * 現在のパスワードを求めるので、**トークンを盗まれてもパスワードは変えられない**。
 */
export const createChangePasswordCommand =
  (deps: {
    readonly userRepository: UserRepository;
    readonly passwordHasher: PasswordHasher;
    readonly clock: Clock;
  }) =>
  async (
    input: ChangePasswordCommandInput,
  ): Promise<
    Result<
      void,
      | ForbiddenError
      | ResourceNotFoundError
      | PasswordMismatchError
      | RepositoryError
    >
  > =>
    await Result.gen(async function* () {
      yield* checkUserIsSelf(input.id, input.actor);

      const user = yield* orNotFound(
        await deps.userRepository.findById(input.id),
      );

      yield* Result.await(
        verifyUserPassword(deps, user, input.currentPassword),
      );

      const hashedPassword = UserHashedPassword.parse(
        await deps.passwordHasher.hash(input.newPassword),
      );

      const updated = changeUserPassword(deps, user, hashedPassword);
      yield* Result.await(deps.userRepository.updatePassword(updated));
      return Result.ok();
    });
