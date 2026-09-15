/**
 * ビルド時に DynamoDB から公開中のプラグインを取り出す。
 *
 * sitemap.xml の生成（generate-sitemap.mjs）と
 * 詳細ページの静的HTML生成（prerender.mjs）の両方から使います。
 *
 * ブラウザ用の src/lib/api.js と同じことをしていますが、
 * あちらは import.meta.env などブラウザ前提の記述があるため、
 * ビルド用にここを分けています。
 */
import { readFileSync, existsSync } from 'node:fs'
import { resolve } from 'node:path'

/**
 * 公開中のプラグインを、一覧と同じ並び順で全件返す。
 *
 * 【ページ送りが必要な理由】
 * DynamoDB の limit は「返す件数」ではなく「絞り込む前に読む件数」です。
 * 中身が空でも nextToken があれば続きがあるので、必ず最後までたどります。
 *
 * 取得できないときは例外を投げます。呼び出し側で受け止めて、
 * 「何も書き換えずに終了する」ようにしてください。
 * 中途半端な結果でファイルを上書きするほうが害が大きいためです。
 */
export async function fetchPublishedPlugins() {
  const outputsPath = resolve('amplify_outputs.json')
  if (!existsSync(outputsPath)) {
    throw new Error('amplify_outputs.json が見つかりません')
  }

  const outputs = JSON.parse(readFileSync(outputsPath, 'utf8'))
  const { Amplify } = await import('aws-amplify')
  const { generateClient } = await import('aws-amplify/data')

  Amplify.configure(outputs)
  const client = generateClient({ authMode: 'identityPool' })

  const all = []
  let nextToken = null
  do {
    const result = await client.models.Plugin.list({
      filter: { published: { eq: true } },
      nextToken,
    })
    if (result.errors?.length) {
      throw new Error(result.errors.map((e) => e.message).join(' / '))
    }
    all.push(...(result.data ?? []))
    nextToken = result.nextToken ?? null
  } while (nextToken)

  const published = all.filter((p) => p.slug)
  if (published.length === 0) {
    throw new Error('公開中のプラグインが0件でした')
  }

  // 画面の一覧と同じ並び（src/lib/api.js の sortPlugins と同じ規則）
  return published.sort(
    (a, b) => (a.sortOrder ?? 100) - (b.sortOrder ?? 100) || a.name.localeCompare(b.name, 'ja'),
  )
}
