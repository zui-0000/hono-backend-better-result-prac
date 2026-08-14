/**
 * API のエラーコード体系。`<HTTP ステータス><連番>` の 4 桁。
 * 専用コードを足すのは**クライアントが分岐する必要のある事由**だけ。
 */
export const ErrorCode = {
  /** 400 リクエスト内容が不正 (汎用) */
  BadRequest: "4000",
  /** 401 認証情報が不正 (汎用) */
  Unauthorized: "4010",
  /** 401 現在のパスワードが一致しない (パスワード変更でのみ返す) */
  PasswordMismatch: "4011",
  /** 403 操作する権限が無い (汎用) */
  Forbidden: "4030",
  /** 404 リソースが存在しない (汎用。経路の打ち間違いもここに含める) */
  ResourceNotFound: "4040",
  /** 409 リソースの現在の状態と衝突する (汎用) */
  Conflict: "4090",
  /** 409 メールアドレスが既に使用されている */
  MailAddressDuplication: "4091",
  /** 500 サーバー内部で予期せぬエラーが発生した (汎用) */
  InternalServerError: "5000",
} as const;

export type ErrorCode = (typeof ErrorCode)[keyof typeof ErrorCode];
