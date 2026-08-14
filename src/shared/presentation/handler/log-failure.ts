import type { Context } from "hono";

import type { ApplicationError } from "./handle-error-response";

/**
 * 構造化ログを 1 行で出す。**相関 ID で grep できる形**であればよいので、
 * ログライブラリは入れない。
 */
const write = (
  level: "WARN" | "ERROR",
  message: string,
  context: Record<string, unknown>,
): void => {
  const fields = Object.entries(context)
    .map(([key, value]) => `${key}=${String(value)}`)
    .join(" ");
  const line = `timestamp=${new Date().toISOString()} level=${level} message=${message} ${fields}`;
  if (level === "ERROR") {
    console.error(line);
  } else {
    console.warn(line);
  }
};

/**
 * 5xx だけ内訳を足す (運用が動く必要があるかの判断材料)。
 *
 * **原因はここにしか出さない。** 応答には定型文しか載せないので、
 * 何が起きたかを追える場所はログだけになる。
 */
const causeContext = (error: ApplicationError): Record<string, unknown> => {
  if (error._tag === "RepositoryError") {
    return {
      failure: error.failure,
      ...(error.sqlState === undefined ? {} : { sqlState: error.sqlState }),
      cause: String(error.cause),
    };
  }
  if (error._tag === "InternalServerError") {
    // 翻訳できなかったものはスタックまで残す (どこで壊れたか分からないため)。
    return {
      cause:
        error.cause instanceof Error
          ? (error.cause.stack ?? error.cause.message)
          : String(error.cause),
    };
  }
  return {};
};

/** 型付きエラーを記録する。5xx だけ ERROR、それ以外は WARN。 */
export const logFailure = (
  c: Context,
  requestId: string,
  status: number,
  error: ApplicationError,
): void => {
  const context = {
    requestId,
    method: c.req.method,
    path: c.req.path,
    status,
    errorTag: error._tag,
  };

  if (status >= 500) {
    write("ERROR", "リクエストの処理に失敗しました", {
      ...context,
      ...causeContext(error),
    });
  } else {
    write("WARN", "リクエストを受け付けられませんでした", context);
  }
};
