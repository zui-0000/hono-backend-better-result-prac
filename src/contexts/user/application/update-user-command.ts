import { Result } from "better-result";
import * as z from "zod";

import type { Clock } from "~/shared/domain/clock";
import { MailAddress } from "~/shared/domain/model/value-objects/mail-address";
import type { ForbiddenError } from "~/shared/errors/forbidden-error";
import type { MailAddressDuplicationError } from "~/shared/errors/mail-address-duplication-error";
import type { RepositoryError } from "~/shared/errors/repository-error";
import { ResourceNotFoundError } from "~/shared/errors/resource-not-found-error";

import { changeUserProfile } from "../domain/model/user";
import { UserId } from "../domain/model/value-objects/user-id";
import { UserName } from "../domain/model/value-objects/user-name";
import { checkMailAddressDuplication } from "../domain/services/check-mail-address-duplication";
import { checkUserIsSelf } from "../domain/services/check-user-is-self";
import type { UserRepository } from "../domain/user-repository";

export type UpdateUserCommandDeps = {
  readonly userRepository: UserRepository;
  readonly clock: Clock;
};

export type UpdateUserCommandInput = {
  readonly id: string;
  readonly actor: string;
  readonly name: string;
  readonly mailAddress: string;
};

const UpdateUserCommandValues = z.object({
  id: UserId,
  actor: UserId,
  name: UserName,
  mailAddress: MailAddress,
});

export type UpdateUserCommandError =
  | ForbiddenError
  | ResourceNotFoundError
  | MailAddressDuplicationError
  | RepositoryError;

/**
 * プロフィールを更新する。認可 → 引き当て → 重複検証 → 状態遷移 → 永続化。
 *
 * 重複検証で `excluding` に自分を渡すのは、**メールアドレスを変えない更新が
 * 常に 409 になる**のを防ぐため。
 */
export const updateUserCommand =
  (deps: UpdateUserCommandDeps) =>
  (
    input: UpdateUserCommandInput,
  ): Promise<Result<void, UpdateUserCommandError>> =>
    Result.gen(async function* () {
      const { id, actor, name, mailAddress } =
        UpdateUserCommandValues.parse(input);

      yield* checkUserIsSelf(id, actor);

      const user = yield* Result.await(deps.userRepository.findById(id));
      if (user === undefined) {
        return Result.err(new ResourceNotFoundError());
      }

      yield* Result.await(
        checkMailAddressDuplication(deps, mailAddress, {
          excluding: user.id,
        }),
      );

      const updated = changeUserProfile(deps, user, { name, mailAddress });

      yield* Result.await(deps.userRepository.updateProfile(updated));
      return Result.ok();
    });
