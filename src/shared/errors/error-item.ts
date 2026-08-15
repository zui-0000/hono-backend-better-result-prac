/**
 * エラーの内訳 (フィールド単位の指摘)。TypeSpec の ErrorItem と対応。
 *
 * 特定のエラーに属する語彙ではないため独立したファイルに置く
 * (契約側も schema/src/shared/error/ErrorItem.tsp として独立している)。
 * 現状 errors を持つのは BadRequestError だけだが、
 * 「どのフィールドが、なぜ駄目か」を返したいエラーは他にも出うる。
 *
 * ここの `message` は応答の `title` と別物。title が「何が起きたか」を 1 行で言うのに対し、
 * こちらは**どのフィールドが、なぜ駄目か**を言う。名前を分けてあるのはそのため。
 */
export type ErrorItem = {
  readonly field: string;
  readonly message: string;
};
