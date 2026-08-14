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

## 「2 週間」が 2 箇所に手書きされている

リフレッシュトークンの寿命が domain と presentation の両方に別々に書かれていて、
**片方だけ直しても何も落ちない**。

```ts
// src/contexts/auth/domain/model/refresh-token.ts
const TTL_MILLIS = 14 * 24 * 60 * 60 * 1000; // 券の寿命 (2 週間)

// src/contexts/auth/presentation/refresh-cookie.ts
const MAX_AGE_SECONDS = 14 * 24 * 60 * 60; // Cookie の Max-Age (2 週間)
```

どちらのコメントにも「揃えろ」と書いてあるだけで、**強制する仕組みが無い**。

### ズレると何が起きるか

**短いほうが先に効く。**

| ズレの向き        | 起きること                                                |
| ----------------- | --------------------------------------------------------- |
| Cookie が**短い** | DB では生きている券をブラウザが先に捨てる → 再ログイン    |
| Cookie が**長い** | ブラウザは券を持っているが DB 側が期限切れ → 401 が増える |

どちらも「ログアウトされた」としか見えないので、**原因に辿り着きにくい**。

### なぜ後回しにしたか

単位が違う（ミリ秒 / 秒）ので、単に定数を共有するだけでは済まない。
`auth/presentation` のレビューに入るとき、Cookie 周りをまとめて見るほうが早い。

### 着手するとき

依存の向きは問題にならない。**presentation → domain は内向きで許されている**
（`refresh-cookie.ts` から `refresh-token.ts` を import できる）。

|       | 案                                                           | 備考                                 |
| ----- | ------------------------------------------------------------ | ------------------------------------ |
| **A** | domain が「日数」を持ち、両者がそこから計算する              | 単位の変換をそれぞれの層でやる       |
| B     | domain が `TTL_MILLIS` を公開し、presentation が 1000 で割る | presentation にミリ秒→秒の計算が入る |
| C     | 現状のまま、テストで一致を固定する                           | 構造を変えずに済むが、重複自体は残る |

**引き金は `auth/presentation` のレビュー。** Cookie 設定の置き場
（このファイルの最初の項目）と同時に扱うことになる。

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

## `CLAUDE.md` を整える

**暫定版は置いた。** レビューの途中で拾ったものを並べただけなので、
一巡し終えたら構成ごと見直す。

見直すときに決めること:

- **どこまで書くか。** lint で機械的に強制できるものは規約に書かず lint へ寄せる
  （二重管理になり、片方だけ直して気付かない形になる）
- **コードのコメントとの棲み分け。** いまは同じ説明が両方にある箇所がある
  （zod の組み込みバリデータを使わない理由など）
- レビューの残り（`contexts/*/application` 以降）で出た規約の追記
