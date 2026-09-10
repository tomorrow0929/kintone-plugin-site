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

      // ダウンロード数。今は管理画面から手で直せる項目としてだけ持っている
      // （自動カウントは Lambda の循環参照で外したまま。READMEの「やること」参照）
      downloadCount: a.integer().default(0),

      /**
       * 使い方（管理画面の「使い方を編集」から入力する）。
       *
       * 形が変わっても作り直さずに済むよう json で持つ。中身:
       *   {
       *     intro: string,                        導入文
       *     steps: [{ title, body, imageKey,      手順（画像は1枚まで）
       *               imageCaption }],
       *     notes: string                         注意点
       *   }
       */
      usage: a.json(),
    })
    .authorization((allow) => [
      // 未ログインの訪問者は「読むだけ」
      allow.guest().to(['read']),
      // ログイン済み（＝管理者）は作成・更新・削除ができる。
      // 'identityPool' の指定が必須。省略すると userPools 経由の認証だけが
      // 許可され、identityPool で接続しているクライアントが弾かれます
      // （Not Authorized to access listPlugins on type Query）。
      allow.authenticated('identityPool'),
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
