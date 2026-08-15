import { sql } from "drizzle-orm";
import {
  check,
  index,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";

import { RevokedReasonEnum } from "../domain/model/refresh-token";

/**
 * 許される失効理由。**ドメインの定数から引く** — ここで文字列を書き写すと、
 * 理由を足したときに DDL だけが古いまま残る。
 */
const REVOKED_REASONS = [
  RevokedReasonEnum.Rotated,
  RevokedReasonEnum.Revoked,
] as const;

/**
 * auth コンテキストが所有するテーブル定義 (Drizzle スキーマ)。
 *
 * アクセストークン用のテーブルは作らない。あれは JWT で状態を持たず、
 * 検証は署名だけで完結するため保存するものが無い
 * (方式の決定は docs/05-auth/01-our-approach.md)。
 */

/**
 * リフレッシュトークン。1 行 = 券 1 枚。
 *
 * user_id は t_user を指すが、**外部キー制約は張らない**。制約を張ると
 * 「user コンテキストの削除が auth の都合で失敗する」という結合が生まれ、
 * コンテキストを分けた意味が消えるため。参照整合性はアプリ側の手順で保つ
 * (詳細は 01-database.md「コンテキストを跨ぐ参照に FK を張らない」)。
 *
 * **その「アプリ側の手順」の実体はここ。** user/application/delete-user-command.ts が
 * auth/public/session-revoker.ts を呼び、**削除より先に**券を失効させる。
 * 順序が逆だと、失効に失敗したとき「消えた利用者の券だけが生きている」状態が残り、
 * 再試行しても直らない (相手はもう居ないので 404 になる)。
 *
 * ON DELETE CASCADE なら削除は失敗しないので上の理由は当たらないが、**表が物理的に
 * 結合して auth を別 DB へ切り出す道が塞がる**ため採らなかった。引き換えに失効済みの
 * 行は退会後も残る (掃除は docs/TODO.md)。
 */
export const tRefreshToken = pgTable(
  "t_refresh_token",
  {
    // 券 1 枚の識別子。ローテーションのたびに新しい行 = 新しい id になる。
    id: uuid("id").primaryKey(),

    // ログインからログアウトまでを貫く識別子。**ローテーションを跨いで変わらない**。
    // アクセストークン (JWT) の sid クレームに載せるのはこちら。
    //
    // 券の id を載せると、古いアクセストークンを持つタブからのログアウトが
    // 「既に失効した行」を消しにいって空振りする (新しい行が生き残る)。
    // セッション単位で持てば、どのタブから叩いても同じセッションが落ちる。
    sessionId: uuid("session_id").notNull(),

    // 券そのものではなくハッシュを保存する。漏洩時にそのまま使われないようにするため。
    // 高エントロピーな乱数なので argon2 は不要で SHA-256 で足りる
    // (総当たりの前提が違う。パスワードのように推測されうる値ではない)。
    tokenHash: text("token_hash").notNull().unique(),

    userId: uuid("user_id").notNull(),

    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),

    // 失効した時刻。**真偽値ではない**のは、ローテーション直後の猶予期間の判定に
    // 「いつ失効したか」が要るため。行を消さないのは「失効済みの券が使われた」を
    // 検出するためで、消すと盗難の兆候が「知らない券」と区別できなくなる。
    revokedAt: timestamp("revoked_at", { withTimezone: true }),

    // なぜ失効したか。**猶予期間はローテーション専用の救済**なので、
    // 時刻だけでは足りない (rotated / revoked を区別しないと、ログアウトや
    // 盗難検出のあと 30 秒間その券が通ってしまう)。
    revokedReason: text("revoked_reason", { enum: REVOKED_REASONS }),

    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    // ログアウトはセッション単位で失効させる。
    index("t_refresh_token_session_id_idx").on(table.sessionId),
    // 盗難を検出したとき、その利用者の券をまとめて切る経路。
    index("t_refresh_token_user_id_idx").on(table.userId),

    // drizzle の `enum` は TypeScript を狭めるだけで DDL には出ない (実測: 制約が
    // 無い状態では任意の文字列が入った)。読み出しは RefreshToken.parse を通るので、
    // 壊れた値は 500 になって初めて分かる。**書き込み時に落とすため**に制約を置く。
    //
    // pgEnum ではなく CHECK にしたのは、値の削除・改名が DROP/ADD CONSTRAINT だけで
    // 済むから。この語彙は増えるし名前も変わりうる (enum は型を作り直して列の移行が要る)。
    check(
      "t_refresh_token_revoked_reason_check",
      sql.raw(
        `revoked_reason in (${REVOKED_REASONS.map((r) => `'${r}'`).join(", ")})`,
      ),
    ),
  ],
);
