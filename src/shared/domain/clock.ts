/**
 * 現在時刻を読む。
 *
 * `new Date()` を直書きせずポートにするのは、テストで固定して**決定的に検証する**ため。
 * ドメインが時刻を要求することは deps の型に現れる。
 */
export type Clock = {
  readonly now: () => Date;
};
