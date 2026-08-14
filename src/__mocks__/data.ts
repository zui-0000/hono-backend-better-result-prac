import type { User } from "~/contexts/user/domain/model/user";
import { UserHashedPassword } from "~/contexts/user/domain/model/value-objects/user-hashed-password";
import { UserId } from "~/contexts/user/domain/model/value-objects/user-id";
import { UserName } from "~/contexts/user/domain/model/value-objects/user-name";
import { MailAddress } from "~/shared/domain/model/value-objects/mail-address";
import { HttpHeader } from "~/shared/presentation/constants/http-header";

/** 採番を固定して、生成される id を予測可能にする。 */
export const FIXED_UUID = "019fa5bc-0000-7000-8000-000000000000";
export const REQUEST_ID = "019fa5bc-1111-7000-8000-000000000000";
/** 別人を表す id。「自分自身との重複」と「他人との重複」を区別するために使う。 */
export const OTHER_UUID = "019fa5bc-2222-7000-8000-000000000000";

/** UserHashedPassword は PHC 形式を要求するので、実物と同じ形にしておく。 */
export const EXISTING_HASH = "$argon2id$v=19$m=65536,t=2,p=1$c2FsdA$existing";
export const FAKE_HASH = "$argon2id$v=19$m=65536,t=2,p=1$c2FsdA$fake";

export const FAKE_REFRESH_TOKEN = "rt_fake-refresh-token-for-tests-0123456789";
export const FAKE_TOKEN_HASH =
  "0000000000000000000000000000000000000000000000000000000000000000";

/** 契約が 3 セグメント形式を要求するので形は揃える。 */
export const FAKE_ACCESS_TOKEN =
  "eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJ0ZXN0In0.signature";

export const FAKE_CLAIMS = { sub: FIXED_UUID, sid: OTHER_UUID };

/** 時刻を固定する。決定的なテストのため。 */
export const FIXED_NOW = new Date("2026-08-14T00:00:00.000Z");

/**
 * 全リクエスト共通のヘッダ。Authorization を常に載せているのは、契約が
 * `@useAuth(BearerAuth)` を宣言している経路に要るため。
 * **認証そのものを試すケースだけ**、これを使わず自前で組み立てる。
 */
export const headers = {
  "Content-Type": "application/json",
  [HttpHeader.RequestId]: REQUEST_ID,
  [HttpHeader.Authorization]: `Bearer ${FAKE_ACCESS_TOKEN}`,
};

/**
 * リフレッシュトークンを載せる Cookie の名前。
 * **実装の定数を import しない** — テストが同じ値を独立に持つことで
 * 「名前を変えたら鳴る」状態を作る。
 */
export const REFRESH_COOKIE_NAME = "refresh_token";

export const withRefreshCookie = (
  refreshToken: string,
): Record<string, string> => ({
  ...headers,
  Cookie: `${REFRESH_COOKIE_NAME}=${refreshToken}`,
});

export const setCookieOf = (response: Response): string | null =>
  response.headers.get("set-cookie");

export const cookieValueOf = (response: Response): string | undefined =>
  setCookieOf(response)?.split(";")[0]?.replace(`${REFRESH_COOKIE_NAME}=`, "");

/** 既に永続化されている User 集約。作成/更新日時は 0 に固定して差分を見やすくする。 */
export const makeUser = (
  params: { readonly id?: string; readonly mailAddress?: string } = {},
): User => ({
  id: UserId.parse(params.id ?? FIXED_UUID),
  name: UserName.parse("既存ユーザー"),
  mailAddress: MailAddress.parse(params.mailAddress ?? "existing@example.com"),
  hashedPassword: UserHashedPassword.parse(EXISTING_HASH),
  createdAt: new Date(0),
  updatedAt: new Date(0),
});
