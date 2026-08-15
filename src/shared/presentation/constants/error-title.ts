/**
 * 共通基盤が返すエラーの表題 (応答の `title`)。
 */
export const ErrorTitle = {
  /** 400 リクエストが契約を満たさない (違反フィールドは errors に入る) */
  BadRequest: "リクエスト内容が不正です",
  /** 400 リクエストボディが JSON として読めない */
  MalformedJson: "リクエストボディを JSON として解釈できません",
  /** 401 認証に失敗した (どこで失敗したかは書き分けない) */
  Unauthorized: "認証情報が正しくありません",
  /** 401 現在のパスワードが一致しない (上の「書き分けない」方針の唯一の例外)。*/
  PasswordMismatch: "現在のパスワードが正しくありません",
  /** 403 対象の有無に関わらず、その操作を行う権限が無い */
  Forbidden: "この操作を行う権限がありません",
  /** 404 指定されたリソースが存在しない (汎用) */
  ResourceNotFound: "指定されたリソースは存在しません",
  /** 409 リソースの現在の状態と衝突する (汎用) */
  Conflict: "リソースの現在の状態と衝突します",
  /** 409 メールアドレスの重複 */
  MailAddressDuplication: "メールアドレスが既に使用されています",
  /** 500 想定外の失敗 (原因はログにのみ残す) */
  InternalServerError: "サーバーで予期せぬエラーが発生しました",
} as const;

export type ErrorTitle = (typeof ErrorTitle)[keyof typeof ErrorTitle];
