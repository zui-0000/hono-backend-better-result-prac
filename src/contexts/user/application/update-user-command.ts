import { Result } from "better-result";
import * as z from "zod";

import { orNotFound } from "~/shared/application/or-not-found";
import type { Clock } from "~/shared/domain/clock";
import { MailAddress } from "~/shared/domain/model/value-objects/mail-address";
import type { ForbiddenError } from "~/shared/errors/forbidden-error";
import type { MailAddressDuplicationError } from "~/shared/errors/mail-address-duplication-error";
import type { RepositoryError } from "~/shared/errors/repository-error";
import type { ResourceNotFoundError } from "~/shared/errors/resource-not-found-error";

import { changeUserProfile } from "../domain/model/user";
import { UserId } from "../domain/model/value-objects/user-id";
import { UserName } from "../domain/model/value-objects/user-name";
import { checkMailAddressDuplication } from "../domain/services/check-mail-address-duplication";
import { checkUserIsSelf } from "../domain/services/check-user-is-self";
import type { UserRepository } from "../domain/user-repository";

export const UpdateUserCommandInput = z.object({
  id: UserId,
  actor: UserId,
  name: UserName,
  mailAddress: MailAddress,
});
export type UpdateUserCommandInput = z.infer<typeof UpdateUserCommandInput>;

/**
 * プロフィールを更新する。認可 → 引き当て → 重複検証 → 状態遷移 → 永続化。
 *
 * 重複検証で `excluding` に自分を渡すのは、**メールアドレスを変えない更新が
 * 常に 409 になる**のを防ぐため。
 */
export const updateUserCommand =
  (deps: { readonly userRepository: UserRepository; readonly clock: Clock }) =>
  async (
    input: UpdateUserCommandInput,
  ): Promise<
    Result<
      void,
      | ForbiddenError
      | ResourceNotFoundError
      | MailAddressDuplicationError
      | RepositoryError
    >
  > =>
    await Result.gen(async function* () {
      yield* checkUserIsSelf(input.id, input.actor);

      const user = yield* orNotFound(
        await deps.userRepository.findById(input.id),
      );

      yield* Result.await(
        checkMailAddressDuplication(deps, input.mailAddress, {
          excluding: user.id,
        }),
      );

      const updated = changeUserProfile(deps, user, {
        name: input.name,
        mailAddress: input.mailAddress,
      });

      yield* Result.await(deps.userRepository.updateProfile(updated));
      return Result.ok();
    });
