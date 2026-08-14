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

/** インフラ由来の失敗だけ内訳を足す (運用が動く必要があるかの判断材料)。 */
const infraContext = (error: ApplicationError): Record<string, unknown> =>
  error._tag === "RepositoryError"
    ? {
        failure: error.failure,
        ...(error.sqlState === undefined ? {} : { sqlState: error.sqlState }),
        cause: String(error.cause),
      }
    : {};

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
      ...infraContext(error),
    });
  } else {
    write("WARN", "リクエストを受け付けられませんでした", context);
  }
};

/** 型付きエラーに翻訳できない失敗 (throw されたもの)。原因はログにだけ残す。 */
export const logDefect = (
  c: Context,
  requestId: string,
  defect: unknown,
): void => {
  write("ERROR", "リクエストの処理が異常終了しました", {
    requestId,
    method: c.req.method,
    path: c.req.path,
    defect: defect instanceof Error ? defect.stack : String(defect),
  });
};
