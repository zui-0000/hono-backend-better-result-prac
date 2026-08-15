import { TaggedError } from "better-result";

/**
 * 操作する権限が無い (認可の失敗 / code 4030 / HTTP 403)。
 *
 * **対象が存在するかどうかに関わらず 403。** 認可の失敗と不在を混ぜない。
 * RFC 9110 §15.5.4 は「存在を隠したいなら 404 でもよい」と認めているが、
 * 404 に畳むと「無かった」のか「見せてもらえなかった」のかをクライアントが
 * 永久に区別できなくなる。引き換えに実在の有無は漏れる。
 */
export class ForbiddenError extends TaggedError("ForbiddenError")<{}> {}
