# API 層の選定 — oRPC

[README](README.md) の本編。FE と BE の間に何を置くかを決める。

答えるのはこの 3 つ。

| 疑問                                 | 短い答え                                                    |
| ------------------------------------ | ----------------------------------------------------------- |
| なぜ oRPC なのか                     | **契約を型で強制でき、かつ OpenAPI も出せる**唯一の選択肢   |
| tRPC ではだめなのか                  | OpenAPI が出ない。**TS 以外のクライアントが来た瞬間に詰む** |
| このリポジトリのやり方と何が違うのか | 契約の正が TypeSpec から TypeScript に移る                  |

---

## 1. 候補と比較

|                 | 型安全         | OpenAPI                    | React 統合      | Hono との相性  | 成熟度           |
| --------------- | -------------- | -------------------------- | --------------- | -------------- | ---------------- |
| **oRPC**        | ◎ 契約強制あり | **◎ 一級市民**             | ◎ TanStack 公式 | ○ マウント方式 | △ v2 beta 進行中 |
| tRPC v11        | ◎              | ✗ 別プラグイン頼み         | ◎ 最強          | ○              | ◎                |
| Hono RPC (`hc`) | ○              | ✗ 別途 `@hono/zod-openapi` | △ 手書き        | ◎ ネイティブ   | ◎                |
| ts-rest         | ◎ 契約先行     | ○                          | ○               | ○              | △ 開発が緩い     |

### Hono RPC を選ばなかった理由

Hono を使うのだから素直に `hc` を使う、が最初の案だった。見送ったのは 2 点。

- **ルート数が増えると型推論が膨らむ。** 公式が型のコンパイルを推奨しているくらい
- **OpenAPI が要るなら結局 `@hono/zod-openapi` に乗り換えることになる。** ルートの
  書き方ごと変わるので、後から移るのは実質書き直し

「後で困ったら移ればいい」が成立しないので、最初から決める必要があった。

### tRPC を選ばなかった理由

成熟度は圧倒的に tRPC が上。それでも外したのは **OpenAPI が出せない**この 1 点。

`trpc-openapi` 系のプラグインは歴史的に不安定で、しかも本体の更新に追従が遅れる。
**外部契約を「本体機能ではないもの」に預けるのは、このリポジトリで学んだことと逆行する。**

---

## 2. oRPC を選んだ理由

### 2-1. 契約が型で強制される

```ts
// packages/contract — サーバもクライアントもここに依存する
export const contract = { user: { find: findUserContract } };

// apps/backend — 契約を満たさないとコンパイルエラー
const os = implement(contract);
export const router = os.router({
  user: {
    find: os.user.find.handler(({ input }) => {
      /* ... */
    }),
  },
});
```

`implement(contract)` が今の `schema/` → orval → zod と同じ強制力を持つ。
違いは**コード生成の工程が消えること**だけ。

要点は **`packages/contract` がサーバのコードを一切 import しないこと**。
このリポジトリの `contexts/<ctx>/<ctx>-deps.ts` が「ポートしか import しない」
という規律を敷いているのと、発想は完全に同じ。

### 2-2. OpenAPI が出口として残る

`OpenAPIGenerator` で spec を吐ける。`.route({ method: 'GET', path: '/users/{id}' })`
でまともな REST の形も持てる。**RPC の書き味を取っても、公開 API への逃げ道が閉じない。**

### 2-3. Standard Schema 対応

zod / valibot / arktype のどれでもよい。zod にロックされない。

---

## 3. 承知した上で払う代償

**採用の判断より、こちらを覚えておくほうが大事。** 全部踏む前提で書いておく。

### 3-1. 契約の source of truth が TypeScript に移る

一番大きい。OpenAPI が **prescriptive（規定）から descriptive（記述）に降格する**。

spec がコードに追従するので、「spec を先に直してからコードを直す」という順序が
**規律でしか維持できなくなる**（今は工程がそれを強制している）。

将来 Kotlin や Swift のクライアントが要るなら、この差が効く。

### 3-2. v2 が beta 進行中

2026-08-21 時点で stable は **1.15.0**、beta は **2.0.0-beta.29**（前日リリース）。

**v1 stable で始めて、v2 は移行ガイドが出てから。** 今 beta に乗る利得は無い。

### 3-3. Hono とは「統合」ではなく「同居」

oRPC は Hono のルーティングを使わない。**ハンドラを丸ごとマウントする。**

```ts
app.use("/rpc/*", async (c, next) => {
  const { matched, response } = await handler.handle(c.req.raw, {
    prefix: "/rpc",
  });
  if (matched) return c.newResponse(response.body, response);
  await next();
});
```

ここから 2 つ帰結する。

- **ミドルウェアが 2 系統になる。** Hono の middleware と oRPC の middleware
  （`$context` / `.use()`）。**認証は oRPC 側に寄せる**ことになる
- **body パースが衝突する。** Hono の middleware が先に body を読むと壊れる。
  公式に `Proxy` で `arrayBuffer` / `json` などを差し替える回避策が載っている。
  **知らずに踏むと原因が分からない類の罠**なので、先に控えておく

### 3-4. bus factor

★5,491 / MIT / リポジトリは `middleapi/orpc`（旧 `dinwwwh/orpc`）。
**個人メンテナから組織へ移行した直後。** tRPC のエコシステムとは比較にならない。

学習リポジトリなら許容する。仕事で選ぶなら一度立ち止まる材料。

---

## 4. バージョン（2026-08-21 実測）

| パッケージ                                 | 版            | 備考                           |
| ------------------------------------------ | ------------- | ------------------------------ |
| `@orpc/contract` / `server` / `client`     | **1.15.0**    | **ロックステップ。必ず揃える** |
| `@orpc/tanstack-query` / `openapi` / `zod` | **1.15.0**    | 同上                           |
| `@orpc/server` (beta)                      | 2.0.0-beta.29 | 採用しない                     |
| `@trpc/server`（参考）                     | 11.18.0       | —                              |
| `hono`                                     | 4.13.3        | —                              |
| `react` / `react-dom`                      | 19.2.8        | —                              |
| `@tanstack/react-query`                    | 5.101.4       | —                              |

`@orpc/*` は**バージョンがバラけると壊れる**。catalog に同居させて 1 箇所で
固定する（[リポジトリ構成](リポジトリ構成.md)）。
