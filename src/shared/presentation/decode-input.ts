import { Result } from "better-result";
import type * as z from "zod";

import { BadRequestError } from "~/shared/errors/bad-request-error";
import type { ErrorItem } from "~/shared/errors/error-item";

import { ErrorTitle } from "./constants/error-title";

/**
 * zod の失敗を、契約の `errors`（フィールド単位の指摘）に写す。
 *
 * `path` は配列なので `.` で繋ぐ (ネストした項目は "meta.respondedAt" になる)。
 * **空のときは "-"** — ボディ全体が不正な場合 (オブジェクトですらない等) に
 * 起きる。空文字のままだと `field` が必須項目なのに何も伝えない値になる。
 *
 * 違反は最初の 1 件で止めず全部集める。1 回のやり取りで直しきれるようにするため。
 * (zod の `safeParse` は既定でそう振る舞う)
 */
const toErrorItems = (error: z.ZodError): readonly ErrorItem[] =>
  error.issues.map((issue) => ({
    field: issue.path.length === 0 ? "-" : issue.path.join("."),
    message: issue.message,
  }));

/**
 * HTTP 由来の値から、**ユースケースの入力 DTO を組み立てる**。
 * 失敗は `BadRequestError`（違反フィールドつき）。
 *
 * **この層で唯一、controller が直接呼ぶもの。** 契約で検証済みの値を、
 * ドメインの語彙 (値オブジェクト) へ変換する役目を持つ。
 */
export const decodeInput =
  <S extends z.ZodType>(schema: S) =>
  (source: unknown): Result<z.infer<S>, BadRequestError> => {
    const parsed = schema.safeParse(source);
    return parsed.success
      ? Result.ok(parsed.data)
      : Result.err(
          new BadRequestError({
            title: ErrorTitle.BadRequest,
            errors: toErrorItems(parsed.error),
          }),
        );
  };
