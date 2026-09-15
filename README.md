# kintone プラグイン配布サイト

自作の kintone プラグインを無料で配布するサイト。
プラグインの追加・更新は管理画面から行うので、コードを触る必要はない。

- 本番: https://plugins.to-morrow.net/
- 管理画面: https://plugins.to-morrow.net/admin
- リポジトリ: https://github.com/tomorrow0929/kintone-plugin-site
- ホスティング: AWS Amplify（アプリID `d3cec5zpyigwxh`）
- プラグインのソース: `Desktop/kintonePlugin`（Git管理していないローカルのみ）

---

## ⚠️ .ppk は絶対に置かない

`Desktop/kintonePlugin` の各フォルダにある `*.ppk` はプラグインの**署名用秘密鍵**。
プラグインIDはこの鍵から決まるので、流出すると第三者が同じIDで偽物を配布できる。

**このリポジトリにも、このサイトにも置かない。** 配布するのは `.zip` だけ。
`.gitignore` で `*.ppk` `*.pem` `*.key` を除外しているが、コミット前に一応確認する。

---

## 何でできているか

| | |
| --- | --- |
| フレームワーク | React 18 |
| ビルド | Vite 6 |
| 言語 | JavaScript（JSX）。`amplify/` だけ TypeScript（Amplify の仕様） |
| ルーティング | React Router 6（`BrowserRouter`） |
| バックエンド | AWS Amplify Gen 2 |
| ログイン | Amazon Cognito（サインアップは無効化済み） |
| データベース | DynamoDB（AppSync 経由） |
| ファイル置き場 | S3 |

### 構成図

```
      自分                          訪問者
       │                              │
  Cognito でログイン              そのまま閲覧
       │                              │
       ▼                              ▼
 ┌────────────────────────────────────────┐
 │  React / Amplify Hosting               │
 └────────────────────────────────────────┘
       │                              │
       ├── プラグイン情報 ──▶ DynamoDB（訪問者は読み取りのみ）
       └── zip / アイコン ──▶ S3      （訪問者は読み取りのみ）
```

書き込みはログイン済みのときだけ。訪問者はダウンロードと閲覧しかできない。

**料金:** どれも無料枠が大きいので、この規模ならほぼ0円。
念のため AWS Budgets でアラートを設定しておく。

---

## 構成

```
kintone-plugin-site/
├── index.html
├── vite.config.js          base は '/'
├── amplify.yml             backend で amplify/ をデプロイ、frontend でサイトをビルド
│
├── amplify/                ★ AWSの設計図。ここに書いた内容がAWSに作られる
│   ├── backend.ts              全体のまとめ。サインアップ無効化もここ
│   ├── auth/resource.ts        Cognito
│   ├── data/resource.ts        DynamoDB のテーブル定義と権限
│   ├── storage/resource.ts     S3 のパスと権限
│   ├── tsconfig.json           $amplify/* の解決に必須（下の「ハマったところ」参照）
│   └── functions/increment-download/
│                               ダウンロード数を+1するLambda
│
├── public/                 ファビコン・logo.svg・robots.txt
│
├── scripts/                ★ ビルドの最後に走る（DBの内容からファイルを作る）
│   ├── generate-sitemap.mjs    sitemap.xml
│   ├── prerender.mjs           詳細ページを静的HTML化（下の「SEO」参照）
│   └── lib/
│       ├── plugin-data.mjs     ビルド時にDBから公開中の一覧を取る
│       └── render-page.mjs     詳細ページのHTMLを組み立てる
│
└── src/
    ├── main.jsx / App.jsx
    │
    ├── lib/
    │   ├── amplify.js         AWSへの接続設定
    │   ├── api.js             DynamoDB / S3 の読み書き
    │   ├── readPluginZip.js   zip から manifest.json を読む
    │   ├── usage.js           使い方データ（json）の形をそろえる
    │   ├── format.js          バイト数・日付の整形
    │   ├── meta.js            title/description/canonical の差し替え
    │   └── plugin-meta.js     ★ 詳細ページのSEO情報。ビルド用スクリプトと共用
    │
    ├── components/            Header / Footer / SetupNotice / UsageSection
    │
    ├── pages/
    │   ├── PluginList.jsx     一覧（トップ）。検索・カテゴリ絞り込み
    │   ├── PluginDetail.jsx   詳細・ダウンロード・導入手順
    │   ├── NotFound.jsx
    │   └── admin/
    │       ├── Admin.jsx            ログインとページ振り分け
    │       ├── AdminPluginList.jsx  一覧・公開切替・削除
    │       ├── AdminPluginForm.jsx  1件ずつ追加・編集
    │       ├── AdminBulkImport.jsx  zip をまとめて取り込む
    │       └── AdminUsageEditor.jsx 使い方を書く（手順＋画像）
    │
    └── styles/base.css
```

