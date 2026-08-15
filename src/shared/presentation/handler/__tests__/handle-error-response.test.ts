import { describe, expect, test } from "bun:test";

import type * as z from "zod";

import {
  ChangePassword401Response,
  CreateUser409Response,
  GetUser400Response,
  GetUser401Response,
  GetUser403Response,
  GetUser404Response,
  GetUser500Response,
} from "~/generated/users";
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
import { ErrorTitle } from "../../constants/error-title";
import {
  type ApplicationError,
  type ErrorStatus,
  handleErrorResponse,
} from "../handle-error-response";

/**
 * status / code / title の**三つ組**を固定する。
 *
 * `.match()` はハンドラの数え落としを型が見張るが、**中身の取り違えは見張らない** —
 * ForbiddenError の枝に 404 と Conflict の code を書いても通る。
 * この表がそこを埋める。
 *
 * code は外向きの契約なので、値が変わればクライアントの分岐が壊れる。
 * だから定数ではなく**リテラルで書く** — 定数を書き換えると、この表の値が
 * `ErrorCode` に含まれなくなって**型エラーになる** (テストを待たずに止まる)。
 *
 * 並びは「題名に出す値 → エラー本体」の順。`test.each` の `%s` / `%i` は
 * タプルの位置に対応するので、オブジェクトが間に挟まると題名が崩れる (実測)。
 *
 * status の列だけ `ErrorStatus` で受ける。あれは `HttpStatus` から組んだ union なので、
 * **定数側に無い数字を書くと型で落ちる** — 実行時に確かめる必要がない。
 */
const CASES: readonly (readonly [
  string,
  ErrorStatus,
  ErrorCode,
  ErrorTitle,
  ApplicationError,
])[] = [
  [
    "BadRequestError",
    400,
    "4000",
    ErrorTitle.BadRequest,
    new BadRequestError({ title: ErrorTitle.BadRequest }),
  ],
  [
    "UnauthorizedError",
    401,
    "4010",
    ErrorTitle.Unauthorized,
    new UnauthorizedError(),
  ],
  [
    "PasswordMismatchError",
    401,
    "4011",
    ErrorTitle.PasswordMismatch,
    new PasswordMismatchError(),
  ],
  ["ForbiddenError", 403, "4030", ErrorTitle.Forbidden, new ForbiddenError()],
  [
    "ResourceNotFoundError",
    404,
    "4040",
    ErrorTitle.ResourceNotFound,
    new ResourceNotFoundError(),
  ],
  [
    "ConflictError",
    409,
    "4090",
    ErrorTitle.Conflict,
    new ConflictError({ title: ErrorTitle.Conflict }),
  ],
  [
    "MailAddressDuplicationError",
    409,
    "4091",
    ErrorTitle.MailAddressDuplication,
    new MailAddressDuplicationError({
      mailAddress: MailAddress.parse("taken@example.com"),
    }),
  ],
  [
    "RepositoryError",
    500,
    "5000",
    ErrorTitle.InternalServerError,
    new RepositoryError({ failure: "unavailable", cause: "db down" }),
  ],
  [
    "InternalServerError",
    500,
    "5000",
    ErrorTitle.InternalServerError,
    new InternalServerError({ cause: "boom" }),
  ],
];

/**
 * 応答の形を**契約の写し**で確かめるための対応表。
 *
 * この表が無いと、`errorBody` の形と契約が別々に手書きされたまま誰も突き合わせない。
 * 実際 status / code / title / errors へ組み替えたとき、両方を手で直している。
 *
 * どの操作の 4xx も同じモデルから生成されるので、代表として users の経路を使う。
 * 401 だけ `ChangePassword401Response` を当てているのは、あそこが汎用 401 と
 * PasswordMismatch の union になっており、両方の形を含むため。
 */
