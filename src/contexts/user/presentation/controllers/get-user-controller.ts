import { Result } from "better-result";
import type * as z from "zod";

import { GetUser200Response, type GetUserParams } from "~/generated/users";
import type { AccessTokenClaims } from "~/shared/domain/model/access-token-claims";
import { SuccessResponse } from "~/shared/presentation/success-response";

import { getUserQuery } from "../../application/get-user-query";
import type { UserDeps } from "../../user-deps";

type Input = {
  readonly auth: AccessTokenClaims;
  readonly params: z.infer<typeof GetUserParams>;
};

/** ID を指定してユーザーを取得する (GET /users/{id})。 */
export const getUserController = (deps: UserDeps) => {
  const query = getUserQuery(deps);
  return ({ auth, params }: Input) =>
    Result.gen(async function* () {
      const input = {
        id: params.id,
        actor: auth.sub,
      };
      const output = yield* Result.await(query(input));
      return SuccessResponse.Ok(GetUser200Response)(Result.ok(output));
    });
};
