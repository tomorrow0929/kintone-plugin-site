import { type ClientSchema, a, defineData } from '@aws-amplify/backend'

/**
 * データベース（DynamoDB）の定義。
 * ここに書いたモデルが、そのままテーブルとAPIになります。
 */
const schema = a.schema({
  Plugin: a
    .model({
      // URLに使う識別子（例: bulk-copy）。半角英数とハイフンのみ。
      slug: a.string().required(),

      name: a.string().required(),        // 表示名（日本語）
      nameEn: a.string(),                 // 英語名
      summary: a.string().required(),     // 一覧に出す1行説明
      description: a.string(),            // 詳細ページの説明（改行OK）
      version: a.string().required(),     // 例: 1.0.0
      category: a.string(),               // 例: 入力支援 / 表示 / 出力

      // S3 に保存したファイルの場所（キー）
      zipKey: a.string().required(),      // プラグイン本体 .zip
      zipSize: a.integer(),               // バイト数（表示用）
      iconKey: a.string(),                // アイコン画像

      // 公開状態と並び順
      published: a.boolean().default(false),
      sortOrder: a.integer().default(100),

      releasedAt: a.date(),               // 公開日

      // ダウンロード数。今は管理画面から手で直せる項目としてだけ持っています。
      // 自動カウントは、まず基本のデプロイが通ってから追加します。
      downloadCount: a.integer().default(0),
    })
    .authorization((allow) => [
      // 未ログインの訪問者は「読むだけ」
      allow.guest().to(['read']),
      // ログイン済み（＝管理者）は作成・更新・削除ができる
      allow.authenticated(),
    ]),
})

export type Schema = ClientSchema<typeof schema>

export const data = defineData({
  schema,
  authorizationModes: {
    // 未ログインの訪問者にも読ませたいので identityPool を既定にする
    defaultAuthorizationMode: 'identityPool',
  },
})
