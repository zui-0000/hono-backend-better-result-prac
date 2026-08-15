import { Result } from "better-result";
import * as z from "zod";

import { orNotFound } from "~/shared/application/or-not-found";
import type { ForbiddenError } from "~/shared/errors/forbidden-error";
import type { RepositoryError } from "~/shared/errors/repository-error";
import type { ResourceNotFoundError } from "~/shared/errors/resource-not-found-error";

import { UserId } from "../domain/model/value-objects/user-id";
import { checkUserIsSelf } from "../domain/services/check-user-is-self";

export const GetUserQueryInput = z.object({ id: UserId, actor: UserId });
export type GetUserQueryInput = z.infer<typeof GetUserQueryInput>;

/** 読み取り専用の射影。集約の全項目は写さない。 */
export type GetUserQueryOutput = {
  readonly name: string;
  readonly mailAddress: string;
};

/**
 * ポートがデータを引くために必要な値。認可の主体は含まない。
 */
export type GetUserQueryParams = { readonly id: UserId };

/**
 * ユーザー取得クエリのポート (読み取り側 / CQRS のクエリ経路)。
 */
export type GetUserQueryService = {
  readonly execute: (
    params: GetUserQueryParams,
  ) => Promise<Result<GetUserQueryOutput | undefined, RepositoryError>>;
};

/**
 * ユーザーを取得する (CQRS のクエリ)。
 */
export const getUserQuery =
  (deps: { readonly getUserQueryService: GetUserQueryService }) =>
  async (
    input: GetUserQueryInput,
  ): Promise<
    Result<
      GetUserQueryOutput,
      ForbiddenError | ResourceNotFoundError | RepositoryError
    >
  > =>
    await Result.gen(async function* () {
      yield* checkUserIsSelf(input.id, input.actor);

      return orNotFound(
        await deps.getUserQueryService.execute({ id: input.id }),
      );
    });
