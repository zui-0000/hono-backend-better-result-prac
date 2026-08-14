import { defineConfig } from "orval";

// OpenAPI (TypeSpec が生成) から zod スキーマを生成する設定。
// - client: "zod" … fetch クライアント等は作らず zod スキーマのみ生成 (バックエンド検証用)
// - mode: "tags"  … タグ (Users / Auth) ごとにファイル分割
// 生成物は src/generated 配下。境界での parse 結果を Result へ写して内側へ渡す。
export default defineConfig({
  backend: {
    input: {
      target: "./schema/dist/openapi.yaml",
    },
    output: {
      client: "zod",
      mode: "tags",
      target: "./src/generated",
      override: {
        zod: {
          // レスポンスをステータスコードごとに生成する (400/409/500 のエラー型も得るため)。
          generateEachHttpStatus: true,
        },
      },
    },
    // 生成物は整形しない。
    //
    // oxfmt 0.62 から **.gitignore が無条件で尊重される**ようになり、--ignore-path で
    // 無効化できなくなった (src/generated は gitignore 済み)。afterAllFilesWrite で
    // 掛けると「Expected at least one target file」で毎回 exit 2 になるが、
    // orval 本体は成功して 🎉 を出すため失敗が見えない。
    // 生成物は gitignore 済みでレビュー対象外なので、整形されないことを受け入れる。
  },
});
