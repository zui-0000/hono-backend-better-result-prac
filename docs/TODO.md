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

## リフレッシュ券の寿命が 2 箇所に手書きされている

domain と presentation の両方に別々に書かれている。

```ts
// src/contexts/auth/domain/model/refresh-token.ts
export const REFRESH_TOKEN_TTL_MILLIS = 2 * 24 * 60 * 60 * 1000;

// src/contexts/auth/presentation/refresh-cookie.ts
const MAX_AGE_SECONDS = 2 * 24 * 60 * 60;
```

### ズレると何が起きるか

**短いほうが先に効く。**

| ズレの向き        | 起きること                                                |
| ----------------- | --------------------------------------------------------- |
| Cookie が**短い** | DB では生きている券をブラウザが先に捨てる → 再ログイン    |
| Cookie が**長い** | ブラウザは券を持っているが DB 側が期限切れ → 401 が増える |

どちらも「ログアウトされた」としか見えないので、**原因に辿り着きにくい**。

### いまの状態: ズレたら落ちる（重複そのものは残っている）

`refresh-controller.test.ts` が Cookie の Max-Age を **domain の定数から導いて**照合する。

```ts
expect(setCookie).toContain(`Max-Age=${REFRESH_TOKEN_TTL_MILLIS / 1000}`);
```

片方だけ変えると落ちることは変異テストで確認済み
（domain だけ 3 日にする / Cookie だけ 3 日にする、どちらも fail）。

### 定数を直接共有できない理由

**当初この項目には「presentation → domain は内向きなので許されている」と書いていたが、
これは誤りだった。** 実際には例外なく禁止されている。

```js
// .dependency-cruiser.mjs
{
  name: "presentation-not-to-context-domain",
  from: { path: "^src/(contexts/[^/]+|shared)/presentation/" },
  to: { path: "^src/contexts/[^/]+/domain/" },
}
```

したがって、かつて挙げていた 2 案は**どちらも通らない**。

- ~~domain が「日数」を持ち、両者がそこから計算する~~
- ~~domain が `TTL_MILLIS` を公開し、presentation が 1000 で割る~~

テストは `exclude: (__tests__|__mocks__)/` で対象外なので、**テストからだけは両方読める**。
いまのズレ止めが成立しているのはそのおかげ。

### 残っている案

|       | 案                                                              | 備考                                                                                                               |
| ----- | --------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| **C** | テストで一致を固定する                                          | **採用中。** 構造を変えずにズレだけ止まる                                                                          |
| D     | 寿命をユースケースの出力に載せ、controller が Cookie へ反映する | 「その券の実際の期限」が Cookie に出るので最も正確。application の出力に presentation の都合が混ざらないかは要検討 |
| E     | 環境設定として `shared/` に置く                                 | `CookieSettings` の置き場（この文書の最初の項目）と同じ問題に合流する                                              |

### 着手の引き金

**`auth/presentation` のレビュー**、または `CookieSettings` の置き場を決めるとき。
どちらも「層をまたぐ設定値をどこに置くか」という同じ問題なので、まとめて解くほうが早い。

---

## アクセストークンの寿命がテストで固定されていない

```ts
// src/shared/infrastructure/access-token-issuer.ts
const TTL_SECONDS = 60 * 60;
```

この数字は**「取り消しが効くまでの最大遅延」そのもの**（ログアウト・退会・
パスワード変更による失効が、この時間だけ発行済みの券に届かない）。
にもかかわらず**固定しているテストが無い**。

リフレッシュ側は `refresh-token.test.ts` と `refresh-controller.test.ts` が
二重に固定しているので、**非対称になっている**。

### なぜ書いていないか

`src/**/infrastructure/` に**テストが 1 本も無い**。薄いアダプタは API テストと
実 DB 検証で担保する、という現状の線引きに従っている。ここに 1 本置くと
「infrastructure もテストする」という方針を暗黙に始めることになるので、
先に線引きを決めたい。

### 着手するとき

