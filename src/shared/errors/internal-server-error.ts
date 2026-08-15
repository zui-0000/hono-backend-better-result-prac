import { TaggedError } from "better-result";

/**
 * サーバー内部で予期せぬエラーが発生した (汎用 / code 5000 / HTTP 500)。
 * 原因 (cause) は外部に露出せず、ログ等の内部利用に留める。
 */
export class InternalServerError extends TaggedError("InternalServerError")<{
  readonly cause: unknown;
}> {}
