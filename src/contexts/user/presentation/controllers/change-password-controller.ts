import { Result } from "better-result";
import type * as z from "zod";

import type {
  ChangePasswordBody,
  ChangePasswordParams,
} from "~/generated/users";
import type { AuthenticatedCaller } from "~/shared/domain/model/authenticated-caller";
import { SuccessResponse } from "~/shared/presentation/success-response";

import { changePasswordCommand } from "../../application/change-password-command";
import type { UserDeps } from "../../user-deps";

type Input = {
  readonly auth: AuthenticatedCaller;
  readonly body: z.infer<typeof ChangePasswordBody>;
  readonly params: z.infer<typeof ChangePasswordParams>;
};

/** パスワードを変更する (PUT /users/{id}/password)。 */
export const changePasswordController = (deps: UserDeps) => {
  const command = changePasswordCommand(deps);
  return ({ auth, body, params }: Input) =>
    Result.gen(async function* () {
      const input = {
        ...body,
        id: params.id,
        actor: auth.userId,
        actorSession: auth.sessionId,
      };
      yield* Result.await(command(input));
      return SuccessResponse.NoContent(Result.ok());
    });
};