管理画面は Amplify UI（ログイン部品）が重いので `React.lazy` で分割してある。
おかげで訪問者が見るページは 133KB（gzip）で済み、318KB の CSS は
`/admin` を開いたときだけ読み込まれる。

---

## 開発

```bash
npm install     # 初回のみ
npm run sandbox # 別ターミナルで起動したままにする
npm run dev     # http://localhost:5173/
```

`npm run sandbox` は AWS 上に自分専用の DynamoDB / S3 / Cognito を作り、
接続情報 `amplify_outputs.json` を生成する（Git対象外）。初回は5〜10分かかる。

`amplify_outputs.json` が無いときは画面に案内を出して落ちないようにしてある。
デザインの確認だけならサンドボックス無しでもできる。

サンドボックスを止めるときは `Ctrl+C` →「リソースを削除しますか？」に `y`/`n`。

### AWS CLI

`npm run sandbox` には AWS の認証情報が必要。

```bash
aws configure
# region は ap-northeast-1
aws sts get-caller-identity   # 確認
```

---

## デプロイ

`main` に push すれば Amplify が自動でビルド＆デプロイする。
`amplify/` を変更した場合はバックエンドの再デプロイも走るので5〜10分かかる。

**プラグインの追加・更新に push は不要。** 管理画面から行う。

ビルドの最後に、DBの内容から2つのファイルを作っている（`amplify.yml` 参照）。

| コマンド | 作るもの |
| --- | --- |
| `node scripts/generate-sitemap.mjs` | `dist/sitemap.xml` |
| `node scripts/prerender.mjs` | `dist/plugins/<slug>.html`（詳細ページの静的HTML） |

**sitemap は失敗しても続行する**（`|| true`）。古いサイトマップが残るだけで害がない。

**prerender は失敗したらビルドを止める。** 書き換えルールが404系なので、
静的HTMLが無いまま公開すると詳細ページ36本が全部404になる。
失敗したらデプロイさせず、前の版を生かしておくほうが安全。
ビルドが赤くなったらログで `prerender:` の行を見て、
DBに繋がる状態にしてから再デプロイする。

手元でまとめて実行するときは `npm run build:all`。
ただし `amplify_outputs.json` が本物でないと DB に繋がらないので、
`npx ampx sandbox` を動かしているときだけ意味がある。

### 初回だけ必要だった設定（作り直すとき用のメモ）

**1. サービスロール**

Amplify のサービスロールに `AmplifyBackendDeployFullAccess` を持つロールを設定する。
自動で作られる `AmplifySSRLoggingRole` はログ出力専用でリソースを作れない。

**2. SPA の書き換えルール**

`index.html` 1枚で複数ページを表示しているので、これが無いと
`/plugins/xxx` や `/admin` を直接開いたときに404になる。

Amplify → Hosting → 書き換えとリダイレクト:

```json
[
  {
    "source": "</^[^.]+$|\\.(?!(css|gif|ico|jpg|jpeg|js|png|txt|svg|woff|woff2|ttf|map|json|webmanifest|webp|html)$)([^.]+$)/>",
    "status": "404",
    "target": "/index.html",
    "condition": null
  }
]
```

> **⚠️ `status` を `200` にしてはいけない。**
>
> `200`（無条件の書き換え）だと、`/plugins/xxx` へのリクエストが
> **ファイルの有無を見ずに** `/index.html` に書き換えられる。
> `scripts/prerender.mjs` が作った `plugins/xxx.html` が一切使われず、
> 36本すべてが「トップページと同じHTML」を返す状態に戻ってしまう。
>
> `404` 系は「見つからなかったときだけ書き換える」。
> `/plugins/xxx` → `plugins/xxx.html` が素直に返るようになる。
>
> 除外リストに `html` を足しているのは、`/plugins/xxx.html` を
> 直接開いたときにも実ファイルを返すため。

**2026-09-15 時点の実際の挙動**（`404` を設定した状態）

| URL | 結果 |
| --- | --- |
| `/` | 200（トップ） |
| `/plugins/<公開中>` | **200・リダイレクトなし・静的HTML** ✅ |
| `/plugins/<存在しない>` | 301 → 末尾スラッシュ → 404（＋SPAの中身） |
| `/admin` | 301 → `/admin/` → 404（＋SPAの中身。ログイン画面は出る） |
| `/assets/<無いファイル>` | 404 |

存在しないプラグインが**本物の404を返すのは都合がよい**。
以前は何でも200を返していて、検索エンジンから見ると
「中身の無いページが無限にある」状態だった（ソフト404）。

`/admin` が404ステータスになるのは気持ち悪いが、中身は返っていて
ログインも通るので実害はない（`noindex` も出している）。
200に戻したい場合は `404-200` にする。ただしそのとき
存在しないURLもすべて200に戻る。

