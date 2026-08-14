import { Result } from "better-result";
import type * as z from "zod";

import { GetUser200Response, type GetUserParams } from "~/generated/users";
import type { AccessTokenClaims } from "~/shared/domain/access-token-issuer";
import { decodeInput } from "~/shared/presentation/decode-input";
import { SuccessResponse } from "~/shared/presentation/success-response";

import { createGetUserQuery } from "../../application/get-user-query";
import { GetUserQueryInput } from "../../application/get-user-query-service";
import type { UserDeps } from "../../user-deps";

type Input = {
  readonly auth: AccessTokenClaims;
  readonly params: z.infer<typeof GetUserParams>;
};

/** ID を指定してユーザーを取得する (GET /users/{id})。 */
export const createGetUserController = (deps: UserDeps) => {
  const query = createGetUserQuery(deps);
  return async ({ auth, params }: Input) =>
    await Result.gen(async function* () {
      const input = yield* decodeInput(GetUserQueryInput)({
        id: params.id,
        actor: auth.sub,
      });
      const output = yield* Result.await(query(input));
      return SuccessResponse.Ok(GetUser200Response)(Result.ok(output));
    });
};
