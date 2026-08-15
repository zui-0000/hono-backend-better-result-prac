import { Result } from "better-result";
import type * as z from "zod";

import type { DeleteUserParams } from "~/generated/users";
import type { AccessTokenClaims } from "~/shared/domain/model/access-token-claims";
import { SuccessResponse } from "~/shared/presentation/success-response";

import { deleteUserCommand } from "../../application/delete-user-command";
import type { UserDeps } from "../../user-deps";

type Input = {
  readonly auth: AccessTokenClaims;
  readonly params: z.infer<typeof DeleteUserParams>;
};

/** ユーザーを削除する (DELETE /users/{id})。 */
export const deleteUserController = (deps: UserDeps) => {
  const command = deleteUserCommand(deps);
  return ({ auth, params }: Input) =>
    Result.gen(async function* () {
      const input = {
        id: params.id,
        actor: auth.sub,
      };
      yield* Result.await(command(input));
      return SuccessResponse.NoContent(Result.ok());
    });
};