const SCHEMA_BY_TAG: Readonly<Record<string, z.ZodType | undefined>> = {
  BadRequestError: GetUser400Response,
  UnauthorizedError: GetUser401Response,
  PasswordMismatchError: ChangePassword401Response,
  ForbiddenError: GetUser403Response,
  ResourceNotFoundError: GetUser404Response,
  // **汎用の 409 はどの操作の契約にも現れない。** 契約に載っているのは専用の
  // MailAddressDuplication だけで、ConflictError はまだ new される場所も無い。
  ConflictError: undefined,
  MailAddressDuplicationError: CreateUser409Response,
  RepositoryError: GetUser500Response,
  InternalServerError: GetUser500Response,
};

describe(handleErrorResponse.name, () => {
  test.each(CASES)(
    "%s は %i / code %s を返すこと",
    (_tag, status, code, title, error) => {
      const response = handleErrorResponse(error);

      expect(response.status).toBe(status);
      expect(response.body.code).toBe(code);
      expect(response.body.title).toBe(title);
    },
  );

  test.each(CASES)(
    "%s はステータス行とボディに同じ %i を載せること",
    (_tag, status, _code, _title, error) => {
      // 契約が status を 2 箇所に持つので、実装も 2 箇所へ出す。
      // 組み立ては errorResponse 1 箇所に閉じているが、**閉じ続けている**ことを
      // ここで見張る (片方だけ定数を書き足す形に戻ると落ちる)。
      const response = handleErrorResponse(error);

      expect(response.body.status).toBe(response.status);
      expect(response.body.status).toBe(status);
    },
  );

  test.each(CASES.filter(([tag]) => SCHEMA_BY_TAG[tag] !== undefined))(
    "%s の応答が契約の形を満たすこと",
    (tag, _status, _code, _title, error) => {
      const schema = SCHEMA_BY_TAG[tag];
      const parsed = schema?.safeParse(handleErrorResponse(error).body);

      expect(parsed?.success).toBe(true);
      // **通っただけでは足りない。** zod の object は知らないキーを黙って落とすので、
      // 契約に無い項目を足しても safeParse は成功する。剥がした結果と突き合わせて
      // はじめて「余計なものを載せていない」ことまで言える。
      expect(parsed?.success === true ? parsed.data : null).toStrictEqual(
        handleErrorResponse(error).body,
      );
    },
  );

  test("契約に現れないエラーが ConflictError だけであること", () => {
    // 新しいエラーを足したとき、契約側の操作に載せ忘れるとここで気付ける。
    // 載っていないエラーを返すと、クライアントは知らない形を受け取ることになる。
    const uncovered = CASES.filter(
      ([tag]) => SCHEMA_BY_TAG[tag] === undefined,
    ).map(([tag]) => tag);

    expect(uncovered).toStrictEqual(["ConflictError"]);
  });

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

  test("errors は持っているときだけ載せること", () => {
    // 契約上も任意項目。空配列やキーだけの undefined を返さない。
    const withErrors = handleErrorResponse(
      new BadRequestError({
        title: ErrorTitle.BadRequest,
        errors: [{ field: "name", message: "必須です" }],
      }),
    );
    const without = handleErrorResponse(
      new BadRequestError({ title: ErrorTitle.BadRequest }),
    );

    expect(withErrors.body.errors).toStrictEqual([
      { field: "name", message: "必須です" },
    ]);
    expect("errors" in without.body).toBe(false);
  });

  test("同じ code を 2 つの事由に割り当てていないこと", () => {
    // 同じコードが 2 つ出ると、クライアントはどちらか分からず分岐できない。
    // 500 の 2 つだけは「区別させない」のが狙いなので除く。
    const codes = CASES.filter(([tag]) => tag !== "InternalServerError").map(
      ([, , code]) => code,
    );

    expect(new Set(codes).size).toBe(codes.length);
  });

  test("採番規則 (先頭 3 桁 = 作られたときのステータス) に従っていること", () => {
    // 規則が崩れると、コードから status を推し量る読み方ができなくなる。
    for (const [tag, status, code] of CASES) {
      expect(`${tag}: ${code.slice(0, 3)}`).toBe(`${tag}: ${String(status)}`);
    }
  });
});
