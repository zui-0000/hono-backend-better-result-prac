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
 * 2 週間有効な券が乗り、通り道すべてが漏洩点になる。
 */
const PATH = "/auth/refresh";

/** 2 週間。DB の expires_at と揃える (片方だけずれると挙動が割れる)。 */
const MAX_AGE_SECONDS = 14 * 24 * 60 * 60;

const MIN_LENGTH = 20;
const MAX_LENGTH = 2048;

/**
 * 契約 (`@cookie refreshToken: RefreshToken`) に対応する入力スキーマ。
 *
 * **手書きなのは orval が Cookie パラメータを生成しないから** (実測済み。ヘッダと
 * パスパラメータは生成されるのに Cookie だけ落ちる)。長さの制約は契約と二重に持つ。
 * **消せる引き金は orval が Cookie パラメータを生成するようになること。**
 */
export const RefreshCookie = z.object({
  [NAME]: z.string().min(MIN_LENGTH).max(MAX_LENGTH),
});
export type RefreshCookie = z.infer<typeof RefreshCookie>;

/** 検証済みの Cookie から券を取り出す (キー名を controller に書かせない)。 */
export const refreshTokenOf = (cookie: RefreshCookie): string => cookie[NAME];

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
 * 消さなければブラウザは 2 週間送り続け、失効済みの券が盗難検出のログを埋める。
 */
export const clearRefreshCookie = (settings: CookieSettings) =>
  attach(settings, "", 0);
