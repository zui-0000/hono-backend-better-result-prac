/**
 * この API が返す HTTP ステータスコード。`code` 体系と対になる。
 *
 * `as const` はリテラル型を保つため。`NoContent` が `number` に広がると、
 * 本文の有無で分かれる `SuccessResponse` の判別可能ユニオンが機能しなくなる。
 */
export const HttpStatus = {
  /** 200 取得成功 (本文あり) */
  Ok: 200,
  /** 201 作成成功 (本文あり) */
  Created: 201,
  /** 204 成功したが返す本文がない (更新・削除) */
  NoContent: 204,
  /** 400 リクエスト内容が不正 */
  BadRequest: 400,
  /** 401 認証情報が不正 */
  Unauthorized: 401,
  /** 403 操作する権限が無い */
  Forbidden: 403,
  /** 404 リソースが存在しない */
  NotFound: 404,
  /** 409 リソースの現在の状態と衝突する */
  Conflict: 409,
  /** 500 サーバー内部で予期せぬエラーが発生した */
  InternalServerError: 500,
} as const;

export type HttpStatus = (typeof HttpStatus)[keyof typeof HttpStatus];
