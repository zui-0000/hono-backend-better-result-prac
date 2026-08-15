import { Result } from "better-result";

import type { AppDeps } from "~/app-deps";
import { RefreshTokenHash } from "~/contexts/auth/domain/model/value-objects/refresh-token-hash";
import type { RefreshTokenIssuer } from "~/contexts/auth/domain/refresh-token-issuer";
import type { RefreshTokenRepository } from "~/contexts/auth/domain/refresh-token-repository";
import type { SessionRevoker } from "~/contexts/auth/public/session-revoker";
import type { GetUserQueryService } from "~/contexts/user/application/get-user-query-service";
import type { UserRepository } from "~/contexts/user/domain/user-repository";
import type { VerifyCredentialsQueryService } from "~/contexts/user/public/verify-credentials-query-service";
import type { AccessTokenIssuer } from "~/shared/domain/access-token-issuer";
import type { PasswordHasher } from "~/shared/domain/password-hasher";

import {
  FAKE_ACCESS_TOKEN,
  FAKE_CLAIMS,
  FAKE_HASH,
  FAKE_REFRESH_TOKEN,
  FAKE_TOKEN_HASH,
  FIXED_NOW,
  FIXED_UUID,
} from "./data";

/**
 * API テスト用の依存一式。**本番の実装の代わりに偽物を束ねる。**
 *
 * `createApp` は依存を引数で受け取るので、これを渡すだけで
 * 「リクエスト → 契約検証 → controller → command → ドメイン → 応答」までを
 * DB を起動せず、かつ決定的 (採番と時刻が固定) に検証できる。
 *
 * **偽物にしているのはポートの実装だけ。** その内側 (契約検証、値オブジェクトへの変換、
 * ドメインの業務ルール、エラー翻訳、応答スキーマの検証) はすべて本物が動く。
 *
 * 既定はどれも「何も無い / 成功する」に寄せてある。**検証したいものだけ
 * ケースごとに差し替える**ことで、テストの本文に「何を試しているか」だけが残る。
 */
export const makeDeps = (
  overrides: {
    readonly userRepository?: Partial<UserRepository>;
    readonly getUserQueryService?: Partial<GetUserQueryService>;
    readonly passwordHasher?: Partial<PasswordHasher>;
    readonly refreshTokenRepository?: Partial<RefreshTokenRepository>;
    readonly refreshTokenIssuer?: Partial<RefreshTokenIssuer>;
    readonly accessTokenIssuer?: Partial<AccessTokenIssuer>;
    readonly verifyCredentialsQueryService?: Partial<VerifyCredentialsQueryService>;
    readonly sessionRevoker?: Partial<SessionRevoker>;
  } = {},
): AppDeps => ({
  userRepository: {
    create: async () => Result.ok(),
    updateProfile: async () => Result.ok(),
    updatePassword: async () => Result.ok(),
    findById: async () => Result.ok(undefined),
    findByMailAddress: async () => Result.ok(undefined),
    deleteById: async () => Result.ok(),
    ...overrides.userRepository,
  },

  getUserQueryService: {
    execute: async () => Result.ok(undefined),
    ...overrides.getUserQueryService,
  },

  passwordHasher: {
    hash: async () => FAKE_HASH,
    verify: async () => true,
    ...overrides.passwordHasher,
  },

  refreshTokenRepository: {
    create: async () => Result.ok(),
    findByTokenHash: async () => Result.ok(undefined),
    rotate: async () => Result.ok(),
    revokeSession: async () => Result.ok(),
    revokeUserSessions: async () => Result.ok(),
    ...overrides.refreshTokenRepository,
  },

  refreshTokenIssuer: {
    issue: async () => ({
      token: FAKE_REFRESH_TOKEN,
      hash: RefreshTokenHash.parse(FAKE_TOKEN_HASH),
    }),
    hash: async () => RefreshTokenHash.parse(FAKE_TOKEN_HASH),
    ...overrides.refreshTokenIssuer,
  },

  accessTokenIssuer: {
    issue: async () => FAKE_ACCESS_TOKEN,
    // 既定は「検証を通る」。認証の失敗経路を見るケースだけ差し替える。
    verify: async () => Result.ok(FAKE_CLAIMS),
    ...overrides.accessTokenIssuer,
  },

  verifyCredentialsQueryService: {
    execute: async () => Result.ok(undefined),
    ...overrides.verifyCredentialsQueryService,
  },

  sessionRevoker: {
    revokeUserSessions: async () => Result.ok(),
    ...overrides.sessionRevoker,
  },

  // テストは http:// で叩くので Secure を外す。属性の値そのものを見るケースが
  // あるため、本番の既定 (secure: true) ではなくここで固定する。
  cookieSettings: { secure: false, domain: undefined },

  uuidGenerator: { generate: () => FIXED_UUID },
  clock: { now: () => FIXED_NOW },
});
