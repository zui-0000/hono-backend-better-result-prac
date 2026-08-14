import type * as z from "zod";

/**
 * UUID (v7) を生成するポート。テストでは固定値を返す実装を渡す。
 *
 * 「汎用 id 源」ではなく "uuid を作る" 契約をそのまま名前にしている
 * (このシステムの id 戦略が uuidv7 で、shared/domain の `Uuid` と対になる)。
 */
export type UuidGenerator = {
  readonly next: () => string;
};

/**
 * 与えた branded uuid スキーマの新規 id を採番する (アプリ側採番)。
 *
 * 各集約は `export const generateUserId = generateBrandedUuid(UserId);` の 1 行で
 * 採番関数を得る。**生成値は必ず妥当なので、parse の失敗は throw** —
 * 起きたら採番の実装が壊れているということで、握り潰すと原因が追えなくなる。
 */
export const generateBrandedUuid =
  <S extends z.ZodType<string, string>>(schema: S) =>
  (uuidGenerator: UuidGenerator): z.infer<S> =>
    schema.parse(uuidGenerator.next());
