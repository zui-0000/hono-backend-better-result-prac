import type { ContentfulStatusCode } from "hono/utils/http-status";

import type { BadRequestError } from "~/shared/errors/bad-request-error";
import type { ConflictError } from "~/shared/errors/conflict-error";
import type { ErrorDetail } from "~/shared/errors/error-detail";
import type { ForbiddenError } from "~/shared/errors/forbidden-error";
import type { MailAddressDuplicationError } from "~/shared/errors/mail-address-duplication-error";
import type { RepositoryError } from "~/shared/errors/repository-error";
import type { ResourceNotFoundError } from "~/shared/errors/resource-not-found-error";
import type { UnauthorizedError } from "~/shared/errors/unauthorized-error";

import { ErrorCode } from "../constants/error-code";
import { ErrorMessage } from "../constants/error-message";
import { HttpStatus } from "../constants/http-status";

/**
 * presentation 層が HTTP に翻訳できるエラーの集合。
 * 対応する HTTP ステータスの昇順に並べる。
 */
export type ApplicationError =
  | BadRequestError
  | UnauthorizedError
  | ForbiddenError
  | ResourceNotFoundError
  | ConflictError
  | MailAddressDuplicationError
  | RepositoryError;

/** エラー応答のボディ (TypeSpec の各 *Error モデルと対応)。 */
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

/**
 * 型付きエラーに翻訳できない失敗 (throw されたもの) に対する応答。
 * 外に見せる形は 500 と同じでなければならないので、翻訳表と同じファイルに置く。
 */
export const defectResponse: ErrorResponse = {
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
    RepositoryError: () => ({
      status: HttpStatus.InternalServerError,
      body: errorBody({
        errorCode: ErrorCode.InternalServerError,
        message: ErrorMessage.InternalServerError,
      }),
    }),
  });
