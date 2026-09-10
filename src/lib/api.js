import { generateClient } from 'aws-amplify/data'
import { getUrl, uploadData, remove } from 'aws-amplify/storage'
import { isConfigured } from './amplify.js'

// データベースへの入り口。未設定のときは null（画面側で案内を出します）
const client = isConfigured ? generateClient({ authMode: 'identityPool' }) : null

/** 公開中のプラグインを並び順で取得 */
export async function listPublishedPlugins() {
  if (!client) return []
  const { data, errors } = await client.models.Plugin.list({
    filter: { published: { eq: true } },
    limit: 200,
  })
  if (errors?.length) throw new Error(errors.map((e) => e.message).join('\n'))
  return sortPlugins(data)
}

/** 管理画面用：非公開も含めて全件取得 */
export async function listAllPlugins() {
  if (!client) return []
  const { data, errors } = await client.models.Plugin.list({ limit: 200 })
  if (errors?.length) throw new Error(errors.map((e) => e.message).join('\n'))
  return sortPlugins(data)
}

/** slug（URLの識別子）から1件取得 */
export async function getPluginBySlug(slug) {
  if (!client) return null
  const { data, errors } = await client.models.Plugin.list({
    filter: { slug: { eq: slug } },
    limit: 1,
  })
  if (errors?.length) throw new Error(errors.map((e) => e.message).join('\n'))
  return data[0] ?? null
}

export async function createPlugin(input) {
  const { data, errors } = await client.models.Plugin.create(input)
  if (errors?.length) throw new Error(errors.map((e) => e.message).join('\n'))
  return data
}

export async function updatePlugin(input) {
  const { data, errors } = await client.models.Plugin.update(input)
  if (errors?.length) throw new Error(errors.map((e) => e.message).join('\n'))
  return data
}

export async function deletePlugin(id) {
  const { errors } = await client.models.Plugin.delete({ id })
  if (errors?.length) throw new Error(errors.map((e) => e.message).join('\n'))
}

/** S3 に置いたファイルの一時ダウンロードURLを作る */
export async function getFileUrl(key) {
  if (!key) return null
  const { url } = await getUrl({ path: key, options: { expiresIn: 300 } })
  return url.toString()
}

/** S3 にファイルをアップロード（管理画面から使用） */
export async function uploadFile(path, file, onProgress) {
  const task = uploadData({
    path,
    data: file,
    options: {
      contentType: file.type || 'application/octet-stream',
      onProgress: ({ transferredBytes, totalBytes }) => {
        if (totalBytes && onProgress) onProgress(transferredBytes / totalBytes)
      },
    },
  })
  await task.result
  return path
}

export async function removeFile(path) {
  if (!path) return
  try {
    await remove({ path })
  } catch {
    // 既に無い場合は無視
  }
}

function sortPlugins(list) {
  return [...list].sort(
    (a, b) => (a.sortOrder ?? 100) - (b.sortOrder ?? 100) || a.name.localeCompare(b.name, 'ja'),
  )
}
