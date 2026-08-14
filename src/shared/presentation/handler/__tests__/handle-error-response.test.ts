import { describe, expect, test } from "bun:test";

import type { ContentfulStatusCode } from "hono/utils/http-status";

import { MailAddress } from "~/shared/domain/model/value-objects/mail-address";
import { BadRequestError } from "~/shared/errors/bad-request-error";
import { ConflictError } from "~/shared/errors/conflict-error";
import { ForbiddenError } from "~/shared/errors/forbidden-error";
import { InternalServerError } from "~/shared/errors/internal-server-error";
import { MailAddressDuplicationError } from "~/shared/errors/mail-address-duplication-error";
import { PasswordMismatchError } from "~/shared/errors/password-mismatch-error";
import { RepositoryError } from "~/shared/errors/repository-error";
import { ResourceNotFoundError } from "~/shared/errors/resource-not-found-error";
import { UnauthorizedError } from "~/shared/errors/unauthorized-error";

import type { ErrorCode } from "../../constants/error-code";
import { ErrorMessage } from "../../constants/error-message";
import { HttpStatus } from "../../constants/http-status";
import {
  type ApplicationError,
  handleErrorResponse,
} from "../handle-error-response";

/**
 * status / errorCode / message の**三つ組**を固定する。
 *
 * `.match()` はハンドラの数え落としを型が見張るが、**中身の取り違えは見張らない** —
 * ForbiddenError の枝に 404 と Conflict の errorCode を書いても通る。
 * この表がそこを埋める。
 *
 * errorCode は外向きの契約なので、値が変わればクライアントの分岐が壊れる。
 * だから定数ではなく**リテラルで書く** — 定数を書き換えると、この表の値が
 * `ErrorCode` に含まれなくなって**型エラーになる** (テストを待たずに止まる)。
 *
 * 並びは「題名に出す値 → エラー本体」の順。`test.each` の `%s` / `%i` は
 * タプルの位置に対応するので、オブジェクトが間に挟まると題名が崩れる (実測)。
 */
const CASES: readonly (readonly [
  string,
  ContentfulStatusCode,
  ErrorCode,
  ErrorMessage,
  ApplicationError,
])[] = [
  [
    "BadRequestError",
    400,
    "4000",
    ErrorMessage.BadRequest,
    new BadRequestError({ message: ErrorMessage.BadRequest }),
  ],
  [
    "UnauthorizedError",
    401,
    "4010",
    ErrorMessage.Unauthorized,
    new UnauthorizedError(),
  ],
  [
    "PasswordMismatchError",
    401,
    "4011",
    ErrorMessage.PasswordMismatch,
    new PasswordMismatchError(),
  ],
  ["ForbiddenError", 403, "4030", ErrorMessage.Forbidden, new ForbiddenError()],
  [
    "ResourceNotFoundError",
    404,
    "4040",
    ErrorMessage.ResourceNotFound,
    new ResourceNotFoundError(),
  ],
  [
    "ConflictError",
    409,
    "4090",
    ErrorMessage.Conflict,
    new ConflictError({ message: ErrorMessage.Conflict }),
  ],
  [
    "MailAddressDuplicationError",
    409,
    "4091",
    ErrorMessage.MailAddressDuplication,
    new MailAddressDuplicationError({
      mailAddress: MailAddress.parse("taken@example.com"),
    }),
  ],
  [
    "RepositoryError",
    500,
    "5000",
    ErrorMessage.InternalServerError,
    new RepositoryError({ failure: "unavailable", cause: "db down" }),
  ],
  [
    "InternalServerError",
    500,
    "5000",
    ErrorMessage.InternalServerError,
    new InternalServerError({ cause: "boom" }),
  ],
];

describe(handleErrorResponse.name, () => {
  test.each(CASES)(
    "%s は %i / errorCode %s を返すこと",
    (_tag, status, errorCode, message, error) => {
      const response = handleErrorResponse(error);

      expect(response.status).toBe(status);
      expect(response.body.errorCode).toBe(errorCode);
      expect(response.body.message).toBe(message);
    },
  );

  test("翻訳できるエラーをすべて並べていること", () => {
    // 型が数え落としを見張るのは `.match()` の側だけ。この表に足し忘れると
    // 新しいエラーの三つ組が無検査のまま出ていくので、件数でも見張る。
    expect(CASES).toHaveLength(9);
  });

  test("500 の 2 つが外から区別できないこと", () => {
    // RepositoryError と InternalServerError は事由が違うが、**どこで壊れたかを
    // 客に教えない**。原因は logFailure がログにのみ残す。
    const repository = handleErrorResponse(
      new RepositoryError({ failure: "unavailable", cause: "db down" }),
    );
    const internal = handleErrorResponse(
      new InternalServerError({ cause: "boom" }),
    );

    expect(repository).toStrictEqual(internal);
  });

  test("details は持っているときだけ載せること", () => {
    // 契約上も任意項目。空配列やキーだけの undefined を返さない。
    const withDetails = handleErrorResponse(
      new BadRequestError({
        message: ErrorMessage.BadRequest,
        details: [{ field: "name", message: "必須です" }],
      }),
    );
    const without = handleErrorResponse(
      new BadRequestError({ message: ErrorMessage.BadRequest }),
    );

    expect(withDetails.body.details).toStrictEqual([
      { field: "name", message: "必須です" },
    ]);
    expect("details" in without.body).toBe(false);
  });

  test("同じ errorCode を 2 つの事由に割り当てていないこと", () => {
    // 同じコードが 2 つ出ると、クライアントはどちらか分からず分岐できない。
    // 500 の 2 つだけは「区別させない」のが狙いなので除く。
    const codes = CASES.filter(([tag]) => tag !== "InternalServerError").map(
      ([, , errorCode]) => errorCode,
    );

    expect(new Set(codes).size).toBe(codes.length);
  });

  test("採番規則 (先頭 3 桁 = 作られたときのステータス) に従っていること", () => {
    // 規則が崩れると、コードから status を推し量る読み方ができなくなる。
    for (const [tag, status, errorCode] of CASES) {
      expect(`${tag}: ${errorCode.slice(0, 3)}`).toBe(
        `${tag}: ${String(status)}`,
      );
    }
  });

  test("status がすべて HttpStatus に定義されていること", () => {
    // 表にはリテラルで書いてあるので、定数側とズレていないかを見る。
    const defined = new Set<number>(Object.values(HttpStatus));

    for (const [, status] of CASES) {
      expect(defined).toContain(status);
    }
  });
});
