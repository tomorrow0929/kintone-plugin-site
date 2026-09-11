import { defineFunction } from '@aws-amplify/backend'

/**
 * ダウンロード数を +1 するだけの処理（AWS Lambda）。
 *
 * 訪問者にデータベースの更新権限を渡さずにカウントするために使う。
 * DynamoDB を直接触るのではなく AppSync 経由にしている
 * （直接触ると「データ定義 ⇄ Lambda」の循環参照になりデプロイできない）。
 */
export const incrementDownload = defineFunction({
  name: 'increment-download',
  entry: './handler.ts',
  timeoutSeconds: 15,
})
