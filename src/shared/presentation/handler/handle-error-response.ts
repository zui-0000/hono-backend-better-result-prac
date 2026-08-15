import type { BadRequestError } from "~/shared/errors/bad-request-error";
import type { ConflictError } from "~/shared/errors/conflict-error";
import type { ErrorItem } from "~/shared/errors/error-item";
import type { ForbiddenError } from "~/shared/errors/forbidden-error";
import type { InternalServerError } from "~/shared/errors/internal-server-error";
import type { MailAddressDuplicationError } from "~/shared/errors/mail-address-duplication-error";
import type { PasswordMismatchError } from "~/shared/errors/password-mismatch-error";
import type { RepositoryError } from "~/shared/errors/repository-error";
import type { ResourceNotFoundError } from "~/shared/errors/resource-not-found-error";
import type { UnauthorizedError } from "~/shared/errors/unauthorized-error";

import { ErrorCode } from "../constants/error-code";
import { ErrorTitle } from "../constants/error-title";
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
  | PasswordMismatchError
  | ForbiddenError
  | ResourceNotFoundError
  | ConflictError
  | MailAddressDuplicationError
  | RepositoryError
  | InternalServerError;

/**
 * エラー応答に使うステータス。**成功側 (200/201/204) を混ぜない**ので、
 * 本文を持てない 204 がここに紛れ込むことが型で起きない。
 */
export type ErrorStatus =
  | typeof HttpStatus.BadRequest
  | typeof HttpStatus.Unauthorized
  | typeof HttpStatus.Forbidden
  | typeof HttpStatus.NotFound
  | typeof HttpStatus.Conflict
  | typeof HttpStatus.InternalServerError;

/**
 * エラー応答の本文。契約 (schema/src/shared/error/) と 1 対 1。
 *
 * `status` がステータス行と重複するのは承知のうえ。**本文だけを取り回す読み手**
 * (ログ、通知、画面へ渡した後の値) が HTTP の応答を持たないまま判別できるようにする
 * (RFC 9457 の Problem Details も同じ理由で `status` を本文に持つ)。
 */
export type ErrorBody = {
  readonly status: ErrorStatus;
  readonly code: ErrorCode;
  readonly title: string;
  readonly errors?: readonly ErrorItem[];
};

export type ErrorResponse = {
  readonly status: ErrorStatus;
  readonly body: ErrorBody;
};

/**
 * 応答を 1 つ組み立てる。**`status` を書くのはここだけ** —
 * 受け取った 1 つの値をステータス行と本文の両方へ配るので、
 * 契約が二重に持っている値が実装でズレる余地が無い。
 *
 * `errors` は未指定ならキー自体を落とす (契約上も任意項目のため)。
 */
const errorResponse = (params: {
  readonly status: ErrorStatus;
  readonly code: ErrorCode;
  readonly title: string;
  readonly errors?: readonly ErrorItem[];
}): ErrorResponse => ({
  status: params.status,
  body: {
    status: params.status,
    code: params.code,
    title: params.title,
    ...(params.errors === undefined ? {} : { errors: params.errors }),
  },
});

/** 500 の応答は 2 つの事由で共有する (外から見て区別がつかないのが正しい)。 */
const internalServerErrorResponse: ErrorResponse = errorResponse({
  status: HttpStatus.InternalServerError,
  code: ErrorCode.InternalServerError,
  title: ErrorTitle.InternalServerError,
});

/**
 * ドメイン/アプリケーションのエラーを HTTP 応答へ翻訳する。
 *
 * ドメイン層は HTTP を知らないため、ステータスと code の対応付けを
 * この境界に閉じ込める。`match` は**網羅性を型が見張る**ので、
 * エラーを 1 つ足すとここがコンパイルエラーになる。
 */
export const handleErrorResponse = (error: ApplicationError): ErrorResponse =>
  error.match<ApplicationError, ErrorResponse>({
    // 違反フィールドは decodeInput が errors に詰めている。
    BadRequestError: (e) =>
      errorResponse({
        status: HttpStatus.BadRequest,
        code: ErrorCode.BadRequest,
        title: e.title,
        ...(e.errors === undefined ? {} : { errors: e.errors }),
      }),

    UnauthorizedError: () =>
      errorResponse({
        status: HttpStatus.Unauthorized,
        code: ErrorCode.Unauthorized,
        title: ErrorTitle.Unauthorized,
      }),

    // 401 のまま code だけ分ける (打ち間違いだとクライアントに伝えるため)。
    PasswordMismatchError: () =>
      errorResponse({
        status: HttpStatus.Unauthorized,
        code: ErrorCode.PasswordMismatch,
        title: ErrorTitle.PasswordMismatch,
      }),

    // 対象の有無に関わらず 403。認可の失敗と不在を混ぜない。
    ForbiddenError: () =>
      errorResponse({
        status: HttpStatus.Forbidden,
        code: ErrorCode.Forbidden,
        title: ErrorTitle.Forbidden,
      }),

    ResourceNotFoundError: () =>
      errorResponse({
        status: HttpStatus.NotFound,
        code: ErrorCode.ResourceNotFound,
        title: ErrorTitle.ResourceNotFound,
      }),

    ConflictError: (e) =>
      errorResponse({
        status: HttpStatus.Conflict,
        code: ErrorCode.Conflict,
        title: e.title,
      }),

    MailAddressDuplicationError: () =>
      errorResponse({
        status: HttpStatus.Conflict,
        code: ErrorCode.MailAddressDuplication,
        title: ErrorTitle.MailAddressDuplication,
      }),

    // インフラ由来。原因 (cause) は外に出さず、ログにのみ残す。
    RepositoryError: () => internalServerErrorResponse,

    // 型付きエラーに翻訳できなかったもの (throw されたものの受け皿)。
    // 外に見せる形は RepositoryError と同じ — **どこで壊れたかを客に教えない**。
    InternalServerError: () => internalServerErrorResponse,
  });
