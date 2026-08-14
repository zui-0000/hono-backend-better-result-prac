import type { Result } from "better-result";
import * as z from "zod";

import type { RepositoryError } from "~/shared/errors/repository-error";

import { UserId } from "../domain/model/value-objects/user-id";

/**
 * getUser クエリの入力。
 *
 * 項目が 1 つでも DTO にするのは、**ユースケースが欲しい形を宣言するのが DTO の役割**
 * だから。`actor` は認可の主体で、**照合はユースケースが行いポートには渡さない** —
 * 渡すと認可の失敗が 0 件 → 404 になり「認可の失敗は 403」の規則から外れる。
 */
export const GetUserQueryInput = z.object({ id: UserId, actor: UserId });
export type GetUserQueryInput = z.infer<typeof GetUserQueryInput>;

/** ポートがデータを引くために必要な値。認可の主体は含まない。 */
export type GetUserQueryParams = { readonly id: UserId };

/** 読み取り専用の射影。集約の全項目は写さない。 */
export type GetUserQueryOutput = {
  readonly name: string;
  readonly mailAddress: string;
};

/**
 * ユーザー取得クエリのポート (読み取り側 / CQRS のクエリ経路)。
 *
 * domain ではなく application に置くのは、読み取りがドメインの関心事ではないから。
 * 書き込みは不変条件を守るため domain の `UserRepository` を通すが、読み取りは
 * その強制が不要なので集約を復元せず DTO を直接返す。
 *
 *   Command: presentation → application → domain → infrastructure
 *   Query  : presentation → application → infrastructure (domain を経由しない)
 */
export type GetUserQueryService = {
  readonly execute: (
    params: GetUserQueryParams,
  ) => Promise<Result<GetUserQueryOutput | undefined, RepositoryError>>;
};
