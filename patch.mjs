import fs from 'node:fs'
let s = fs.readFileSync('src/lib/api.js', 'utf8')

const before = `/** 公開中のプラグインを並び順で取得 */
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
}`

const after = `/**
 * 条件に合うレコードを「全ページ」たどって集めます。
 *
 * 【なぜページ送りが必要か】
 * DynamoDB の limit は「返す件数」ではなく「絞り込む前に読む件数」です。
 * そのため filter と limit を併用すると、
 *   - limit までに該当が無ければ 0 件で返ってくる
 *   - 続きがあることは nextToken でしか分からない
 * という挙動になります。中身が空でも nextToken があれば次を読む必要があります。
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
}`

if (!s.includes(before)) { console.error('MISS'); process.exit(1) }
fs.writeFileSync('src/lib/api.js', s.replace(before, after))
console.log('ok')
