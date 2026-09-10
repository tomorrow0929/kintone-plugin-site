import { Amplify } from 'aws-amplify'

/**
 * Amplify（AWS）への接続設定。
 *
 * amplify_outputs.json は「どのAWSリソースに繋ぐか」が書かれたファイルで、
 * AWS側にデプロイすると自動生成されます（Gitには入れません）。
 *
 * まだ存在しない場合でも画面が落ちないよう、
 * import.meta.glob で「あれば読む」形にしています。
 */
const found = import.meta.glob('/amplify_outputs.json', { eager: true, import: 'default' })
const outputs = found['/amplify_outputs.json'] ?? null

export const isConfigured = Boolean(outputs)

if (outputs) {
  Amplify.configure(outputs)
}
