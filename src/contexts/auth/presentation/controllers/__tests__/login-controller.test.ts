import { describe, expect, test } from "bun:test";

import { Result } from "better-result";

import { makeDeps } from "~/__mocks__/app-deps";
import {
  cookieValueOf,
  FAKE_ACCESS_TOKEN,
  FAKE_REFRESH_TOKEN,
  FAKE_TOKEN_HASH,
  FIXED_UUID,
  headers,
  OTHER_UUID,
  setCookieOf,
} from "~/__mocks__/data";
import { app } from "~/app";
import type { AppDeps } from "~/app-deps";
import type { RefreshToken } from "~/contexts/auth/domain/model/refresh-token";
import { RefreshTokenHash } from "~/contexts/auth/domain/model/value-objects/refresh-token-hash";
import { UserId } from "~/contexts/user/domain/model/value-objects/user-id";
import { ErrorCode } from "~/shared/presentation/constants/error-code";
import { HttpStatus } from "~/shared/presentation/constants/http-status";

import { loginController } from "../login-controller";

const VALID = { mailAddress: "existing@example.com", password: "password1234" };

const login = async (
  deps: AppDeps,
  body: Record<string, unknown> = VALID,
): Promise<Response> =>
  await app(deps).request("/auth/login", {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });

describe(loginController.name, () => {
  test("照合できれば 200。券は本文と Cookie に振り分けること", async () => {
    const created: RefreshToken[] = [];
    const claims: { sub: string; sid: string }[] = [];
    const deps = makeDeps({
      verifyCredentialsQueryService: {
        execute: async () => Result.ok(UserId.parse(OTHER_UUID)),
      },
      refreshTokenRepository: {
        create: async (token) => {
          created.push(token);
          return Result.ok();
        },
      },
      accessTokenIssuer: {
        issue: async (payload) => {
          claims.push(payload);
          return FAKE_ACCESS_TOKEN;
        },
      },
    });

    const response = await login(deps);

    expect(response.status).toBe(HttpStatus.Ok);
    // **本文に券は載らない。** 載せると JS から読めて XSS で盗まれる。
    expect(await response.json()).toStrictEqual({
      accessToken: FAKE_ACCESS_TOKEN,
    });

    expect(cookieValueOf(response)).toBe(FAKE_REFRESH_TOKEN);
    const setCookie = setCookieOf(response) ?? "";
    expect(setCookie).toContain("HttpOnly");
    expect(setCookie).toContain("Path=/auth/refresh");
    expect(setCookie).toContain("SameSite=Lax");

    // **保存されるのはハッシュだけ。** 平文の券が DB に残らないこと。
    expect(created).toHaveLength(1);
    expect(created[0]?.tokenHash).toBe(RefreshTokenHash.parse(FAKE_TOKEN_HASH));
    expect(JSON.stringify(created[0])).not.toContain(FAKE_REFRESH_TOKEN);

    // sid はセッション (ログインごとに採番)。sub は利用者。
    expect(claims[0]?.sid).toBe(FIXED_UUID);
    expect(claims[0]?.sub).toBe(OTHER_UUID);
  });

  test("照合できなければ 401。Cookie も出さないこと", async () => {
    // 既定の fake は undefined = 照合できない。「居ない」と「合わない」は
    // user 側で畳まれているので、ここからは区別のしようがない。
    const response = await login(makeDeps());

    expect(response.status).toBe(HttpStatus.Unauthorized);
    expect(setCookieOf(response)).toBeNull();
    expect(((await response.json()) as { code: string }).code).toBe(
      ErrorCode.Unauthorized,
    );
  });

  test("契約に反する入力は 400", async () => {
    const response = await login(makeDeps(), {
      mailAddress: "x",
      password: "short",
    });
    expect(response.status).toBe(HttpStatus.BadRequest);
  });
});
