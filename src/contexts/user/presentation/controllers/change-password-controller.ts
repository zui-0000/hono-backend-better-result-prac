import { Result } from "better-result";
import type * as z from "zod";

import type {
  ChangePasswordBody,
  ChangePasswordParams,
} from "~/generated/users";
import type { AccessTokenClaims } from "~/shared/domain/model/access-token-claims";
import { decodeInput } from "~/shared/presentation/decode-input";
import { SuccessResponse } from "~/shared/presentation/success-response";

import {
  ChangePasswordCommandInput,
  createChangePasswordCommand,
} from "../../application/change-password-command";
import type { UserDeps } from "../../user-deps";

type Input = {
  readonly auth: AccessTokenClaims;
  readonly body: z.infer<typeof ChangePasswordBody>;
  readonly params: z.infer<typeof ChangePasswordParams>;
};

/** パスワードを変更する (PUT /users/{id}/password)。 */
export const createChangePasswordController = (deps: UserDeps) => {
  const command = createChangePasswordCommand(deps);
  return async ({ auth, body, params }: Input) =>
    await Result.gen(async function* () {
      const input = yield* decodeInput(ChangePasswordCommandInput)({
        ...body,
        id: params.id,
        actor: auth.sub,
        actorSession: auth.sid,
      });
      yield* Result.await(command(input));
      return SuccessResponse.NoContent(Result.ok());
    });
};
