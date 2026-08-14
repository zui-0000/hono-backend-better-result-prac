import { Result } from "better-result";
import * as z from "zod";

import { orNotFound } from "~/shared/application/or-not-found";
import type { ForbiddenError } from "~/shared/errors/forbidden-error";
import type { RepositoryError } from "~/shared/errors/repository-error";
import type { ResourceNotFoundError } from "~/shared/errors/resource-not-found-error";

import { UserId } from "../domain/model/value-objects/user-id";
import { checkUserIsSelf } from "../domain/services/check-user-is-self";
import type { UserRepository } from "../domain/user-repository";

export const DeleteUserCommandInput = z.object({
  id: UserId,
  actor: UserId,
});
export type DeleteUserCommandInput = z.infer<typeof DeleteUserCommandInput>;

/**
 * ユーザーを削除する。
 *
 * 削除の前に引き当てるのは、**無い相手を消して 204 を返さない**ため
 * (DELETE の冪等性より「指定が誤っている」と教えるほうを採った)。
 */
export const createDeleteUserCommand =
  (deps: { readonly userRepository: UserRepository }) =>
  async (
    input: DeleteUserCommandInput,
  ): Promise<
    Result<void, ForbiddenError | ResourceNotFoundError | RepositoryError>
  > =>
    await Result.gen(async function* () {
      yield* checkUserIsSelf(input.id, input.actor);
      yield* orNotFound(await deps.userRepository.findById(input.id));
      yield* Result.await(deps.userRepository.deleteById(input.id));
      return Result.ok();
    });
