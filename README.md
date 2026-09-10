# to.Morrow kintone プラグイン配布サイト

kintone プラグインを一般公開してダウンロードしてもらうためのサイトです。
**React + Vite**（画面）と **AWS Amplify Gen 2**（データベース・ファイル置き場・ログイン）でできています。

---

## ⚠️ 最初に：絶対に公開してはいけないファイル

`kintonePlugin` フォルダにある **`.ppk` ファイルは署名用の秘密鍵**です。

- 流出すると、第三者があなたのプラグインIDで偽物を配布できてしまいます
- **このリポジトリにも、このサイトにも、絶対に置かないでください**
- `.gitignore` で `*.ppk` `*.pem` `*.key` を除外していますが、念のため毎回確認してください

配布するのは **`.zip` だけ**です。

---

## 1. 全体の構成

```
       あなた                        訪問者
         │                            │
    ログイン(Cognito)              そのまま閲覧
         │                            │
         ▼                            ▼
   ┌──────────────────────────────────────┐
   │  このサイト（React / Amplify Hosting）│
   └──────────────────────────────────────┘
         │                            │
         ├── プラグイン情報 ──▶ DynamoDB（データベース）
         └── zip / アイコン ──▶ S3（ファイル置き場）
```

| 使うもの | 役割 |
| --- | --- |
| Amplify Hosting | サイトの公開 |
| Cognito | 管理画面のログイン（あなただけ） |
| DynamoDB | プラグインの名前・説明・バージョンなどの保存 |
| S3 | zip ファイルとアイコン画像の保存 |
| Lambda | ダウンロード数のカウント |

**料金:** どれも無料枠が大きく、個人配布サイト程度のアクセスならほぼ 0 円です。
ただし無料枠を超えると課金されるので、AWS の Budgets でアラートを設定しておくことをおすすめします。

---

## 2. フォルダ構成

```
kintone-plugin-site/
├── index.html              ← ページの土台
├── package.json
├── vite.config.js
├── amplify.yml             ← Amplify のビルド設定
│
├── amplify/                ← AWSの設計図（ここに書くとAWSに作られます）
│   ├── backend.ts              全体のまとめ
│   ├── auth/resource.ts        ログイン（Cognito）
│   ├── data/resource.ts        データベース（DynamoDB）の項目定義
│   ├── storage/resource.ts     ファイル置き場（S3）
│   └── functions/increment-download/
│                               ダウンロード数を+1するLambda
│
├── public/                 ← そのまま公開されるファイル（ファビコン等）
│
└── src/
    ├── main.jsx / App.jsx      入口とページの振り分け
    ├── lib/
    │   ├── amplify.js          AWSへの接続設定
    │   ├── api.js              データベース・S3の読み書き
    │   ├── readPluginZip.js    zipからmanifest.jsonを読む
    │   └── format.js           表示整形
    ├── components/             ヘッダー・フッターなど
    ├── pages/
    │   ├── PluginList.jsx      プラグイン一覧（トップ）
    │   ├── PluginDetail.jsx    プラグイン詳細＋ダウンロード
    │   └── admin/              管理画面
    │       ├── Admin.jsx           ログインとページ振り分け
    │       ├── AdminPluginList.jsx 登録済み一覧・公開切替・削除
    │       ├── AdminPluginForm.jsx 1件ずつ追加・編集
    │       └── AdminBulkImport.jsx zipをまとめて取り込む
    └── styles/base.css
```

---

## 3. AWS のセットアップ

### 3-1. AWS CLI を入れて認証情報を設定する

まだ入っていないので、最初に入れてください。

