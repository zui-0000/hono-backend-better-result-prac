/**
 * 現在時刻を読む。
 *
 * `new Date()` を直書きせずポートにするのは、テストで固定して**決定的に検証する**ため。
 * ドメインが時刻を要求することは deps の型に現れる。
 *
 * `Clock` は Java の `java.time.Clock` / Kotlin の `Clock.System` と同じ語彙で、
 * **日付を含む「いまの一点」**を指す (時刻だけを返す装置ではない)。
 * .NET 8 は同じ役割を `TimeProvider` に改名したが、あちらはタイマー生成まで担う。
 * ここは `now()` 1 つなので `Clock` で足りる。
 */
export type Clock = {
  readonly now: () => Date;
};
