import { Result } from "better-result";
import type * as z from "zod";

import type { UpdateUserBody, UpdateUserParams } from "~/generated/users";
import type { AccessTokenClaims } from "~/shared/domain/model/access-token-claims";
import { SuccessResponse } from "~/shared/presentation/success-response";

import { updateUserCommand } from "../../application/update-user-command";
import type { UserDeps } from "../../user-deps";

type Input = {
  readonly auth: AccessTokenClaims;
  readonly body: z.infer<typeof UpdateUserBody>;
  readonly params: z.infer<typeof UpdateUserParams>;
};

/** ユーザーを更新する (PUT /users/{id})。 */
export const updateUserController = (deps: UserDeps) => {
  const command = updateUserCommand(deps);
  return ({ auth, body, params }: Input) =>
    Result.gen(async function* () {
      const input = {
        ...body,
        id: params.id,
        actor: auth.sub,
      };
      yield* Result.await(command(input));
      return SuccessResponse.NoContent(Result.ok());
    });
};
