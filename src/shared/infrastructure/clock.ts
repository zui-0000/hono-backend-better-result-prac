import type { Clock } from "~/shared/domain/clock";

/**
 * 本番実装: システム時刻。テストでは固定した実装を渡す。
 *
 * `system` と名乗るのは Kotlin の `Clock.System` / .NET の `TimeProvider.System` と
 * 同じ用法で、**「実物のプラットフォーム時計」**を指す。隣の `bunXxx` が技術名を
 * 名乗るのは差し替え候補が実在するからで (`Bun.password` ↔ 他のハッシュ実装)、
 * Clock にその対比は無い。あるのは実物か固定かだけ。
 */
export const clock: Clock = {
  now: () => new Date(),
};
