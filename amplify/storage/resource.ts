import { defineStorage } from '@aws-amplify/backend'

/**
 * ファイル置き場（Amazon S3）。
 *
 * - plugins/ … 配布する .zip
 * - icons/   … プラグインのアイコン画像
 *
 * どちらも「誰でも読める / 書き込めるのはログイン済みの管理者だけ」。
 */
export const storage = defineStorage({
  name: 'kintonePluginFiles',
  access: (allow) => ({
    'plugins/*': [
      allow.guest.to(['read']),
      allow.authenticated.to(['read', 'write', 'delete']),
    ],
    'icons/*': [
      allow.guest.to(['read']),
      allow.authenticated.to(['read', 'write', 'delete']),
    ],
  }),
})
