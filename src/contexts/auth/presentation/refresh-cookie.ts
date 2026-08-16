import type { Result } from "better-result";
import type { CookieOptions } from "hono/utils/cookie";
import * as z from "zod";

import type { CookieSettings } from "~/shared/domain/cookie-settings";
import {
  type SuccessResponse,
  withResponseCookie,
} from "~/shared/presentation/success-response";

/**
 * リフレッシュトークンを載せる Cookie。**属性を書いてよい唯一の場所。**
 *
 * controller はここの 2 つを呼ぶだけで個々の属性に触れない。散らすと
 * 「ログアウトのときだけ Path を書き忘れて消えない」類の事故が起きる —
 * 属性が 1 つでも違うとブラウザは**別の Cookie**として扱う。
 */

/** 契約の `@cookie refreshToken` が camelCase → snake_case 変換で出す名前と一致させる。 */
const NAME = "refresh_token";

/**
 * 送る経路を `POST /auth/refresh` だけに絞る。絞らないと全リクエストに
 * 2 日有効な券が乗り、通り道すべてが漏洩点になる。
 */
const PATH = "/auth/refresh";

/**
 * 2 日。**domain の `REFRESH_TOKEN_TTL_MILLIS` と同じ長さでなければならない。**
 *
 * 直接 import して割り算にできない — presentation は `contexts/<ctx>/domain` を読めない
 * (`presentation-not-to-context-domain`)。**代わりに
 * `refresh-controller.test.ts` が両者の一致を固定している**ので、片方だけ変えると落ちる。
 */
const MAX_AGE_SECONDS = 2 * 24 * 60 * 60;

/**
 * 契約 (`@cookie refreshToken?: RefreshToken`) に対応する入力スキーマ。
 *
 * **手書きなのは orval が Cookie パラメータを生成しないから** (実測済み。ヘッダと
 * パスパラメータは生成されるのに Cookie だけ落ちる)。
 * **消せる引き金は orval が Cookie パラメータを生成するようになること。**
 *
 * **長さを見ない。** 契約は `@minLength(20)` / `@maxLength(2048)` を宣言しているが、
 * ここで再現すると**券の壊れ方で応答が 400 と 401 に割れる** — 途中で切れた Cookie は
 * 400、中身がでたらめな Cookie は 401、という具合に。呼ぶ側にとってはどちらも
 * 「認証をやり直せ」でしかないので、**券に関する失敗は全部 401 に倒す**
 * (判定は refresh-command.ts が 1 箇所で持つ)。
 */
export const RefreshCookie = z.object({
  [NAME]: z.string().optional(),
});
export type RefreshCookie = z.infer<typeof RefreshCookie>;

/** 検証済みの Cookie から券を取り出す (キー名を controller に書かせない)。 */
export const refreshTokenOf = (cookie: RefreshCookie): string | undefined =>
  cookie[NAME];

/**
 * 属性を 1 箇所で組み立てる。発行と削除で**同じ関数を通す**ので、`path` や
 * `domain` がズレようがない (ズレると消えない Cookie が残る)。変わるのは寿命だけ。
 */
const cookieOptions = (
  settings: CookieSettings,
  maxAge: number,
): CookieOptions => ({
  // JS から読めないので、XSS を踏んでも券は盗まれない。Cookie へ移した理由そのもの。
  httpOnly: true,
  secure: settings.secure,
  sameSite: "Lax",
  path: PATH,
  maxAge,
  ...(settings.domain === undefined ? {} : { domain: settings.domain }),
});

const attach =
  (settings: CookieSettings, value: string, maxAge: number) =>
  <E>(result: Result<SuccessResponse, E>): Result<SuccessResponse, E> =>
    withResponseCookie({
      name: NAME,
      value,
      options: cookieOptions(settings, maxAge),
    })(result);

/**
 * 券を Cookie に載せる。ログインと更新の両方が使う
 * (ローテーションは「同じ名前を新しい値で上書き」なので同じ関数でよい)。
 */
export const setRefreshCookie = (
  settings: CookieSettings,
  refreshToken: string,
) => attach(settings, refreshToken, MAX_AGE_SECONDS);

/**
 * Cookie を消す (ログアウト)。**サーバ側で失効させるだけでは足りない** —
 * 消さなければブラウザは 2 日送り続け、失効済みの券が盗難検出のログを埋める。
 */
export const clearRefreshCookie = (settings: CookieSettings) =>
  attach(settings, "", 0);
