import { describe, expect, test } from "bun:test";

import type { Clock } from "~/shared/domain/clock";

import {
  classifyRefreshToken,
  type RefreshToken,
  RefreshTokenState,
  RevokedReason,
} from "../refresh-token";

const NOW = new Date("2026-08-14T00:00:00.000Z");
const clock: Clock = { now: () => NOW };

/** 既定は「使える券」。試したい状態だけ差し替える。 */
const makeToken = (over: Partial<RefreshToken> = {}): RefreshToken =>
  ({
    id: "019fde14-54da-7000-85b3-d7e794ca99f6",
    sessionId: "019fa5bc-2222-7000-8000-000000000000",
    tokenHash: "0".repeat(64),
    userId: "019fa5bc-0000-7000-8000-000000000000",
    expiresAt: new Date(NOW.getTime() + 60_000),
    revokedAt: null,
    revokedReason: null,
    createdAt: NOW,
    ...over,
  }) as RefreshToken;

const secondsAgo = (seconds: number): Date =>
  new Date(NOW.getTime() - seconds * 1000);

describe(classifyRefreshToken.name, () => {
  test("失効しておらず期限内なら usable", () => {
    expect(classifyRefreshToken({ clock }, makeToken())).toBe(
      RefreshTokenState.Usable,
    );
  });

  test("期限切れは、失効の有無より先に expired", () => {
    // 期限を先に見るのは、切れた券に猶予期間を与えないため。
    const token = makeToken({
      expiresAt: secondsAgo(1),
      revokedAt: secondsAgo(1),
      revokedReason: RevokedReason.Rotated,
    });

    expect(classifyRefreshToken({ clock }, token)).toBe(
      RefreshTokenState.Expired,
    );
  });

  test("ローテーション済みで 30 秒ちょうどは猶予の内側", () => {
    // 境界を内側に倒す。並行更新したタブを締め出さないため。
    const token = makeToken({
      revokedAt: secondsAgo(30),
      revokedReason: RevokedReason.Rotated,
    });

    expect(classifyRefreshToken({ clock }, token)).toBe(
      RefreshTokenState.WithinGrace,
    );
  });

  test("ローテーション済みで 30 秒を超えたら再利用 (盗難のサイン)", () => {
    const token = makeToken({
      revokedAt: secondsAgo(31),
      revokedReason: RevokedReason.Rotated,
    });

    expect(classifyRefreshToken({ clock }, token)).toBe(
      RefreshTokenState.Reused,
    );
  });

  test("理由が revoked なら、猶予期間の内でも revoked", () => {
    // **ここが要。** 時刻だけで判定すると、ログアウトや盗難検出で切った券が
    // 30 秒間通ってしまい、切ったはずのセッションが生き返る (実際に踏んだ穴)。
    const token = makeToken({
      revokedAt: secondsAgo(5),
      revokedReason: RevokedReason.Revoked,
    });

    expect(classifyRefreshToken({ clock }, token)).toBe(
      RefreshTokenState.Revoked,
    );
  });

  test("理由が読めない行は revoked に倒すこと", () => {
    // 迷ったら猶予を与えないほうが安全側に落ちる。
    const token = makeToken({ revokedAt: secondsAgo(5), revokedReason: null });

    expect(classifyRefreshToken({ clock }, token)).toBe(
      RefreshTokenState.Revoked,
    );
  });
});
