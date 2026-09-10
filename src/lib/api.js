import { generateClient } from 'aws-amplify/data'
import { getUrl, uploadData, remove } from 'aws-amplify/storage'
import { isConfigured } from './amplify.js'

// データベースへの入り口。未設定のときは null（画面側で案内を出します）
const client = isConfigured ? generateClient({ authMode: 'identityPool' }) : null

/**
 * 条件に合うレコードを「全ページ」たどって集めます。
 *
 * 【なぜページ送りが必要か】
 * DynamoDB の limit は「返す件数」ではなく「絞り込む前に読む件数」です。
 * そのため filter と limit を併用すると
 *   - limit までに該当が無ければ 0 件で返ってくる
 *   - 続きがあることは nextToken でしか分からない
 * という挙動になります。中身が空でも nextToken があれば次を読む必要があります。
 *
 * 以前ここで limit: 1 を指定していたため、
 * 詳細ページが常に「プラグインが見つかりませんでした」になっていました。
 */
async function listAllPages(options = {}) {
  const all = []
  let nextToken = null

  do {
    const result = await client.models.Plugin.list({ ...options, nextToken })
    if (result.errors?.length) {
      throw new Error(result.errors.map((e) => e.message).join('\n'))
    }
    all.push(...(result.data ?? []))
    nextToken = result.nextToken ?? null
  } while (nextToken)

  return all
}

/** 公開中のプラグインを並び順で取得 */
export async function listPublishedPlugins() {
  if (!client) return []
  return sortPlugins(await listAllPages({ filter: { published: { eq: true } } }))
}

/** 管理画面用：非公開も含めて全件取得 */
export async function listAllPlugins() {
  if (!client) return []
  return sortPlugins(await listAllPages())
}

/** slug（URLの識別子）から1件取得 */
export async function getPluginBySlug(slug) {
  if (!client) return null
  const found = await listAllPages({ filter: { slug: { eq: slug } } })
  return found[0] ?? null
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

/**
 * ダウンロード数を1増やす。
 * 数え損ねてもダウンロード自体は止めないので、失敗は握りつぶす。
 */
export async function countDownload(pluginId) {
  if (!client) return
  try {
    await client.mutations.incrementDownloadCount({ pluginId })
  } catch {
    // カウントの失敗は利用者に影響させない
  }
}

function sortPlugins(list) {
  return [...list].sort(
    (a, b) => (a.sortOrder ?? 100) - (b.sortOrder ?? 100) || a.name.localeCompare(b.name, 'ja'),
  )
}