|       | 案                                  | 備考                                                                                                                                      |
| ----- | ----------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| A     | infrastructure にテストを置き始める | 最初の 1 本になる。「どこまで書くか」を決める必要がある                                                                                   |
| B     | 寿命を domain 側へ移す              | 業務が決める数字なので置き場としては筋がいい。ただし `AccessTokenIssuer` は `shared/domain` にあり、`CookieSettings` と同じ問題に合流する |
| **C** | 現状のまま                          | **採用中。** 変えるときは実 DB で `exp - iat` を目視確認する                                                                              |

**引き金は寿命を次に変えるとき、または infrastructure のテスト方針を決めるとき。**

---

## 合成ルートで組み立て関数と出来上がりが同名になる

`create` を配線から外した（[`CLAUDE.md`](../CLAUDE.md) の「命名」）結果、
**import した組み立て関数と、それが作る出来上がりが同じ名前を欲しがる**ようになった。

### いまの状態

```ts
// src/app-deps.ts
import { userRepository } from "~/contexts/user/infrastructure/user-repository";

const userRepository = userRepository(params.db);
//    ReferenceError: Cannot access 'userRepository' before initialization.
```

`const` はブロック全体に名前を張るので、**右辺も import ではなくまだ初期化されていない
自分自身**を指す（TDZ）。`create` が付いていた頃は名前が割れていたので起きなかった。

凌ぎとして、**2 度使うものだけ**局所名を集合名にしてある。

```ts
const users = userRepository(params.db);
const refreshTokens = refreshTokenRepository(params.db);
```

1 度きりのものは直接呼べる。**オブジェクトのキーは束縛を作らない**ため
（`getUserQueryService: getUserQueryService(params.db)` は左が property 名、右が import）。

同じ理由で 2 箇所いじった。

| 場所                                              | 変えたもの                | before → after    |
| ------------------------------------------------- | ------------------------- | ----------------- |
| `src/app.ts`                                      | Hono インスタンスの局所名 | `app` → `routes`  |
| `src/shared/infrastructure/db/database-client.ts` | `closeDatabase` の引数名  | `database` → `db` |

### なぜ後回しにしたか

**3 箇所とも局所名で、外に見える面は無傷。** 実害が出ているわけではない。
`app.ts` の `routes` はむしろ `*-routes.ts` と書き方が揃った。

残る違和感は `app-deps.ts` の `users` / `refreshTokens` だけで、これは
**合成ルートをどう読ませるか**の話になる。単独で決めるより、`app.ts` /
`*-routes.ts` / controller の命名を一望するときに一緒に決めるほうが早い。

### 検討した案

|       | 案                                                               | 備考                               |
| ----- | ---------------------------------------------------------------- | ---------------------------------- |
| **A** | 2 度使うものだけ局所名を集合名にする                             | **採用中。** 差分が最小            |
| B     | すべて `repositories` などに束ねてから配る                       | 層ごとの区切りコメントが分断される |
| C     | import に別名を付ける（`userRepository as buildUserRepository`） | 合成ルートだけ別の語彙になる       |
| D     | 配線にも `create` を戻す                                         | 命名表ごと差し戻し                 |

### 着手の引き金

**`contexts/*/presentation` のレビュー。** `app.ts` の `routes`、`*-routes.ts`、
controller の命名を並べて見るときに、合成ルートの局所名も一緒に決める。

---

## `handleWithResult` だけ deps が 2 番目にある

依存の渡し方は「**配線点なら先に食わせる**」で揃っている
（[`CLAUDE.md`](../CLAUDE.md) の「依存の渡し方」）。**この 1 本だけ順序が逆。**

### いまの状態

```ts
export const handleWithResult =
  <Req, Auth>(spec: Spec<Req, Auth>) =>                      // ← spec が先
  (deps: { readonly accessTokenIssuer: AccessTokenIssuer }) => // ← deps が後
  async (c) => { ... };
```

呼び出し側はこうなる。

```ts
routes.post(
  "/login",
  handleWithResult({
    request: { header: LoginHeader, body: LoginBody },
    controller: loginController(deps),
  })(deps), // ← 複数行のリテラルの末尾にぶら下がる
);
```

他はすべて `xxx(deps)(...)` の形（`loginCommand(deps)(input)` /
`getUserController(deps)` / `userRoutes(deps)` / `app(deps)`）。
**ここだけ読む順が違う**うえ、長いリテラルの後ろに付くので見落としやすい。