1. [AWS CLI をダウンロード](https://aws.amazon.com/jp/cli/)してインストール
2. AWS マネジメントコンソール → IAM → ユーザー → 自分のユーザー →
   「セキュリティ認証情報」→「アクセスキーを作成」
3. ターミナルで設定

```bash
aws configure
# AWS Access Key ID     → 手順2で作ったキー
# AWS Secret Access Key → 同上
# Default region name   → ap-northeast-1
# Default output format → json
```

確認:

```bash
aws sts get-caller-identity
```

自分のアカウントIDが表示されればOKです。

### 3-2. 自分専用のお試し環境（サンドボックス）を起動

```bash
npm install     # 初回のみ
npm run sandbox
```

初回は5〜10分かかります。AWS 上に自分だけの DynamoDB / S3 / Cognito が作られ、
接続情報 `amplify_outputs.json` が自動生成されます（Git には入りません）。

**起動したままにしておいてください。** 別のターミナルを開いて:

```bash
npm run dev
```

http://localhost:5173/ でサイトが見られます。

サンドボックスを止めるには `Ctrl + C` →「リソースを削除しますか？」に `y`（消す）/ `n`（残す）で答えます。

---

## 4. 本番として公開する

### 4-1. GitHub にリポジトリを作って push

```bash
git remote add origin https://github.com/tomorrow0929/kintone-plugin-site.git
git branch -M main
git push -u origin main
```

### 4-2. Amplify にアプリを作成

1. AWS マネジメントコンソール → **AWS Amplify** → **新しいアプリを作成**
2. **GitHub** を選び、作ったリポジトリと `main` ブランチを指定
3. ビルド設定は `amplify.yml` が自動で使われます（そのままでOK）
4. 「保存してデプロイ」

初回は10分ほどかかります（AWSリソースの作成を含むため）。

### 4-3. 【重要】SPA 用の書き換えルールを追加

このサイトは1つの `index.html` で複数ページを表示する仕組み（SPA）です。
そのままだと `/plugins/bulk-copy` を直接開いたときに **404** になります。

Amplify コンソール → 対象アプリ → **Hosting** → **書き換えとリダイレクト** →
**ルールを追加** で、次を登録してください。

| 項目 | 値 |
| --- | --- |
| 送信元アドレス | `</^[^.]+$\|\.(?!(css\|gif\|ico\|jpg\|jpeg\|js\|png\|txt\|svg\|woff\|woff2\|ttf\|map\|json\|webmanifest)$)([^.]+$)/>` |
| ターゲットアドレス | `/index.html` |
| 種類 | `200 (書き換え)` |

### 4-4. 管理者アカウントを作る

サインアップは**意図的に無効化**してあります（誰でも管理画面に入れないようにするため）。
アカウントは AWS 側で作成します。

1. AWS コンソール → **Amazon Cognito** → ユーザープール
   （Amplify が作ったもの。名前に `amplifyAuth` が入っています）
2. 「ユーザー」→ **ユーザーを作成**
3. メールアドレスと仮パスワードを設定して作成
4. サイトの `/admin` を開き、そのメールアドレスと仮パスワードでログイン
5. 新しいパスワードを設定すれば完了

---

## 5. プラグインを登録する

サイトのフッター「管理者ログイン」または `/admin` から入ります。

### まとめて登録する（おすすめ）

「**zip をまとめて取り込む**」を開き、プラグインの zip を複数まとめて選択してください。
zip の中の `manifest.json` から名前・説明・バージョン・アイコンを自動で読み取ります。

- **取り込み直後は「非公開」**です。内容を確認してから一覧で「非公開」を押して公開に切り替えてください
- `slug`（URLに使う文字列）は英語名から自動生成されます。空欄になった場合は手入力してください

### 1件ずつ登録する

「**+ 新規追加**」から入力します。zip とアイコンを個別に指定できます。

### 項目の意味

| 項目 | 説明 |
| --- | --- |
| slug | URLに使う識別子。`bulk-copy` → `/plugins/bulk-copy` |
| 1行説明 | 一覧のカードに表示される短い説明 |
| 詳しい説明 | 詳細ページの本文。改行で段落が分かれます |
| 並び順 | 数字が小さいほど一覧の上に表示 |
| 公開する | 外すと下書き扱いになり、一般には見えません |

---

## 6. 日々の更新

```bash
git add .
git commit -m "更新内容"
git push
```

push すると Amplify が自動でビルド・公開します。

**プラグインの追加・更新は push 不要です。** 管理画面から行えます。

---

## 7. 今後の改善メモ

- **プラグインのアイコンが大きすぎます。** `manifest.json` の `icon` に指定されている画像が
  最大 2.3MB あり、これが zip 全体のサイズをふくらませています。
  kintone のプラグインアイコンは 48×48px 程度で十分なので、
  小さい画像に差し替えて zip を作り直すとダウンロードが軽くなります。
- **各プラグインの `manifest.json` の `homepage_url` が `https://example.com` のまま**です。
  このサイトのURLに変更すると、kintone のプラグイン一覧からここへ来てもらえます。
  変更後は同じ `.ppk` で署名し直してください（鍵を変えると別プラグイン扱いになります）。
- 帳票出力プラグインは zip が未作成のため、まだ配布できません。
