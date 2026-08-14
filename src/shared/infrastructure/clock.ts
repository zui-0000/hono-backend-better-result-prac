import type { Clock } from "~/shared/domain/clock";

/** 本番実装: システム時刻。テストでは固定した実装を渡す。 */
export const systemClock: Clock = {
  now: () => new Date(),
};
