import { describe, expect, test } from "bun:test";

import { UserId } from "~/contexts/user/domain/model/value-objects/user-id";
import type { Clock } from "~/shared/domain/clock";
import type { UuidGenerator } from "~/shared/domain/uuid-generator";

import {
  classifyRefreshToken,
  createRefreshToken,
  type RefreshToken,
  RefreshTokenState,
  revokeRefreshToken,
  RevokedReasonEnum,
} from "../refresh-token";
import { RefreshTokenHash } from "../value-objects/refresh-token-hash";
import { RefreshTokenId } from "../value-objects/refresh-token-id";
import { SessionId } from "../value-objects/session-id";

const NOW = new Date("2026-08-14T00:00:00.000Z");
const clock: Clock = { now: () => NOW };

const ISSUED_ID = "019fde14-54da-7000-85b3-d7e794ca99f6";
const uuidGenerator: UuidGenerator = { generate: () => ISSUED_ID };

const SESSION_ID = SessionId.parse("019fa5bc-2222-7000-8000-000000000000");
const USER_ID = UserId.parse("019fa5bc-0000-7000-8000-000000000000");
const TOKEN_HASH = RefreshTokenHash.parse("a".repeat(64));

/**
 * 既定は「使える券」。試したい状態だけ差し替える。
 *
 * `as` で黙らせず値オブジェクトを通すのは、項目を 1 つ落としても型が通ってしまう
 * のを避けるため。ここが崩れると、集約の形が変わったことにテストが気付かない。
 */
const makeToken = (over: Partial<RefreshToken> = {}): RefreshToken => ({
  id: RefreshTokenId.parse(ISSUED_ID),
  sessionId: SESSION_ID,
  tokenHash: TOKEN_HASH,
  userId: USER_ID,
  expiresAt: new Date(NOW.getTime() + 60_000),
  revokedAt: null,
  revokedReason: null,
  createdAt: NOW,
  ...over,
});

const secondsAgo = (seconds: number): Date =>
  new Date(NOW.getTime() - seconds * 1000);

describe(createRefreshToken.name, () => {
  const create = () =>
    createRefreshToken(
      { uuidGenerator, clock },
      { userId: USER_ID, sessionId: SESSION_ID, tokenHash: TOKEN_HASH },
    );

  test("寿命を 2 週間にすること", () => {
    // 業務が決めた数字。Cookie の Max-Age (1209600 秒) と揃っている必要があり、
    // ズレると DB では生きている券をブラウザが先に捨てる (逆なら 401 が増える)。
    const fortnight = 14 * 24 * 60 * 60 * 1000;

    expect(create().expiresAt).toStrictEqual(
      new Date(NOW.getTime() + fortnight),
    );
  });

  test("発行直後は失効していないこと", () => {
    // ここが null でないと、発行したその場で classifyRefreshToken が
    // revoked/reused へ倒れて、ログインした瞬間に使えない券が配られる。
    const created = create();

    expect(created.revokedAt).toBeNull();
    expect(created.revokedReason).toBeNull();
    expect(classifyRefreshToken({ clock }, created)).toBe(
      RefreshTokenState.Usable,
    );
  });

  test("券ごとに id を採番し、セッションは渡されたものを引き継ぐこと", () => {
    // 券の id はローテーションのたびに変わるが、セッションは変えない。
    // ここで採番してしまうと、古いタブからのログアウトが空振りする。
    const created = create();

    expect(created.id).toBe(RefreshTokenId.parse(ISSUED_ID));
    expect(created.sessionId).toBe(SESSION_ID);
    expect(created.userId).toBe(USER_ID);
    expect(created.tokenHash).toBe(TOKEN_HASH);
  });

  test("作成日時に採番時の時刻を入れること", () => {
    expect(create().createdAt).toStrictEqual(NOW);
  });
});

describe(revokeRefreshToken.name, () => {
  test("失効時刻と理由を記録すること", () => {
    const revoked = revokeRefreshToken(
      { clock },
      makeToken(),
      RevokedReasonEnum.Revoked,
    );

    expect(revoked.revokedAt).toStrictEqual(NOW);
    expect(revoked.revokedReason).toBe(RevokedReasonEnum.Revoked);
  });

  test("理由をそのまま渡すこと (rotated を revoked に丸めない)", () => {
    // 丸めると猶予期間が消え、並行更新したタブが締め出される。逆に revoked を
    // rotated にすると、切ったはずのセッションが 30 秒生き返る。
    const rotated = revokeRefreshToken(
      { clock },
      makeToken(),
      RevokedReasonEnum.Rotated,
    );

    expect(rotated.revokedReason).toBe(RevokedReasonEnum.Rotated);
    expect(classifyRefreshToken({ clock }, rotated)).toBe(
      RefreshTokenState.WithinGrace,
    );
  });

  test("他の項目を書き換えないこと", () => {
    const token = makeToken();
    const revoked = revokeRefreshToken(
      { clock },
      token,
      RevokedReasonEnum.Revoked,
    );

    expect(revoked.id).toBe(token.id);
    expect(revoked.sessionId).toBe(token.sessionId);
    expect(revoked.tokenHash).toBe(token.tokenHash);
    expect(revoked.userId).toBe(token.userId);
    expect(revoked.expiresAt).toStrictEqual(token.expiresAt);
    expect(revoked.createdAt).toStrictEqual(token.createdAt);
  });

  test("元の集約を書き換えないこと", () => {
    // rotate は「古い券を失効 + 新しい券を発行」を 1 単位で渡すので、
    // 元を書き換えると呼び出し側が握っている値が変わる。
    const token = makeToken();
    revokeRefreshToken({ clock }, token, RevokedReasonEnum.Revoked);

    expect(token.revokedAt).toBeNull();
    expect(token.revokedReason).toBeNull();
  });
});

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
      revokedReason: RevokedReasonEnum.Rotated,
    });

    expect(classifyRefreshToken({ clock }, token)).toBe(
      RefreshTokenState.Expired,
    );
  });

  test("ローテーション済みで 30 秒ちょうどは猶予の内側", () => {
    // 境界を内側に倒す。並行更新したタブを締め出さないため。
    const token = makeToken({
      revokedAt: secondsAgo(30),
      revokedReason: RevokedReasonEnum.Rotated,
    });

    expect(classifyRefreshToken({ clock }, token)).toBe(
      RefreshTokenState.WithinGrace,
    );
  });

  test("ローテーション済みで 30 秒を超えたら再利用 (盗難のサイン)", () => {
    const token = makeToken({
      revokedAt: secondsAgo(31),
      revokedReason: RevokedReasonEnum.Rotated,
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
      revokedReason: RevokedReasonEnum.Revoked,
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
