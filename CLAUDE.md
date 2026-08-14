# CLAUDE.md

このリポジトリで作業するときの規約。

> **暫定。** レビューの途中で拾ったものを置いている。最後にまとめて整える
> （残りの項目は [`docs/TODO.md`](docs/TODO.md)）。

---

## 依存の渡し方

DI コンテナは置かない。TypeScript は引数を渡すだけで足りる。

**渡し方が 2 通りある。使い分けは「配線点かどうか」。**

```ts
// ユースケース (application) … ファクトリで依存を先に食わせる
export const createGetUserQuery =
  (deps: { readonly getUserQueryService: GetUserQueryService }) =>
  async (input: GetUserQueryInput) => { ... };

// ドメインの関数 … 第 1 引数で受ける
export const createUser = (
  deps: { readonly uuidGenerator: UuidGenerator; readonly clock: Clock },
  params: { ... },
): User => { ... };
```

ユースケースは**合成ルートが 1 回だけ配線する点**なので部分適用にする。
ドメインの関数は呼び出し側が既に持っているものを渡すだけで、配線点ではない。

依存は `contexts/<ctx>/<ctx>-deps.ts` が型として宣言する。**ポートしか import しない**
（実装を知るのは `src/app-deps.ts` だけ）。

---

## 命名

### ファイルと識別子

```text
domain/clock.ts          type Clock              ← ポート
infrastructure/clock.ts  const clock             ← 実装
```

**ファイル名 = ポート名 = 実装名（小文字始まり）。** `domain/xxx.ts` と
`infrastructure/xxx.ts` が対になっていることが名前で読める。

実装名に技術名（`bunXxx` など）を付けない。**差し替え候補が実在しないうちは
先回りで名前を付けない** — 2 つ目が出たときに名前を付ける。

引数が要るものだけ動詞にする。

| 形               | 意味                   | 例                         |
| ---------------- | ---------------------- | -------------------------- |
| `xxx`            | 引数の要らない単体     | `clock` / `passwordHasher` |
| `createXxx(...)` | 何かを食って組み立てる | `createUserRepository(db)` |
| `readXxx(...)`   | 環境から読む           | `readCookieSettings(env)`  |

合成ルートでは形の違いがそのまま出る（前者は shorthand、後者は呼び出し）。

### エクスポート名

**バレル（`index.ts`）を置かない。** 各ファイルから直接 import するため、
エクスポート名はそれ自体で文脈が分かる形にする。

- 集約で修飾する（`Id` ではなく `UserId`、`Model` ではなく `User`）
- brand タグもグローバルに一意にする（`"User.Id"`）

---

## 型

**オブジェクトの形は `type` で書く。`interface` は使わない。**

`interface` は宣言のマージで第三者が項目を足せる。ポートは「この形で約束する」
宣言なので閉じているべき。ポートもデータの形も同じ書き方にすれば、読む側が
「これはどっち」を考えずに済む。

lint の既定は逆（`interface` を推す）なので、明示的に切ってある。
理由は [`.oxlintrc.jsonc`](.oxlintrc.jsonc) にも書いた。

**型と値は同名にする**（`MailAddress` / `User` / `ErrorCode`）。

---

## 失敗の扱い

- 失敗は `Result` で返す。`Result.gen` + `yield*` で短絡する
- 何も返さないときは `Result.ok()`（`Result.ok(undefined)` ではない）
- 「見つからない」は `T | undefined`。専用の Option 型は持ち込まない
- エラーの翻訳は**チェーンで重ねる**

```ts
(await Result.tryPromise(() => db.insert(...)))
  .mapError(handleDbError)
  .mapError(handleMailAddressDuplicationError(user))
  .map(toVoid)
```

`Result.tryPromise` の `catch` に 1 つだけ埋めると、2 つ目以降と書く場所が分かれて
**読む順と実行順がずれる**。

**HTTP への翻訳は `.match()` で網羅する**（ハンドラを落とすとコンパイルエラー）。

---

## 契約

`schema/`（TypeSpec）→ OpenAPI 3.2 → orval で zod を生成する。**契約が先。**

**zod の組み込みバリデータ（`z.email()` / `z.uuidv7()`）を使わない。**
契約は OpenAPI の `pattern` として出るため、両者がズレると壊れる。

|              | ズレの向き           | 起きること                                       |
| ------------ | -------------------- | ------------------------------------------------ |
| `z.email()`  | ドメインが**厳しい** | 契約を通った入力が `.parse()` で throw → **500** |
| `z.uuidv7()` | ドメインが**緩い**   | id の表記が 2 通り生まれ、**本人なのに 403**     |

同じ制約が契約とドメインの 2 箇所に手書きされている。**片方だけ直すと静かにズレる**
ので、値オブジェクトを触るときは契約側も必ず見ること。

---

## テスト

- ファイル名は **`<対象>.test.ts`**。対象と同じディレクトリの `__tests__/` に置く
- 単体（`pnpm test`）と API（`pnpm test:api`）を分ける
- 偽の実装と固定値は `src/__mocks__/`

---

## コメント

**「なぜ」だけを書く。** 何をしているかは型とコードが語る。

書く価値があるのは、トレードオフ・境界・踏んだ罠・**採らなかった案とその理由**。
説明が要らないコードにコメントは要らない。

---

## 検証

- コミット前に `pnpm lint:fix`（lint → 整形 → 型 → 依存構造）と `pnpm test` を通す
- **lint ルールを追加・変更したら、わざと違反するファイルを作って確認する。**
  検出されることと、**許可すべきものが通ること**の両方を確かめてから消す
- 契約や API を変えたら、テストだけでなく**実 DB を立てて通しで叩く**
  （`docker compose up -d` → `pnpm db:migrate` → `pnpm start`）

---

## コミット

Conventional Commits（`feat` / `fix` / `refactor` / `chore` + スコープ）。

- **破壊的変更マーカー `!` は、`schema/`（API 契約）が変わってクライアントが壊れる
  場合にだけ付ける。** 判定基準は「外部契約が壊れるか」
- **コミットとプッシュは指示されたときだけ行う**
- メッセージには「何をしたか」だけでなく**なぜそうしたか**を書く。
  検討して見送った案があれば、それも残す
