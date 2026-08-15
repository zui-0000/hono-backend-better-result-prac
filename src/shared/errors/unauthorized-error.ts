import { TaggedError } from "better-result";

/**
 * 認証情報が不正 (汎用 / code 4010 / HTTP 401)。
 * トークン欠落・期限切れ・パスワード不一致などを表す。
 */
export class UnauthorizedError extends TaggedError("UnauthorizedError")<{}> {}
