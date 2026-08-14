import { Result } from "better-result";
import type * as z from "zod";

import { BadRequestError } from "~/shared/errors/bad-request-error";
import type { ErrorDetail } from "~/shared/errors/error-detail";

import { ErrorMessage } from "./constants/error-message";

/**
 * zod の失敗を、契約の `details`（フィールド単位の指摘）に写す。
 * `path` は配列なので `.` で繋いでフィールド名にする (ネストした項目のため)。
 */
const toErrorDetails = (error: z.ZodError): readonly ErrorDetail[] =>
  error.issues.map((issue) => ({
    field: issue.path.join("."),
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
            message: ErrorMessage.BadRequest,
            details: toErrorDetails(parsed.error),
          }),
        );
  };
