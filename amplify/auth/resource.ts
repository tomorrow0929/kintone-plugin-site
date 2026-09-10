import { defineAuth } from '@aws-amplify/backend'

/**
 * 管理画面へのログイン（Amazon Cognito）。
 *
 * 重要: 一般の人が勝手にサインアップできないよう、backend.ts で
 * 「管理者がユーザーを作成した場合のみ利用可能」に設定しています。
 * 管理者アカウントは AWS の Cognito コンソールから作成してください。
 */
export const auth = defineAuth({
  loginWith: {
    email: true,
  },
})