**3. 管理者アカウント**

サインアップは `backend.ts` で無効にしてある（誰でも管理画面に入れないため）。
アカウントは Cognito コンソールで作る。

Cognito → ユーザープール（名前に `amplifyAuth` が入っているもの）→ ユーザー → ユーザーを作成。
**「E メールアドレスを検証済みとしてマークする」にチェックを入れる**（忘れるとログインできない）。
仮パスワードでログインすると新パスワードの設定を求められる。

---

## プラグインを登録する

`/admin` からログインして操作する。

### まとめて取り込む

`Desktop/kintonePlugin/_dist/` に全プラグインの zip をまとめてある。
「zip をまとめて取り込む」で `Ctrl+A` で全選択すれば一度に登録できる。

zip の中の `manifest.json` から名前・説明・バージョン・アイコンを自動で読む。
kintone の zip は二重構造（`contents.zip` の中に `manifest.json`）なので、
`src/lib/readPluginZip.js` で2段階に展開している。

**取り込み直後は非公開。** 内容を確認してから一覧で「非公開」を押して公開に切り替える。

### 1件ずつ

「+ 新規追加」から。zip とアイコンを個別に指定できる。

### 項目

| 項目 | 内容 |
| --- | --- |
| slug | URLに使う識別子。`bulk-copy` → `/plugins/bulk-copy` |
| 1行説明 | 一覧のカードに出る短い説明 |
| 詳しい説明 | 詳細ページの本文。改行で段落が分かれる |
| 並び順 | 小さいほど上。既定は100 |
| 公開する | 外すと下書き扱いで一般には見えない |

slug は英語名から自動生成される。**公開後に変えるとURLが変わってリンクが切れる**ので、
公開前に決めておく。

---

## 使い方を書く

一覧の「使い方」列のリンク（`/admin/usage/:id`）から編集する。
未記入なら「未記入」と表示される。

書けるもの:

| | |
| --- | --- |
| 導入文 | 手順の前に出る。何ができるか、どんな場面で使うか |
| 手順 | 見出し＋説明＋画像1枚。上へ／下へで並べ替えできる |
| 注意点 | 手順のあとに黄色い枠で出る |

- **画像は5MBまで。** 設定画面のスクリーンショットや図を入れる
- 説明の改行はそのまま反映される
- **中身が空のうちは、公開ページに「使い方」の見出しごと出ない**

データは Plugin の `usage` フィールドに json で入れている。
項目を増やしたくなってもテーブルを作り直さずに済むようにしたため。
読み込みは必ず `src/lib/usage.js` の `normalizeUsage` を通して、
中身が空でも古い形でも画面が落ちないようにしている。

画像は S3 の `usage/<slug>/` に置く。手順から画像を外して保存すると、
使われなくなった画像は S3 からも消える。

公開ページでは番号付きのステップで表示され、画像はクリックで拡大できる。

---

## SEO

検索から来てもらうことが、このサイトの一番の役割。
プラグイン36本＝36個の検索流入口なので、その36ページが
「別々のページ」として扱われることが前提になる。

### 詳細ページを静的HTMLにしている理由

このサイトは `index.html` 1枚で全ページを描くので、
**JavaScript を実行しないクローラー**から見た `/plugins/xxx` は、
以前こうなっていた。

| | 以前 | 今 |
| --- | --- | --- |
| `<title>` | 36本すべて「kintone 無料プラグイン一覧」 | プラグインごと |
| `canonical` | `https://plugins.to-morrow.net/`（トップ） | そのページ自身 |
| 本文 | `<div id="root"></div>` だけ | 見出し・説明・使い方まで入る |

**canonical がトップを指しているのが致命的だった。** 検索エンジンに
「この36本はすべてトップページの重複です」と伝えているのと同じで、
個別のプラグイン名では検索結果に出ない。

`scripts/prerender.mjs` がビルド時に `dist/plugins/<slug>.html` を書き出し、
上の右列の状態にしている。URLは `/plugins/xxx` のまま変わらない
（Amplify が拡張子なしのリクエストに `.html` を返すため。
書き換えルールの `404-200` が前提なので、上の「SPA の書き換えルール」を必ず確認する）。

### 直したら両方直すもの

同じ内容を「React が描くとき」と「ビルド時に焼き込むとき」の2回作っている。
食い違うと、クローラーが見るHTMLと利用者が見る画面がずれる。

| 変えるもの | 直す場所 |
| --- | --- |
| タイトル・説明文・構造化データ | `src/lib/plugin-meta.js` **のみ**（両方が読んでいる） |
| 料金・事業サイトへのリンク | `src/lib/site.js` **のみ**（両方が読んでいる） |
| 詳細ページの本文の文言 | `src/pages/PluginDetail.jsx` と `scripts/lib/render-page.mjs` の**両方** |

