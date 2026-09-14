/**
 * sitemap.xml を最新の状態に更新する（ビルド後に実行）。
 *
 * 【なぜ必要か】
 * このサイトは1つの index.html で全ページを描く作りなので、
 * 検索エンジンはトップページを読んでJavaScriptを実行しないと
 * 36本の詳細ページの存在に気づけません。
 * sitemap.xml にURLを並べておくと、発見がはるかに早くなります。
 *
 * 【失敗しても何も壊しません】
 * public/sitemap.xml に手書きの一覧を置いてあり、ビルド時に dist へコピーされます。
 * このスクリプトはDBから最新の一覧を取れたときだけ、それを上書きします。
 * 取れなかった場合は「何もせずに終了」します。
 * 中途半端なサイトマップで上書きしてしまうほうが害が大きいためです。
 *
 * 実行: node scripts/generate-sitemap.mjs
 * （amplify.yml のビルドコマンドから呼ばれます）
 */
import { writeFileSync, readFileSync, existsSync } from 'node:fs'
import { resolve } from 'node:path'

const SITE_URL = 'https://plugins.to-morrow.net'
const OUT_FILE = resolve('dist', 'sitemap.xml')
const TODAY = new Date().toISOString().slice(0, 10)

/** URLの一覧から sitemap.xml の中身を組み立てる */
function buildXml(entries) {
  const body = entries
    .map(
      ({ loc, priority, changefreq }) => `  <url>
    <loc>${loc}</loc>
    <lastmod>${TODAY}</lastmod>
    <changefreq>${changefreq}</changefreq>
    <priority>${priority}</priority>
  </url>`,
    )
    .join('\n')

  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${body}
</urlset>
`
}

/** 公開中プラグインの slug を全部集める */
async function fetchSlugs() {
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

  return all.map((p) => p.slug).filter(Boolean)
}

try {
  const slugs = await fetchSlugs()

  // 1件も取れなかったときは、既存のサイトマップを消さないように何もしない
  if (slugs.length === 0) {
    throw new Error('公開中のプラグインが0件でした')
  }

  writeFileSync(
    OUT_FILE,
    buildXml([
      { loc: `${SITE_URL}/`, priority: '1.0', changefreq: 'weekly' },
      ...slugs.map((slug) => ({
        loc: `${SITE_URL}/plugins/${slug}`,
        priority: '0.8',
        changefreq: 'monthly',
      })),
    ]),
    'utf8',
  )
  console.log(`sitemap.xml を最新化しました（${slugs.length + 1} 件）`)
} catch (error) {
  console.warn(`sitemap: 最新の一覧を取得できませんでした（${error.message}）`)
  console.warn('public/sitemap.xml の内容をそのまま使います。ビルドは続行します。')
}
