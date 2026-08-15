import "@typespec/http";
import "../error/index.tsp";

using TypeSpec.Http;

// **ステータスがステータス行とボディの 2 箇所に出る。** 承知のうえの重複で、
// エラーボディだけを取り回す読み手 (ログ、通知、画面へ渡した後の値) が
// HTTP の応答を持たないまま何が起きたかを判別できるようにするため
// (RFC 9457 の Problem Details も同じ理由で `status` を本文に持つ)。
//
// ボディ側は各モデルで**リテラルに固定**してある (`status: 400;`)。
// 生成された zod が `literal` になるので、ズレはクライアントの検証で落ちる。
// 実装側は 1 箇所で組み立てて両者に配るので、手で 2 度書く場所は無い。

/** リクエスト内容が不正 (汎用) */
model BadRequestErrorResponse {
  @statusCode statusCode: 400;
  @body error: BadRequestError;
}

/** 認証情報が不正 (汎用) */
model UnauthorizedErrorResponse {
  @statusCode statusCode: 401;
  @body error: UnauthorizedError;
}

/** 現在のパスワードが一致しない */
model PasswordMismatchErrorResponse {
  @statusCode statusCode: 401;
  @body error: PasswordMismatchError;
}

/** 操作する権限が無い (汎用) */
model ForbiddenErrorResponse {
  @statusCode statusCode: 403;
  @body error: ForbiddenError;
}

/** リソースが見つからない (汎用) */
model NotFoundErrorResponse {
  @statusCode statusCode: 404;
  @body error: ResourceNotFoundError;
}

/** リソースの現在の状態と衝突する (汎用) */
model ConflictErrorResponse {
  @statusCode statusCode: 409;
  @body error: ConflictError;
}

/** メールアドレスが既に使用されている */
model MailAddressDuplicationErrorResponse {
  @statusCode statusCode: 409;
  @body error: MailAddressDuplicationError;
}

/** サーバーエラー (汎用) */
model InternalServerErrorResponse {
  @statusCode statusCode: 500;
  @body error: InternalServerError;
}