### なぜ後回しにしたか

**動作は正しく、型も通っている。** 読みやすさだけの話なので、経路の宣言
（`*-routes.ts`）をまとめて見るときに決めるほうが早い。呼び出しは
auth 3 本 + user 5 本の計 8 箇所で、機械的に直せる。

### 検討した案

|       | 案                                                       | 備考                             |
| ----- | -------------------------------------------------------- | -------------------------------- |
| **A** | `handleWithResult(deps)(spec)` に入れ替える              | 他と揃う。8 箇所の呼び出しを直す |
| B     | 引数 1 つに畳む（`handleWithResult({ ...spec, deps })`） | 経路の宣言に deps が混ざる       |
| C     | 現状のまま                                               | 順序が揃わない理由は説明できない |

### 着手の引き金

**`contexts/*/presentation` のレビュー。** `*-routes.ts` を一望するときに決める。

---

## テストの偽物と固定値が散らばっている

単体テストを application まで敷いた結果、**同じ形の偽物が複数のファイルに独立して
存在する**状態になった。全部緑なので実害は出ていないが、片方だけ直すと静かにズレる。

### いまの状態

| 重複しているもの                | 置かれている場所                                          |
| ------------------------------- | --------------------------------------------------------- |
| `makeStored` / `secondsBefore`  | `refresh-command.test.ts` と `refresh-controller.test.ts` |
| `recording`（呼ばれた順の記録） | **5 ファイル**（auth 3 / user 2）                         |
| `User` の固定値                 | `__mocks__/data.ts` の `makeUser` の他に **3 ファイル**   |

もう 1 つ、**要求より広い依存を渡している**。

```text
GetUserQueryDeps          1 ポート
DeleteUserCommandDeps     2 ポート
LoginCommandDeps          6 ポート
  ↓ どれにも
makeDeps()               11 項目（AppDeps）
```

型は満たせるが、テストを読んでも**そのユースケースが何を要るか**が分からない。

### なぜ後回しにしたか

**まだ困っていない。** 重複は 2〜3 箇所で、どれも意図的に近い側面もある
（ドメインのテストが自前で `User` を組むのは、作成日時を過去に置いて
「更新で動くか」を見分けるためで、共有の固定値では表現できない）。

そして寄せ方を決めるには「**単体テストでどこまでを偽物にするか**」の方針が要る。
いま寄せると、方針が決まったときに二度手間になる。

### 検討した案

|       | 案                                                     | 備考                                                                 |
| ----- | ------------------------------------------------------ | -------------------------------------------------------------------- |
| **A** | 現状のまま                                             | **採用中。** 重複は 3 種、全部緑                                     |
| B     | 重複しているものだけ `__mocks__/` へ寄せる             | 差分が小さい。`recording` は形が似ているだけで記録対象が違う点に注意 |
| C     | ユースケースごとに最小の deps を組むヘルパーを用意する | 「何を要るか」がテストに出る。8 本ぶん要る                           |
| D     | 全部 `__mocks__/` に寄せる                             | 固定値がテストから遠くなり、読むのに往復が増える                     |

### 着手の引き金

**同じ固定値を 3 箇所目に書きそうになったとき。** または
`contexts/*/presentation` のレビュー（`refresh-controller.test.ts` の
`makeStored` に触ることになるため、そこで相方と揃えられる）。

---

## login が作成時のパスワードポリシーで門番している

`schema/src/contexts/auth/LoginRequest.tsp` が作成時と同じ `Password`（12〜128 文字）を
使っている。**ポリシーを厳しくすると既存利用者がログインできなくなる。**

### いまの状態

```tsp
model LoginRequest {
  mailAddress: MailAddress;
  password: Password; // ← CreateUserRequest と同じ scalar
}
```

契約が 12 文字未満を 400 で弾き、`loginCommand` も `Password` で parse する。

### 何が起きるか

ポリシーを「16 文字以上」に変えたとき:

| 変え方                     | 12〜15 文字の既存利用者           |
| -------------------------- | --------------------------------- |
| 契約とドメインを両方変える | 契約で **400**。ログインできない  |
| ドメインだけ変える         | `Password.parse` が落ちて **500** |

どちらも**正しいパスワードを打っているのに入れない**。しかも応答から原因が読めない。

照合は「打った文字列を保存済みハッシュと突き合わせる」だけなので、**作成時のポリシーで
門番する理由が無い**。長さの上限（DoS 避け）だけあれば足りる。

### なぜ後回しにしたか

**ポリシーを変える予定がいま無い。** 変えるときに必ず踏むので、そのとき一緒に決めれば足りる。
いま直すと契約が変わり、`generate:api` からの再生成と再検証が要る。

### 検討した案

|       | 案                                     | 備考                                           |
| ----- | -------------------------------------- | ---------------------------------------------- |
| **A** | login 専用の scalar を切る（上限のみ） | 契約は**緩む**方向なのでクライアントは壊れない |
| B     | 現状のまま                             | ポリシー変更時に必ず踏む                       |

### 着手の引き金

**パスワードポリシーを変えるとき。** または `contexts/auth` の認証まわりを見直すとき。

---

## 退会済み利用者の券が行として残る

`t_refresh_token` は `t_user` に **FK を張っていない**（理由は
[`auth/infrastructure/drizzle-schema.ts`](../src/contexts/auth/infrastructure/drizzle-schema.ts)）。
退会時にセッションを失効させる手順はアプリ側に入れたが、**行そのものは消えない**。

### いまの状態

```text
DELETE /users/{id}
  → delete-user-command が SessionRevoker を呼び、券を revoked にする
  → t_user の行は消える
  → t_refresh_token の行は revoked のまま残り続ける
```

失効済みなので**使われることはない**（実 DB で 401 を確認済み）。困るのは容量と、
「誰のものでもない行」が増えて調査のとき紛れること。

### なぜ後回しにしたか

**まだ困っていない。** 券は 2 日で期限切れになるので、掃除の対象は
「期限切れ かつ 失効済み」に絞れる。行数が問題になる規模でもない。

FK + `ON DELETE CASCADE` なら 1 行で済むが、**表が物理的に結合して auth を
別 DB へ切り出す道が塞がる**ため採らなかった。

### 着手するとき

|       | 案                                         | 備考                                   |
| ----- | ------------------------------------------ | -------------------------------------- |
| **A** | 定期ジョブで期限切れかつ失効済みの行を削除 | 監査で見たい期間を先に決める           |
| B     | 退会時に行ごと消す                         | 盗難の兆候を追う手掛かりが即座に消える |
| C     | FK + `ON DELETE CASCADE`                   | 上の理由で見送り中                     |

**引き金は行数が気になったとき、または監査要件が決まったとき。**

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

## OIDC / PKCE を理解する（いまは使っていない）

**まず「そもそも何か」から。** 実装するかどうかはその後で決める。

### いまの立ち位置

うちは **OAuth も OIDC も使っていない。** 自前のログイン API がメールアドレスと
パスワードを受け取り、自前で JWT を発行しているだけ。登場人物が
**「利用者・フロント・うちの API」の 3 者しかいない**（ファーストパーティ）。

OAuth / OIDC は **第 4 の登場人物（別組織のサービス）が出てきたとき**の枠組み。
だから「いま入れるべきか」の答えは **入れようがない** になる。

### 用語の整理（ここが出発点）

| 用語                      | 一言でいうと                                               | うちとの関係                    |
| ------------------------- | ---------------------------------------------------------- | ------------------------------- |
| OAuth 2.0 (RFC 6749)      | **認可**の枠組み。「このアプリに私の代わりに◯◯させてよい」 | 使っていない                    |
| OIDC (OpenID Connect)     | OAuth 2.0 の上に載る**認証**の層。ID Token を足す          | 使っていない                    |
| Authorization Code フロー | 「認可コード」を受け取り、それをトークンと交換する         | 使っていない                    |
| PKCE (RFC 7636)           | **認可コードを横取りされても交換できなくする**仕組み       | **守る対象が無いので適用外**    |
| ID Token                  | 「この人は誰か」を**クライアントに**伝える JWT             | うちの accessToken が兼ねている |
| Access Token (RFC 6750)   | 「この API を叩いてよい」を**API に**伝える券              | うちの accessToken              |

