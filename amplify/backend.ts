import { defineBackend } from '@aws-amplify/backend'
import { auth } from './auth/resource'
import { data } from './data/resource'
import { storage } from './storage/resource'
import { incrementDownload } from './functions/increment-download/resource'

const backend = defineBackend({
  auth,
  data,
  storage,
  incrementDownload,
})

// ===== 一般の人が勝手にサインアップできないようにする =====
// これが無いと、誰でもアカウントを作って管理画面に入れてしまいます。
// 管理者アカウントは AWS の Cognito コンソールから作成してください。
const { cfnUserPool } = backend.auth.resources.cfnResources
cfnUserPool.adminCreateUserConfig = {
  allowAdminCreateUserOnly: true,
}

// ===== Lambda に Plugin テーブルの場所と更新権限を渡す =====
const pluginTable = backend.data.resources.tables['Plugin']
const fn = backend.incrementDownload.resources.lambda

pluginTable.grantReadWriteData(fn)
backend.incrementDownload.addEnvironment('PLUGIN_TABLE_NAME', pluginTable.tableName)