### 確認のしかた

```bash
# 静的HTMLが返っているか（title がプラグイン名なら成功）
curl -s https://plugins.to-morrow.net/plugins/record-aggregation-plugin | grep -E '<title>|canonical'
```

Search Console の「URL検査」で、`Google が選択した正規 URL` が
そのページ自身になっていることも確認する。
トップページになっていたら、まだ書き換えルールが `200` のまま。

---

## ハマったところ

作り直すときや機能を足すときに同じ穴に落ちないためのメモ。

**`allow.authenticated()` は provider を明示する**

省略すると userPools 経由の認証だけを許可する。クライアントは
`authMode: 'identityPool'` で接続しているので、ログイン済みでも弾かれて
`Not Authorized to access listPlugins on type Query` になる。
`allow.authenticated('identityPool')` と書く。

**DynamoDB の `limit` は「返す件数」ではなく「絞り込む前に読む件数」**

`filter` と併用すると、limit までに該当が無ければ0件で返ってくる。
続きがあることは `nextToken` でしか分からず、**中身が空でも nextToken があれば
次を読む必要がある**。`api.js` の `listAllPages` で全ページたどっている。

以前 `getPluginBySlug` で `limit: 1` にしていて、詳細ページが常に
「プラグインが見つかりませんでした」になっていた。

**データ定義と Lambda を相互参照させると循環参照になる**

ダウンロード数カウント用の Lambda を、データ定義から参照しつつ
Lambda 側にテーブルの権限とテーブル名を渡したところ、CloudFormation が
`Circular dependency between resources` で失敗した。
直接テーブルを触るのではなく AppSync 経由にする必要がある。

**Lambda を足すなら `amplify/tsconfig.json` が要る**

ハンドラが書く `import { env } from '$amplify/env/<関数名>'` は、
ampx が `.amplify/generated/env/<関数名>.ts` に書き出す実ファイルへの別名。
この対応表は **tsconfig の paths** で与える。

```json
"paths": { "$amplify/*": ["../.amplify/generated/*"] }
```

esbuild はハンドラのある場所から上に向かって最初に見つけた tsconfig を読むので、
**`amplify/tsconfig.json` に置かないと届かない**。ルートの tsconfig では効かない。

無いとバンドルの段階で落ちる:

```
Could not resolve "$amplify/env/increment-download"
[FailedToBundleAsset] ... esbuild ... exited with status 1
```

**`@types/node` も要る。** ampx が生成する env ファイルは `process.env` を使うので、
入っていないと型チェックで落ちる:

```
.amplify/generated/env/<関数名>.ts:2:20 - error TS2580: Cannot find name 'process'.
```

このプロジェクトは `npm create amplify` を使わず手で作ったため、
標準では付いてくる `amplify/tsconfig.json` と `@types/node` の両方が無く、
Lambda の追加で3回デプロイに失敗した。

なお `.amplify/generated/` は ampx を動かすまで存在しないので、
ローカルの `tsc` はハンドラを解決できない。
ルートの tsconfig で `amplify/functions/*/handler.ts` を exclude しているのはそのため。
Amplify のビルド時には生成済みなので型チェックされる。

**`npm ci` がロックファイルを拒否する**

`@aws-amplify/backend-cli` が内包する CDK 関連パッケージの構造上、
`npm install` が作った `package-lock.json` を `npm ci` が「同期していない」と
誤判定する（`Missing: @aws-cdk/toolkit-lib ... from lock file`）。
ロックを作り直しても npm を上げても再発するので、`amplify.yml` で
`npm ci || npm install` のフォールバックにしている。

**Amplify にビルド設定が無いと画面が真っ白になる**

`amplify.yml` の `artifacts.baseDirectory: dist` が無いと、Amplify はビルドせずに
ソースをそのまま配信する。`index.html` が参照する `/src/main.jsx` は
ビルド前のファイルなので404になり、何も描画されない。

---

## やること

- [x] ダウンロード数の自動カウント（2026-09-11）
      2回失敗したあと、ビルドログで原因を特定して解決。
      1回目は循環参照、2回目は amplify/tsconfig.json が無く $amplify/* を解決できなかった。
- [x] 詳細ページの静的HTML化（2026-09-15）
      canonical が36本すべてトップページを指していたのを解消。下の「SEO」参照。
- [ ] カテゴリと並び順の設定（今は全件カテゴリ未設定・並び順100）
- [ ] 独自ドメインを取ったら `Desktop/kintonePlugin/tools/set-homepage-url.mjs` の
      `SITE` を直して zip を作り直す
- [ ] 各プラグインの使い方を書く（一番の推しの帳票出力から）