**認証と認可は別物。** 「誰であるか」を確かめるのが認証、「何をしてよいか」を決めるのが認可。
うちは `verify-bearer.ts` が認証、`checkUserIsSelf` が認可にあたる。

### PKCE が何を守るのか（最小の説明）

Authorization Code フローでは、ブラウザのリダイレクトで「認可コード」が返ってくる。
このコードを横取りされると、攻撃者がトークンと交換できてしまう
（特にモバイルのカスタム URL スキームは他アプリが横取りできた）。

```text
1. クライアントが乱数 code_verifier を作る
2. その SHA-256 = code_challenge を認可リクエストに載せる
3. コードを交換するとき code_verifier を出す
4. 認可サーバが SHA-256(verifier) == challenge を確かめる
```

**コードを盗んでも verifier を知らないので交換できない。**

発想はうちのリフレッシュトークンのローテーション + 盗難検出と近い
（「盗まれる前提で、使われたときに無効化する」）。**理解の取っ掛かりはそこ。**

### いつ必要になるか

| きっかけ                               | 何が要るか                                          |
| -------------------------------------- | --------------------------------------------------- |
| 「Google でログイン」を足す            | うちが OAuth **クライアント**になる → **PKCE 必須** |
| モバイルアプリを足す                   | public client になる → **PKCE 必須**                |
| 他サービスにうちのアカウントで入らせる | うちが **OIDC プロバイダ**になる（一番重い）        |

RFC 9700 は **すべての Authorization Code フローで PKCE を要求**している
（かつては public client 向けの推奨だったが、いまは confidential client も対象）。

### 一緒に考慮すること: 純粋な Bearer をやめるか

RFC 9700 は **純粋な Bearer トークンより、クライアントに束縛したトークンを推奨**している。

| 方式                      | 盗まれたとき                           |
| ------------------------- | -------------------------------------- |
| **純粋な Bearer**（うち） | **持っている人が誰でも使える**         |
| DPoP (RFC 9449)           | 秘密鍵の所持を毎回証明するので使えない |
| mTLS                      | クライアント証明書が無いと使えない     |

うちは純粋な Bearer なので、[小話](認証/小話-アクセストークン.md) に書いたとおり
「盗まれたら 1 時間は使われる」という前提のまま。**寿命を縮める以外の打ち手がある**
ことは知っておく価値がある。

### 着手の引き金

**外部 ID プロバイダを足すと決めたとき、またはモバイルを足すとき。**
それまでは「読んで理解する」だけでよい。

読むもの:

