import { defineStorage } from '@aws-amplify/backend'

/**
 * ファイル置き場（Amazon S3）。
 *
 * - plugins/ … 配布する .zip
 * - icons/   … プラグインのアイコン画像
 * - usage/   … 使い方の説明に使う画像
 *
 * いずれも「誰でも読める / 書き込めるのはログイン済みの管理者だけ」。
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
    'usage/*': [
      allow.guest.to(['read']),
      allow.authenticated.to(['read', 'write', 'delete']),
    ],
  }),
})
