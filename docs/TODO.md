# TODO

「あとで考える」と決めたものの置き場。**なぜ後回しにしたか**と、
**着手するとき何を見ればいいか**を残す（忘れるのは判断そのものより理由のほう）。

---

## Cookie 設定の扱いと置き場を再考する

`CookieSettings` が `src/shared/domain/` に居るが、**あそこの他の住人と性質が違う**。

### いまの状態

```ts
// src/shared/domain/cookie-settings.ts
export type CookieSettings = {
  readonly secure: boolean;
  readonly domain: string | undefined;
};
```

`shared/domain/` の他のものと並べると浮く。

|                      |         ドメインが使うか          | 振る舞い |
| -------------------- | :-------------------------------: | :------: |
| `Clock`              | ✅ `user.ts` / `refresh-token.ts` |   あり   |
| `UuidGenerator`      |              ✅ 同上              |   あり   |
| `PasswordHasher`     |        ✅ `user.ts` の照合        |   あり   |
| `AccessTokenIssuer`  |       ❌ presentation だけ        |   あり   |
| **`CookieSettings`** |              **❌**               | **無し** |

**唯一「ドメインが使わない、かつ振る舞いも持たない」。** ポートですらなく、ただの設定値。
実際の利用者は auth の presentation だけ（`refresh-cookie.ts` と controller 3 本）。

### なぜここに居るか

**他に置ける場所が無かった。** 境界ルールが 3 方向を塞いでいる。

```text
presentation → infrastructure         ✗ no-indirect-path-to-impl
presentation → contexts/*/domain      ✗ presentation-not-to-context-domain
shared/infrastructure → presentation  ✗ oxlint（実装が読む側に依存できない）
```

`readCookieSettings`（実装）が型を import する以上、型は **infrastructure から読める場所**に
無いといけない。`shared/presentation/` に置くと 3 番目で落ちる。残ったのが `shared/domain/`。

`contexts/auth/` に閉じる案も、`shared/infrastructure` が contexts を import できない
（`shared-not-to-contexts`）ため破綻する。

### 検討した案

|       | 案                                             | 判断                                       |
| ----- | ---------------------------------------------- | ------------------------------------------ |
| **A** | 現状のまま、コメントで「ポートではない」と明記 | **採用中。** いちばん安い                  |
| B     | `shared/config/` を新設                        | `shared/` 直下が「層の名前だけ」でなくなる |
| C     | `contexts/auth/` に閉じる                      | 境界ルールで**不可能**                     |

### 着手の引き金

**環境で変わる設定値が 2 つ目に出てきたとき。**

いまは Cookie の 1 つだけなので、置き場を作るほどの実例が無い
（このリポジトリの「実例が 1 つの間は抽象化しない」に従う）。2 つ目が出たら、
そのとき **B** を検討する。ログレベル、CORS の Origin、レートリミットの閾値あたりが候補。

もう 1 つの引き金は **CORS を入れるとき**。あれも「環境で変わる設定」なので、
Cookie と並べて置き場を決めることになる。

---

## CORS を入れる

フロントエンドを繋ぐときに必要。いまは**検証する相手がいない**ので入れていない。

```ts
cors({
  origin: "https://app.example.com", // ⚠️ credentials: true と "*" は併用できない
  credentials: true, // ⚠️ 無いと Cookie が無視される
});
```

クライアント側も `fetch(url, { credentials: "include" })` が要る。
**「Cookie が送られない」の原因はほぼこの 2 つ。**

---

## `CLAUDE.md` を書く

コードの規約（命名、ポートと実装の対応、依存の渡し方、コメントの方針）が
コミット本文とコメントにしか無い。次に触る人が最初に読む場所を作る。

書くときに拾うもの:

- ポートは `type`（`interface` にしない理由は `.oxlintrc.jsonc` にある）
- ファイル名 = ポート名。`domain/xxx.ts` と `infrastructure/xxx.ts` が対
- 実装名 = ポート名の小文字始まり。引数が要るものだけ `createXxx`
- 依存の渡し方（ユースケースはファクトリ、ドメイン関数は第 1 引数）
- zod の組み込みバリデータを使わない理由（契約と判定がズレる）
