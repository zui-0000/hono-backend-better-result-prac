import { Result } from "better-result";
import { sign, verify } from "hono/jwt";

import type { AccessTokenIssuer } from "~/shared/domain/access-token-issuer";
import { AccessTokenClaims } from "~/shared/domain/model/access-token-claims";
import { UnauthorizedError } from "~/shared/errors/unauthorized-error";

/** 発行と検証が同じプロセスで完結するため対称鍵で足りる。 */
const ALGORITHM = "HS256";

/** アクセストークンの寿命 (秒)。短いほど失効が速いが、更新＝ DB アクセスが増える。 */
const TTL_SECONDS = 15 * 60;

/**
 * HS256 の鍵として最低限求める長さ。
 * 未設定を弾くだけでは足りない — **短い鍵は総当たりで割られ、しかも割られても
 * 正常に動いて見える**。HMAC-SHA256 の出力と同じ 256 bit ぶんを下限にする。
 */
const MINIMUM_SECRET_LENGTH = 32;

/**
 * 本番実装。hono/jwt で署名・検証する。
 *
 * **鍵の検証は生成時に行い、短ければ throw する。** 空の鍵で署名し続けると
 * 誰でも偽造できるトークンを発行しながら正常に見えるので、起動しないほうがまし。
 */
export const jwtAccessTokenIssuer = (secret: string): AccessTokenIssuer => {
  if (secret.length < MINIMUM_SECRET_LENGTH) {
    throw new Error(
      `JWT_SECRET が短すぎます (${secret.length} 文字)。` +
        `${MINIMUM_SECRET_LENGTH} 文字以上にしてください。`,
    );
  }

  return {
    issue: async (claims) => {
      const issuedAt = Math.floor(Date.now() / 1000);
      return await sign(
        { ...claims, iat: issuedAt, exp: issuedAt + TTL_SECONDS },
        secret,
        ALGORITHM,
      );
    },

    // hono/jwt の verify は期限切れも署名不正も例外で返す。どれも同じ 401 に丸め、
    // 失敗の理由は外に出さない (claims の形が違うものも「不正な券」として同じ扱い)。
    verify: async (token) => {
      try {
        const payload = await verify(token, secret, ALGORITHM);
        const parsed = AccessTokenClaims.safeParse(payload);
        return parsed.success
          ? Result.ok(parsed.data)
          : Result.err(new UnauthorizedError());
      } catch {
        return Result.err(new UnauthorizedError());
      }
    },
  };
};
