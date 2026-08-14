import type { ContentfulStatusCode } from "hono/utils/http-status";

import type { BadRequestError } from "~/shared/errors/bad-request-error";
import type { ConflictError } from "~/shared/errors/conflict-error";
import type { ErrorDetail } from "~/shared/errors/error-detail";
import type { ForbiddenError } from "~/shared/errors/forbidden-error";
import type { InternalServerError } from "~/shared/errors/internal-server-error";
import type { MailAddressDuplicationError } from "~/shared/errors/mail-address-duplication-error";
import type { RepositoryError } from "~/shared/errors/repository-error";
import type { ResourceNotFoundError } from "~/shared/errors/resource-not-found-error";
import type { UnauthorizedError } from "~/shared/errors/unauthorized-error";

import { ErrorCode } from "../constants/error-code";
import { ErrorMessage } from "../constants/error-message";
import { HttpStatus } from "../constants/http-status";

/**
 * presentation 層が HTTP に翻訳できるエラーの集合。ステータスの昇順に並べる。
 *
 * 末尾の 2 つが 500 で、役割が違う。`RepositoryError` は**インフラ由来と分かっている**
 * 失敗、`InternalServerError` は**それ以外すべて**（throw されたものの受け皿）。
 * 後者があることで、500 の出口がこの表 1 つに閉じる。
 */
export type ApplicationError =
  | BadRequestError
  | UnauthorizedError
  | ForbiddenError
  | ResourceNotFoundError
  | ConflictError
  | MailAddressDuplicationError
  | RepositoryError
  | InternalServerError;

export type ErrorBody = {
  readonly errorCode: ErrorCode;
  readonly message: string;
  readonly details?: readonly ErrorDetail[];
};

export type ErrorResponse = {
  readonly status: ContentfulStatusCode;
  readonly body: ErrorBody;
};

/** details は未指定ならキー自体を落とす (契約上も任意項目のため)。 */
const errorBody = (params: {
  readonly errorCode: ErrorCode;
  readonly message: string;
  readonly details?: readonly ErrorDetail[];
}): ErrorBody => ({
  errorCode: params.errorCode,
  message: params.message,
  ...(params.details === undefined ? {} : { details: params.details }),
});

/** 500 の応答は 2 つの事由で共有する (外から見て区別がつかないのが正しい)。 */
const internalServerErrorResponse: ErrorResponse = {
  status: HttpStatus.InternalServerError,
  body: errorBody({
    errorCode: ErrorCode.InternalServerError,
    message: ErrorMessage.InternalServerError,
  }),
};

/**
 * ドメイン/アプリケーションのエラーを HTTP 応答へ翻訳する。
 *
 * ドメイン層は HTTP を知らないため、ステータスと errorCode の対応付けを
 * この境界に閉じ込める。`match` は**網羅性を型が見張る**ので、
 * エラーを 1 つ足すとここがコンパイルエラーになる。
 */
export const handleErrorResponse = (error: ApplicationError): ErrorResponse =>
  error.match<ApplicationError, ErrorResponse>({
    // 違反フィールドは decodeInput が details に詰めている。
    BadRequestError: (e) => ({
      status: HttpStatus.BadRequest,
      body: errorBody({
        errorCode: ErrorCode.BadRequest,
        message: e.message,
        ...(e.details === undefined ? {} : { details: e.details }),
      }),
    }),

    UnauthorizedError: () => ({
      status: HttpStatus.Unauthorized,
      body: errorBody({
        errorCode: ErrorCode.Unauthorized,
        message: ErrorMessage.Unauthorized,
      }),
    }),

    // 対象の有無に関わらず 403。認可の失敗と不在を混ぜない。
    ForbiddenError: () => ({
      status: HttpStatus.Forbidden,
      body: errorBody({
        errorCode: ErrorCode.Forbidden,
        message: ErrorMessage.Forbidden,
      }),
    }),

    ResourceNotFoundError: () => ({
      status: HttpStatus.NotFound,
      body: errorBody({
        errorCode: ErrorCode.ResourceNotFound,
        message: ErrorMessage.NotFound,
      }),
    }),

    ConflictError: (e) => ({
      status: HttpStatus.Conflict,
      body: errorBody({
        errorCode: ErrorCode.Conflict,
        message: e.message,
      }),
    }),

    MailAddressDuplicationError: () => ({
      status: HttpStatus.Conflict,
      body: errorBody({
        errorCode: ErrorCode.MailAddressDuplication,
        message: ErrorMessage.MailAddressDuplication,
      }),
    }),

    // インフラ由来。原因 (cause) は外に出さず、ログにのみ残す。
    RepositoryError: () => internalServerErrorResponse,

    // 型付きエラーに翻訳できなかったもの (throw されたものの受け皿)。
    // 外に見せる形は RepositoryError と同じ — **どこで壊れたかを客に教えない**。
    InternalServerError: () => internalServerErrorResponse,
  });
