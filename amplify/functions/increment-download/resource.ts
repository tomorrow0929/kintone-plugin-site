import { defineFunction } from '@aws-amplify/backend'

/**
 * ダウンロード数を +1 するだけの小さな処理（AWS Lambda）。
 * 訪問者にデータベースの更新権限を渡さずにカウントするために使います。
 */
export const incrementDownload = defineFunction({
  name: 'increment-download',
  entry: './handler.ts',
  timeoutSeconds: 10,
})
