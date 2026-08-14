/**
 * 共通基盤が返すエラーメッセージ。
 *
 * 文言を 1 箇所に集めるのは、同じ状況に別の言い回しが生まれるのを防ぐため
 * (クライアントが文言を頼りに分岐していると壊れる)。
 * 内部で何が起きたかは logFailure がログに残すので、ここは外に見せてよい定型文だけ。
 */
export const ErrorMessage = {
  /** 400 リクエストが契約を満たさない (違反フィールドは details に入る) */
  BadRequest: "リクエスト内容が不正です",
  /** 400 リクエストボディが JSON として読めない */
  MalformedJson: "リクエストボディを JSON として解釈できません",
  /** 401 認証に失敗した (どこで失敗したかは書き分けない) */
  Unauthorized: "認証情報が正しくありません",
  /** 403 対象の有無に関わらず、その操作を行う権限が無い */
  Forbidden: "この操作を行う権限がありません",
  /** 404 指定されたリソースが存在しない (汎用) */
  NotFound: "指定されたリソースは存在しません",
  /** 409 メールアドレスの重複 */
  MailAddressDuplication: "メールアドレスが既に使用されています",
  /** 500 想定外の失敗 (原因はログにのみ残す) */
  InternalServerError: "サーバーで予期せぬエラーが発生しました",
} as const;

export type ErrorMessage = (typeof ErrorMessage)[keyof typeof ErrorMessage];
