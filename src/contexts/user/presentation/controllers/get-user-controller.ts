import { Result } from "better-result";
import type * as z from "zod";

import { GetUser200Response, type GetUserParams } from "~/generated/users";
import type { AuthenticatedCaller } from "~/shared/domain/model/authenticated-caller";
import { SuccessResponse } from "~/shared/presentation/success-response";

import {
  getUserQuery,
  type GetUserQueryInput,
} from "../../application/get-user-query";
import type { UserDeps } from "../../user-deps";

type GetUserControllerInput = {
  readonly auth: AuthenticatedCaller;
  readonly params: z.infer<typeof GetUserParams>;
};

/** ID を指定してユーザーを取得する (GET /users/{id})。 */
export const getUserController = (deps: UserDeps) => {
  const query = getUserQuery(deps);
  return ({ auth, params }: GetUserControllerInput) =>
    Result.gen(async function* () {
      const input: GetUserQueryInput = {
        id: params.id,
        actor: auth.userId,
      };
      const output = yield* Result.await(query(input));
      return SuccessResponse.Ok(GetUser200Response)(Result.ok(output));
    });
};