- [RFC 9700](https://datatracker.ietf.org/doc/rfc9700/) — OAuth 2.0 のセキュリティ BCP。まずこれ
- [RFC 7636](https://datatracker.ietf.org/doc/html/rfc7636) — PKCE 本体
- [OpenID Connect Core 1.0](https://openid.net/specs/openid-connect-core-1_0.html) — RFC ではなく OpenID Foundation の仕様
- [RFC 9449](https://datatracker.ietf.org/doc/html/rfc9449) — DPoP（2023 年 9 月発行）

---

## ユースケースの入力 DTO を zod にするか

リクエストとレスポンスは**生成 zod で実行時に検証している**のに、ユースケースの入力だけ
素の `type` になっている。揃えるべきか。

### いまの形

```ts
// 素の型。プレゼンテーションが作れる形 (素の文字列)
export type CreateUserCommandInput = {
  readonly name: string;
  readonly mailAddress: string;
  readonly password: string;
};

// 私有の zod。**ドメインの語彙 (値オブジェクト) へ変換する**
const CreateUserCommandValues = z.object({
  name: UserName,
  mailAddress: MailAddress,
  password: Password,
});
```

**2 つある理由は「変換」であって「再検証」ではない。** 契約はプレゼンテーションで
既に見ているので、ここは brand を載せ直す段。落ちたら契約とのズレ = バグなので
`.parse()` で throw させている。

### 素直に zod へ寄せると壊れるほう

```ts
export const CreateUserCommandInput = z.object({ name: UserName, ... });
export type CreateUserCommandInput = z.infer<typeof CreateUserCommandInput>;
```

`z.infer` が**brand つき**になるので、controller が素の文字列を渡せなくなる。
直すには controller が値オブジェクトを import することになるが、
それは `presentation-not-to-context-domain` が禁じている
（[この文書の TTL の項](#リフレッシュ券の寿命が-2-箇所に手書きされている)と同じ壁）。

### 検討する案

|       | 案                                                            | 備考                                                                      |
| ----- | ------------------------------------------------------------- | ------------------------------------------------------------------------- |
| **A** | 現状のまま（素の `type` + 私有の `Values`）                   | **採用中。** 層の境界と一致している                                       |
| B     | `Input` も zod にするが中身は素の型（`z.string()` など）      | 宣言が zod で揃う。ただし**誰も実行時に検証しない**ので、型を書くのと同じ |
| C     | `Input` を値オブジェクトの zod にする                         | **境界ルールで不可能**（上記）                                            |
| D     | `Values` を公開して `Input` を消し、controller は素の値を渡す | 宣言が 1 つになる。`z.input` と `z.output` が別物になる点の整理が要る     |

**D が有望。** zod は `input` と `output` を型として区別できるので、
「外から渡す形」と「中で使う形」を 1 つのスキーマで表せる可能性がある。
ただし `z.input<typeof Values>` が本当に素の文字列になるかは要確認
（brand は output 側にしか出ないはず）。

### 着手の引き金

**`contexts/*/application` を次に触るとき。** いま困ってはいないが、
「宣言が 2 つある」ことの説明が毎回要るなら、D を試す価値がある。

---

## DI のやり方を再考する

DI コンテナを置かず、**部分適用と合成ルート**で配線している
（[`CLAUDE.md`](../CLAUDE.md) の「依存の渡し方」）。これがベストかを一度疑う。

### いまの形

```ts
xxxCommand(deps)(input); // ユースケース: 先に依存を食わせる
createUser(deps, params); // ドメイン: 第 1 引数で受ける
src / app - deps.ts; // 合成ルート。実装を知る唯一の場所
```

### 効いていること

- **魔法が無い。** 型で全部追える。コンテナの初期化順もライフサイクルも概念として要らない
- テストで差し替えるのが自明（`makeDeps()` を渡すだけ）
- 実装を知る場所が 1 箇所に閉じており、lint がそれを強制している

### 引っかかっていること

- **依存の束が要求より広い。** `deleteUserController(deps: UserDeps)` は
  `UserDeps` 丸ごとを受けるが、実際に要るのは 2 ポート
  （この文書の「テストの偽物と固定値が散らばっている」でも同じ指摘）
- ポートを 1 本足すと `<ctx>-deps.ts` / `<ctx>-adapters.ts` / `app-deps.ts` を触る
- `xxx(deps)(input)` の二段が全ファイルに出る（読めるが、書く手数ではある）

### 調べる対象

|          | 手法                                        | 見るところ                                                                          |
| -------- | ------------------------------------------- | ----------------------------------------------------------------------------------- |
| **現状** | 部分適用 + 合成ルート                       | 何と比べて不足しているのか、まず言語化する                                          |
| 1        | Effect の `Context` / `Layer`               | 関数型 TS の DI としては本命。ただし `better-result` を捨てて Effect へ移る話になる |
| 2        | Reader / `ReaderTaskEither`                 | 依存をモナドで運ぶ。`Result.gen` の書き味と噛み合うかは要検証                       |
| 3        | コンテナ（tsyringe / InversifyJS / Awilix） | デコレータや文字列キーに寄るので、**型で追えなくなる方向**。相性は悪そう            |

**先に「何が困っているか」を 1 行で言えるようにすること。** 言えないなら、
それは現状で足りているということ。手法を先に選ばない。

### 着手の引き金

**コンテキストが 3 つ目になったとき**、または合成ルートが読めなくなったとき。
いまは 2 コンテキスト・11 ポートで、`app-deps.ts` は 3 ブロックに収まっている。

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
