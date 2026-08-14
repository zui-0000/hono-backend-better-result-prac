import { Result } from "better-result";
import type * as z from "zod";

import type { DeleteUserParams } from "~/generated/users";
import type { AccessTokenClaims } from "~/shared/domain/access-token-issuer";
import { decodeInput } from "~/shared/presentation/decode-input";
import { SuccessResponse } from "~/shared/presentation/success-response";

import {
  createDeleteUserCommand,
  DeleteUserCommandInput,
} from "../../application/delete-user-command";
import type { UserDeps } from "../../user-deps";

type Input = {
  readonly auth: AccessTokenClaims;
  readonly params: z.infer<typeof DeleteUserParams>;
};

/** ユーザーを削除する (DELETE /users/{id})。 */
export const createDeleteUserController = (deps: UserDeps) => {
  const command = createDeleteUserCommand(deps);
  return async ({ auth, params }: Input) =>
    await Result.gen(async function* () {
      const input = yield* decodeInput(DeleteUserCommandInput)({
        id: params.id,
        actor: auth.sub,
      });
      yield* Result.await(command(input));
      return SuccessResponse.NoContent(Result.ok());
    });
};
