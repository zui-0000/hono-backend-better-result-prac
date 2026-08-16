import { Result } from "better-result";
import type * as z from "zod";

import type { CreateUserBody } from "~/generated/users";
import { SuccessResponse } from "~/shared/presentation/success-response";

import {
  createUserCommand,
  type CreateUserCommandInput,
} from "../../application/create-user-command";
import type { UserDeps } from "../../user-deps";

type CreateUserControllerInput = {
  readonly body: z.infer<typeof CreateUserBody>;
};

/**
 * ユーザーを新規作成する (POST /users)。
 *
 * controller の仕事は **DTO を組み立てて command へ渡す**ことだけ。
 * 依存は routes の時点で部分適用済みなので、ここには現れない。
 */
export const createUserController = (deps: UserDeps) => {
  const command = createUserCommand(deps);
  return ({ body }: CreateUserControllerInput) =>
    Result.gen(async function* () {
      const input: CreateUserCommandInput = body;
      const output = yield* Result.await(command(input));
      return Result.ok(SuccessResponse.Created(output));
    });
};
