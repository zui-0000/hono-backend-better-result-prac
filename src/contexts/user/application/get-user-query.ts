import { Result } from "better-result";
import * as z from "zod";

import type { ForbiddenError } from "~/shared/errors/forbidden-error";
import type { RepositoryError } from "~/shared/errors/repository-error";
import { ResourceNotFoundError } from "~/shared/errors/resource-not-found-error";

import { UserId } from "../domain/model/value-objects/user-id";
import { checkUserIsSelf } from "../domain/services/check-user-is-self";

export type GetUserQueryInput = {
  readonly id: string;
  readonly actor: string;
};

const GetUserQueryValues = z.object({ id: UserId, actor: UserId });

export type GetUserQueryOutput = {
  readonly name: string;
  readonly mailAddress: string;
};

export type GetUserQueryParams = { readonly id: UserId };

/**
 * ユーザー取得クエリのポート (読み取り側 / CQRS のクエリ経路)。
 */
export type GetUserQueryService = {
  readonly execute: (
    params: GetUserQueryParams,
  ) => Promise<Result<GetUserQueryOutput | undefined, RepositoryError>>;
};

export type GetUserQueryError =
  | ForbiddenError
  | ResourceNotFoundError
  | RepositoryError;

/**
 * ユーザーを取得する (CQRS のクエリ)。
 */
export const getUserQuery =
  (deps: { readonly getUserQueryService: GetUserQueryService }) =>
  (
    input: GetUserQueryInput,
  ): Promise<Result<GetUserQueryOutput, GetUserQueryError>> =>
    Result.gen(async function* () {
      const { id, actor } = GetUserQueryValues.parse(input);

      yield* checkUserIsSelf(id, actor);

      const user = yield* Result.await(
        deps.getUserQueryService.execute({ id }),
      );
      if (user === undefined) {
        return Result.err(new ResourceNotFoundError());
      }

      return Result.ok(user);
    });
