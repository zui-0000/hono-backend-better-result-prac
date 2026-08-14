/**
 * UUID (v7) を生成するポート。テストでは固定値を返す実装を渡す。
 */
export type UuidGenerator = {
  readonly generate: () => string;
};
