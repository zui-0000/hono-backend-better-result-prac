import { Result } from "better-result";
import type * as z from "zod";

import type { DeleteUserParams } from "~/generated/users";
import type { AuthenticatedCaller } from "~/shared/domain/model/authenticated-caller";
import { SuccessResponse } from "~/shared/presentation/success-response";

import {
  deleteUserCommand,
  type DeleteUserCommandInput,
} from "../../application/delete-user-command";
import type { UserDeps } from "../../user-deps";

type DeleteUserControllerInput = {
  readonly auth: AuthenticatedCaller;
  readonly params: z.infer<typeof DeleteUserParams>;
};

/** ユーザーを削除する (DELETE /users/{id})。 */
export const deleteUserController = (deps: UserDeps) => {
  const command = deleteUserCommand(deps);
  return ({ auth, params }: DeleteUserControllerInput) =>
    Result.gen(async function* () {
      const input: DeleteUserCommandInput = {
        id: params.id,
        actor: auth.userId,
      };
      yield* Result.await(command(input));
      return Result.ok(SuccessResponse.NoContent());
    });
};
