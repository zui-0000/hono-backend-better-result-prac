import { Result } from "better-result";
import type * as z from "zod";

import type { UpdateUserBody, UpdateUserParams } from "~/generated/users";
import type { AuthenticatedCaller } from "~/shared/domain/model/authenticated-caller";
import { SuccessResponse } from "~/shared/presentation/success-response";

import {
  updateUserCommand,
  type UpdateUserCommandInput,
} from "../../application/update-user-command";
import type { UserDeps } from "../../user-deps";

type UpdateUserControllerInput = {
  readonly auth: AuthenticatedCaller;
  readonly body: z.infer<typeof UpdateUserBody>;
  readonly params: z.infer<typeof UpdateUserParams>;
};

/** ユーザーを更新する (PUT /users/{id})。 */
export const updateUserController = (deps: UserDeps) => {
  const command = updateUserCommand(deps);
  return ({ auth, body, params }: UpdateUserControllerInput) =>
    Result.gen(async function* () {
      const input: UpdateUserCommandInput = {
        ...body,
        id: params.id,
        actor: auth.userId,
      };
      yield* Result.await(command(input));
      return SuccessResponse.NoContent(Result.ok());
    });
};
